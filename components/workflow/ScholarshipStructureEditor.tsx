"use client";

export type RequirementDraft = { label: string; details: string; required: boolean };
export type CriterionDraft = { label: string; details: string; maxScore: string };

export function parseRequirementRows(value: string): RequirementDraft[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label = "", details = "", required = "required"] = line.split("|").map((part) => part.trim());
    return { label, details, required: !["optional", "ไม่บังคับ", "false"].includes(required.toLowerCase()) };
  });
}

export function parseCriterionRows(value: string): CriterionDraft[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label = "", maxScore = "", details = ""] = line.split("|").map((part) => part.trim());
    return { label, details, maxScore };
  });
}

function move<T>(rows: T[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function RequirementEditor({ rows, onChange }: { rows: RequirementDraft[]; onChange: (rows: RequirementDraft[]) => void }) {
  const serialized = rows.map((row) => `${row.label} | ${row.details} | ${row.required ? "required" : "optional"}`).join("\n");
  return <div className="structure-editor"><input type="hidden" name="requirements" value={serialized}/><div className="structure-list">{rows.map((row, index) => <article key={index}><div className="structure-order"><button type="button" onClick={() => onChange(move(rows, index, -1))} disabled={index === 0} aria-label="เลื่อนขึ้น">↑</button><button type="button" onClick={() => onChange(move(rows, index, 1))} disabled={index === rows.length - 1} aria-label="เลื่อนลง">↓</button></div><label>ชื่อเอกสาร *<input required maxLength={150} value={row.label} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, label: event.target.value } : item))}/></label><label>คำอธิบาย<input maxLength={1000} value={row.details} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, details: event.target.value } : item))}/></label><label className="structure-check"><input type="checkbox" checked={row.required} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, required: event.target.checked } : item))}/> เอกสารบังคับ</label><button className="structure-remove" type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length === 1}>ลบ</button></article>)}</div><button className="btn secondary" type="button" onClick={() => onChange([...rows, { label: "", details: "", required: true }])}>+ เพิ่มเอกสาร</button></div>;
}

export function CriterionEditor({ rows, onChange }: { rows: CriterionDraft[]; onChange: (rows: CriterionDraft[]) => void }) {
  const serialized = rows.map((row) => `${row.label} | ${row.maxScore} | ${row.details}`).join("\n");
  const total = rows.reduce((sum, row) => sum + (Number(row.maxScore) || 0), 0);
  return <div className="structure-editor"><input type="hidden" name="criteria" value={serialized}/><div className="structure-list">{rows.map((row, index) => <article key={index}><div className="structure-order"><button type="button" onClick={() => onChange(move(rows, index, -1))} disabled={index === 0} aria-label="เลื่อนขึ้น">↑</button><button type="button" onClick={() => onChange(move(rows, index, 1))} disabled={index === rows.length - 1} aria-label="เลื่อนลง">↓</button></div><label>ชื่อเกณฑ์ *<input required maxLength={150} value={row.label} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, label: event.target.value } : item))}/></label><label>คะแนนเต็ม *<input required type="number" min="0.01" max="1000" step="0.01" value={row.maxScore} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, maxScore: event.target.value } : item))}/></label><label>คำอธิบาย<input maxLength={1000} value={row.details} onChange={(event) => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, details: event.target.value } : item))}/></label><button className="structure-remove" type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length === 1}>ลบ</button></article>)}</div><div className="workflow-section-title"><button className="btn secondary" type="button" onClick={() => onChange([...rows, { label: "", details: "", maxScore: "" }])}>+ เพิ่มเกณฑ์</button><strong>คะแนนรวม {total.toLocaleString("th-TH")}</strong></div></div>;
}
