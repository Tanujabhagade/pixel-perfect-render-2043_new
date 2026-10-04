import type { CivicIssue } from "@/lib/civic-data";
import { analyzeWithServer } from "./aiServer";
import { mockAnalysis, type AIAnalysis } from "./aiShared";
export type { AIAnalysis } from "./aiShared";

export type DuplicateSuggestion = {
  issueId: string;
  category: string;
  distance: string;
  location: string;
  status: CivicIssue["status"];
  date: string;
  similarity: number;
};

const isMockMode = (mode?: "mock" | "real") => mode === "real" ? false : mode === "mock" || import.meta.env["VITE_MOCK_AI_MODE"] !== "false";

export async function analyzeImage(imageData: string | undefined, description: string, mode?: "mock" | "real"): Promise<AIAnalysis> {
  if (isMockMode(mode)) return mockAnalysis(description, imageData);
  try {
    return await analyzeWithServer({ data: { imageData, description } });
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