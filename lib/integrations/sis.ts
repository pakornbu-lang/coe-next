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

type CachedSis = {
  data: SisStudentRecord | null;
  expiresAt: number;
};

// Short-term in-memory cache isolated by student_id to prevent sharing data across users
const sisCache = new Map<string, CachedSis>();

export function invalidateSisCache(studentId?: string) {
  if (studentId) {
    sisCache.delete(studentId);
  } else {
    sisCache.clear();
  }
}


export async function fetchSisStudentRecord(studentId: string): Promise<SisStudentRecord | null> {
  const base = process.env.SIS_API_URL?.trim();
  const token = process.env.SIS_API_TOKEN?.trim();
  if (!base || !token || !studentId) return null;

  const now = Date.now();
  const cached = sisCache.get(studentId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const url = new URL(base);
    if (url.protocol !== "https:") return null;
    url.searchParams.set("student_id", studentId);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      sisCache.set(studentId, { data: null, expiresAt: now + 30_000 });
      return null;
    }
    const raw = await response.json() as Record<string, unknown>;
    const record = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    const studentRecord: SisStudentRecord = {
      faculty: clean(record.faculty, 150),
      major: clean(record.major, 150),
      education_level: clean(record.education_level, 50),
      study_year: clean(record.study_year, 1),
      gpa: clean(record.gpa, 4),
      active: record.active !== false,
    };
    sisCache.set(studentId, { data: studentRecord, expiresAt: now + 60_000 });
    return studentRecord;
  } catch {
    sisCache.set(studentId, { data: null, expiresAt: now + 30_000 });
    return null;
  }
}
