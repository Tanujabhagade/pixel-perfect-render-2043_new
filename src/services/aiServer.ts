import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CivicIssue } from "@/lib/civic-data";
import { departments, categories } from "@/lib/civic-data";
import { assessSeverity } from "./severityService";
import { mockAnalysis, type AIAnalysis } from "./aiShared";

const requestSchema = z.object({
  imageData: z.string().max(7_000_000).optional(),
  description: z.string().trim().min(1).max(5000),
});

const providerOutputSchema = z.object({
  category: z.string().optional(),
  severity: z.string().optional(),
  department: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
  reasoning: z.string().optional(),
  impact: z.string().optional(),
});

const priorityValues = ["Critical", "High", "Medium", "Low"] as const;
const maxImageBytes = 5 * 1024 * 1024;
const requestTimeoutMs = 20_000;

function env(name: string) {
  return typeof process !== "undefined" ? process.env[name]?.trim() : undefined;
}

function validImageData(imageData: string | undefined) {
  if (!imageData) return true;
  const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(imageData);
  if (!match?.[1] || !match[2]) return false;
  if (Math.ceil(match[2].length * 3 / 4) > maxImageBytes) return false;
  const signatures: Record<string, RegExp> = {
    png: /^iVBORw0KGgo/,
    jpeg: /^\/9j\//,
    jpg: /^\/9j\//,
    webp: /^UklGR/,
    gif: /^R0lGOD/,
  };
  return signatures[match[1]]?.test(match[2]) ?? false;
}

function normalizeCategory(value: string | undefined, description: string) {
  const normalized = value?.trim().toLowerCase();
  const match = categories.find((category) => category.toLowerCase() === normalized);
  if (match) return match;
  const mock = mockAnalysis(description).category;
  return categories.includes(mock) ? mock : "Other Infrastructure";
}

function normalizeDepartment(value: string | undefined, category: string) {
  const normalized = value?.trim().toLowerCase();
  const match = departments.find((department) => department.toLowerCase() === normalized);
  if (match) return match;
  if (category === "Pothole" || category === "Road Damage") return "Road Maintenance";
  if (category === "Garbage / Overflowing Bin") return "Waste Management";
  if (category === "Water Leakage") return "Water Supply";
  if (category === "Drainage") return "Drainage";
  if (category === "Broken Streetlight") return "Electrical";
  if (category === "Fallen Tree") return "Parks & Gardens";
  return "Infrastructure";
}

function normalizePriority(value: string | undefined, description: string, category: string) {
  const normalized = value?.trim().toLowerCase();
  const requested = priorityValues.find((priority) => priority.toLowerCase() === normalized);
  const assessment = assessSeverity({ category, description });
  return {
    severity: assessment.severity,
    explanation: requested
      ? `AI recommended ${requested}. Deterministic severity rules set the result to ${assessment.severity}. ${assessment.explanation}`
      : assessment.explanation,
  };
}

function parseProviderContent(value: unknown) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    return null;
  }
}

function normalizeProviderResult(raw: unknown, description: string): AIAnalysis | null {
  const parsed = providerOutputSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.category || !parsed.data.summary) return null;
  const category = normalizeCategory(parsed.data.category, description);
  const department = normalizeDepartment(parsed.data.department, category);
  const priority = normalizePriority(parsed.data.severity, description, category);
  const confidenceValue = Number(parsed.data.confidence ?? 75);
  return {
    category,
    severity: priority.severity,
    department,
    confidence: Number.isFinite(confidenceValue) ? Math.min(100, Math.max(0, Math.round(confidenceValue))) : 75,
    summary: parsed.data.summary.slice(0, 500),
    reasoning: `${priority.explanation} ${parsed.data.reasoning ?? "Provider supplied a structured classification for citizen review."}`.slice(0, 1000),
    impact: (parsed.data.impact ?? "Impact requires citizen confirmation.").slice(0, 500),
    duplicateIds: [],
    usedMock: false,
  };
}

async function requestProvider(imageData: string | undefined, description: string): Promise<AIAnalysis | null> {
  const apiKey = env("AI_API_KEY");
  const provider = env("AI_PROVIDER")?.toLowerCase();
  if (!apiKey || !provider || provider === "mock" || !validImageData(imageData)) return null;

  // The server boundary uses the OpenAI-compatible chat schema. This supports
  // OpenAI and compatible gateways without putting provider details in the UI.
  if (!["openai", "openai-compatible"].includes(provider)) return null;
  const endpoint = env("AI_BASE_URL") || "https://api.openai.com/v1/chat/completions";
  const model = env("AI_MODEL") || "gpt-4o-mini";
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Classify this civic issue into the allowed CivicPulse categories and departments. Return JSON only with category, severity, department, summary, confidence, reasoning, and impact. The deterministic severity rules remain authoritative, so treat severity as a recommendation.\n\nDescription: ${description}` },
  ];
  if (imageData) content.push({ type: "image_url", image_url: { url: imageData } });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    return normalizeProviderResult(parseProviderContent(payload.choices?.[0]?.message?.content), description);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const analyzeWithServer = createServerFn({ method: "POST" })
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    if (env("MOCK_AI_MODE")?.toLowerCase() === "true" || !env("AI_PROVIDER")) {
      return mockAnalysis(data.description, data.imageData);
    }
    return await requestProvider(data.imageData, data.description) ?? mockAnalysis(data.description, data.imageData);
  });