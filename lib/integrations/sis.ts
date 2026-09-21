import "server-only";

export type SisStudentRecord = {
  faculty: string;
  major: string;
  education_level: string;
  study_year: string;
  gpa: string;
  active: boolean;
};

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "";

export async function fetchSisStudentRecord(studentId: string): Promise<SisStudentRecord | null> {
  const base = process.env.SIS_API_URL?.trim();
  const token = process.env.SIS_API_TOKEN?.trim();
  if (!base || !token || !studentId) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:") return null;
    url.searchParams.set("student_id", studentId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const raw = await response.json() as Record<string, unknown>;
    const record = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    return {
      faculty: clean(record.faculty, 150),
      major: clean(record.major, 150),
      education_level: clean(record.education_level, 50),
      study_year: clean(record.study_year, 1),
      gpa: clean(record.gpa, 4),
      active: record.active !== false,
    };
  } catch {
    return null;
  }
}
