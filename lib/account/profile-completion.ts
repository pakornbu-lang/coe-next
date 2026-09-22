import type { ApplicationProfile } from "./application-prefill";

/** Fields shared by the student profile and the scholarship application. */
export function missingStudentProfileFields(profile: ApplicationProfile): string[] {
  const details = profile.profile_details ?? {};
  const value = (field: string) => String(details[field] ?? "").trim();
  const missing: string[] = [];

  if (!/^0\d{9}$/.test(profile.phone?.trim() ?? "")) missing.push("เบอร์โทรศัพท์");
  if (!profile.department?.trim()) missing.push("คณะ / สำนักวิชา");
  if (!value("major")) missing.push("สาขาวิชา");
  if (!value("education_level")) missing.push("ระดับการศึกษา");
  if (!/^[1-8]$/.test(value("study_year"))) missing.push("ชั้นปี");
  const gpa = value("gpa");
  if (!/^[0-4](\.[0-9]{1,2})?$/.test(gpa) || Number(gpa) > 4) missing.push("เกรดเฉลี่ย");
  if (value("address").length < 5) missing.push("ที่อยู่ติดต่อ");
  const parentStatus = value("parent_status");
  if (!parentStatus || (parentStatus === "other" && !value("parent_status_other"))) {
    missing.push("สถานะบิดามารดา");
  }
  return missing;
}
