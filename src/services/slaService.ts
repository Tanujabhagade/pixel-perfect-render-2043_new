import type { CivicIssue, CivicSettings } from "@/lib/civic-data";

export type SlaStatus = "on-track" | "due-soon" | "breached" | "completed";

export function getSlaHours(priority: CivicIssue["priority"], settings?: CivicSettings) {
  return settings?.slaHours[priority] ?? ({ Critical: 24, High: 48, Medium: 72, Low: 168 }[priority]);
}

export function getSlaStatus(issue: CivicIssue, settings?: CivicSettings, now = Date.now()) {
  const createdAt = issue.createdAt ? Date.parse(issue.createdAt) : now;
  const dueAt = createdAt + getSlaHours(issue.priority, settings) * 60 * 60 * 1000;
  const completed = ["RESOLVED", "REJECTED"].includes(issue.status);
  const completedAt = issue.resolvedAt ? Date.parse(issue.resolvedAt) : now;
  const remainingMs = dueAt - (completed ? completedAt : now);
  const totalMs = Math.max(dueAt - createdAt, 1);
  const status: SlaStatus = completed ? "completed" : remainingMs <= 0 ? "breached" : remainingMs <= totalMs * 0.2 ? "due-soon" : "on-track";
  const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  const elapsedMs = Math.min(totalMs, Math.max(0, now - createdAt));
  const progress = completed ? Math.min(100, Math.round(((completedAt - createdAt) / totalMs) * 100)) : Math.round((elapsedMs / totalMs) * 100);
  return { status, dueAt, remainingMs, remainingHours, progress, label: status === "completed" ? "Completed" : status === "breached" ? "SLA breached" : status === "due-soon" ? `${remainingHours}h left · due soon` : `${remainingHours}h left · on track` };
}