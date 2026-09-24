// Final decisions do not remove the ability to schedule or correct an interview.
export const interviewApplicationStatuses = ["ready_for_review", "committee_review", "approved", "reserve", "rejected"];

export function bangkokDate(value: string) {
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10);
}
