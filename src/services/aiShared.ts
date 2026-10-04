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

export function mockAnalysis(description: string, imageData?: string): AIAnalysis {
  const text = description.toLowerCase();
  const road = /pothole|road|pavement/.test(text);
  const garbage = /garbage|waste|bin|overflow/.test(text);
  const water = /water|leak|pipe/.test(text);
  const drainage = /drain|sewage|flood/.test(text);
  const light = /streetlight|street light|lamp|dark road/.test(text);
  const tree = /tree|branch/.test(text);
  const signage = /sign|signage|signal/.test(text);
  const sanitation = /toilet|sanitation|cleanliness/.test(text);
  const category = road
    ? text.includes("pothole") ? "Pothole" : "Road Damage"
    : garbage ? "Garbage / Overflowing Bin"
      : water ? "Water Leakage"
        : drainage ? "Drainage"
          : light ? "Broken Streetlight"
            : tree ? "Fallen Tree"
              : signage ? "Damaged Signage"
                : sanitation ? "Sanitation"
                  : "Other Infrastructure";
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