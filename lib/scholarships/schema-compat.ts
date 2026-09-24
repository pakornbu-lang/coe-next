type QueryError = { code: string; message: string };

// Retry once only for the optional audience columns on pre-migration databases.
// Do not hide permission, connection, or unrelated schema errors.
export async function queryScholarshipSchema<T extends { error: QueryError | null }>(
  columns: string,
  query: (columns: string) => PromiseLike<T>,
): Promise<T> {
  const result = await query(columns);
  const error = result.error;
  if (!error || !["42703", "PGRST204"].includes(error.code) ||
      !/\beligible_(faculties|majors)\b/.test(error.message)) return result;
  return query(columns.split(",").filter(column =>
    column !== "eligible_faculties" && column !== "eligible_majors").join(","));
}
