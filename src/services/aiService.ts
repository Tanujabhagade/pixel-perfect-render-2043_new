import type { CivicIssue } from "@/lib/civic-data";
import { assessSeverity } from "./severityService";

export type AIAnalysis = {
  category: string;
  severity: CivicIssue["priority"];
  impact: string;
  department: string;
  confidence: number;
  summary: string;
  reasoning: string;
  duplicateIds: string[];
  usedMock: boolean;
};

export type DuplicateSuggestion = {
  issueId: string;
  category: string;
  distance: string;
  location: string;
  status: CivicIssue["status"];
  date: string;
  similarity: number;
};

const isMockMode = (mode?: "mock" | "real") => mode === "mock" || import.meta.env["VITE_MOCK_AI_MODE"] !== "false";

function mockAnalysis(description: string, imageData?: string): AIAnalysis {
  const text = description.toLowerCase();
  const road = /pothole|road|pavement/.test(text);
  const garbage = /garbage|waste|bin|overflow/.test(text);
  const water = /water|leak|pipe/.test(text);
  const drainage = /drain|sewage|flood/.test(text);
  const light = /streetlight|street light|lamp|dark road/.test(text);
  const tree = /tree|branch/.test(text);
  const signage = /sign|signage|signal/.test(text);
  const sanitation = /toilet|sanitation|cleanliness/.test(text);
  const category = road ? (text.includes("pothole") ? "Pothole" : "Road Damage") : garbage ? "Garbage / Overflowing Bin" : water ? "Water Leakage" : drainage ? "Drainage" : light ? "Broken Streetlight" : tree ? "Fallen Tree" : signage ? "Damaged Signage" : sanitation ? "Sanitation" : "Other Infrastructure";
  const department = road ? "Road Maintenance" : garbage ? "Waste Management" : water ? "Water Supply" : "Infrastructure";
  const resolvedDepartment = drainage ? "Drainage" : light ? "Electrical" : tree ? "Parks & Gardens" : signage ? "Infrastructure" : sanitation ? "Sanitation" : department;
  const assessment = assessSeverity({ category, description });
  const photoNote = imageData ? " A photo is attached for municipal review; mock mode does not perform visual recognition." : "";
  return {
    category,
    severity: assessment.severity,
    impact: assessment.severity === "High" || assessment.severity === "Critical" ? "May create a public safety risk and disrupt daily movement." : "Localized disruption reported by residents.",
    department: resolvedDepartment,
    confidence: road || garbage || water || drainage || light ? 94 : 82,
    summary: `The report appears to describe a ${category.toLowerCase()} concern that needs municipal review.`,
    reasoning: `${assessment.explanation}${photoNote}`,
    duplicateIds: [],
    usedMock: true,
  };
}

export async function analyzeImage(imageData: string | undefined, description: string, mode?: "mock" | "real"): Promise<AIAnalysis> {
  if (isMockMode(mode)) return mockAnalysis(description, imageData);
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageData, description }),
    });
    if (!response.ok) throw new Error("AI provider unavailable");
    const result = await response.json() as Partial<AIAnalysis>;
    if (!result.category || !result.summary || !result.department || !result.severity) throw new Error("Invalid AI response");
    return {
      category: result.category,
      severity: result.severity,
      impact: result.impact ?? "Impact requires citizen confirmation.",
      department: result.department,
      confidence: Math.min(100, Math.max(0, Number(result.confidence ?? 75))),
      summary: result.summary,
      reasoning: result.reasoning ?? "Provider supplied a structured classification for citizen review.",
      duplicateIds: result.duplicateIds ?? [],
      usedMock: false,
    };
  } catch {
    return mockAnalysis(description, imageData);
  }
}

export async function analyzeText(description: string, mode?: "mock" | "real") {
  return analyzeImage(undefined, description, mode);
}

export function estimateSeverity(description: string): CivicIssue["priority"] {
  return mockAnalysis(description).severity;
}

export function detectDuplicates(draft: Pick<CivicIssue, "category" | "description" | "latitude" | "longitude">, issues: CivicIssue[], radiusMeters = 500): DuplicateSuggestion[] {
  const words = new Set(draft.description.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  return issues.map((issue) => {
    const issueWords = new Set(issue.description.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
    const sharedWords = [...words].filter((word) => issueWords.has(word)).length;
    const distance = draft.latitude != null && draft.longitude != null && issue.latitude != null && issue.longitude != null
      ? Math.round(Math.sqrt((draft.latitude - issue.latitude) ** 2 + (draft.longitude - issue.longitude) ** 2) * 111000)
      : Number.POSITIVE_INFINITY;
    const categoryMatch = draft.category === issue.category ? 35 : 0;
    const distanceScore = distance <= radiusMeters ? Math.max(0, 35 - distance / radiusMeters * 35) : 0;
    const similarity = Math.min(99, Math.round(categoryMatch + distanceScore + Math.min(30, sharedWords * 10)));
    return { issueId: issue.id, category: issue.category, distance: Number.isFinite(distance) ? `${distance} m` : "Nearby", location: issue.location, status: issue.status, date: issue.createdAt ?? issue.age, similarity };
  }).filter((match) => match.similarity >= 35).sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

export function generateInsights(issues: CivicIssue[]) {
  const roadCount = issues.filter((issue) => issue.category.includes("Road")).length;
  const garbageCount = issues.filter((issue) => issue.category === "Garbage").length;
  return [
    `Multiple road damage reports have appeared in ${issues.find((issue) => issue.category.includes("Road"))?.ward ?? "the busiest ward"}.`,
    `Garbage overflow reports increased this month (${garbageCount} in the demo register).`,
    `Streetlight complaints are recurring near ${roadCount > 0 ? "a supported civic area" : "this location"}.`,
  ];
}