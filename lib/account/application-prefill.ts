import type { Viewer } from "@/lib/auth/types";
import type { PersonalProfile } from "./types";

export type ApplicationProfile = Pick<PersonalProfile, "phone" | "department" | "profile_details">;

export function applicationPrefill(viewer: Viewer, profile: ApplicationProfile): Record<string, string> {
  const details = profile.profile_details ?? {};
  const text = (value: unknown) => typeof value === "string" ? value : "";
  // Identity comes from the authenticated account, never from editable profile details.
  return {
    name: viewer.fullName,
    studentId: viewer.studentId,
    email: viewer.email,
    phone: text(profile.phone),
    address: text(details.address),
    faculty: text(profile.department),
    major: text(details.major),
    year: text(details.study_year),
    gpa: text(details.gpa),
    level: text(details.education_level),
  };
}
