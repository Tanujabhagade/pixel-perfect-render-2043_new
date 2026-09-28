import type { CivicIssue } from "@/lib/civic-data";

export type SeverityFactor = {
  label: string;
  detail: string;
  weight: number;
};

export type SeverityAssessment = {
  severity: CivicIssue["priority"];
  factors: SeverityFactor[];
  explanation: string;
};

const rank: Record<CivicIssue["priority"], number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function assessSeverity(input: {
  category: string;
  description: string;
  duplicateCount?: number;
  location?: string;
  unresolvedHours?: number;
}): SeverityAssessment {
  const text = `${input.category} ${input.description}`.toLowerCase();
  const factors: SeverityFactor[] = [];
  let score = 1;

  if (/danger|injur|accident|crash|school|hospital|blocked|flood|fire|electrical/.test(text)) {
    score += 2;
    factors.push({ label: "Safety implication", detail: "The report includes a possible hazard, obstruction, or sensitive public location.", weight: 2 });
  } else if (/traffic|commut|footpath|market|leak|overflow/.test(text)) {
    score += 1;
    factors.push({ label: "Public impact", detail: "The description suggests disruption to everyday movement or public access.", weight: 1 });
  }

  if (/pothole|road damage|drainage|water leakage|broken streetlight|fallen tree/.test(text)) {
    score += 1;
    factors.push({ label: "Infrastructure category", detail: "This issue can affect mobility, safety, or essential services.", weight: 1 });
  }

  if ((input.duplicateCount ?? 0) > 0) {
    score += input.duplicateCount! > 2 ? 2 : 1;
    factors.push({ label: "Duplicate reports", detail: `${input.duplicateCount} similar report${input.duplicateCount === 1 ? "" : "s"} indicate wider impact.`, weight: input.duplicateCount! > 2 ? 2 : 1 });
  }

  if ((input.unresolvedHours ?? 0) >= 72) {
    score += 1;
    factors.push({ label: "Unresolved duration", detail: "The issue has remained open for more than three days.", weight: 1 });
  }

  const severity: CivicIssue["priority"] = score >= 6 ? "Critical" : score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";
  if (!factors.length) factors.push({ label: "Initial report context", detail: "No additional safety or public-impact signal was found in the description.", weight: 0 });
  return {
    severity,
    factors,
    explanation: factors.map((factor) => factor.detail).join(" "),
  };
}

export function getSeverityRank(priority: CivicIssue["priority"]) {
  return rank[priority];
}