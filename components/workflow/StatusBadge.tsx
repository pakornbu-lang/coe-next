import { applicationStatusLabels, scholarshipStatusLabels, type ApplicationStatus, type ScholarshipStatus } from "@/lib/scholarships/types";

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`workflow-status status-${status}`}>{applicationStatusLabels[status]}</span>;
}

export function ScholarshipStatusBadge({ status }: { status: ScholarshipStatus }) {
  return <span className={`workflow-status scholarship-${status}`}>{scholarshipStatusLabels[status]}</span>;
}
