import "server-only";

function cell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
}

export function csvResponse(fileName: string, rows: unknown[][]) {
  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
