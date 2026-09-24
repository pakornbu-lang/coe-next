"use client";
import { useId, useRef, useState } from "react";

export default function SearchableMultiSelect({ label, name, options, values, onChange, required = false }: {
  label: string; name: string; options: string[]; values: string[]; onChange: (values: string[]) => void; required?: boolean;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const all = [...new Set([...options, ...values])];
  const filtered = all.filter(value => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="searchable-multi">
    <strong id={`${id}-label`}>{label}{required ? " *" : ""}</strong>
    {values.map(value => <input key={value} type="hidden" name={name} value={value}/>)}
    <details ref={details} onKeyDown={event => { if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }}>
      <summary aria-labelledby={`${id}-label`}>เลือก / ค้นหา · เลือกแล้ว {values.length} รายการ</summary>
      <label>ค้นหา{label}<input type="search" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off"/></label>
      <div className="searchable-options">{filtered.map(value => <label key={value}><input type="checkbox" checked={values.includes(value)}
        onChange={event => onChange(event.target.checked ? [...values, value] : values.filter(item => item !== value))}/><span>{value}</span></label>)}
        {!filtered.length && <p>ไม่พบรายการที่ค้นหา</p>}</div>
    </details>
    {values.length > 0 && <div className="selection-tags">{values.map(value => <button key={value} type="button" onClick={() => onChange(values.filter(item => item !== value))} aria-label={`นำ ${value} ออก`}>{value} ×</button>)}</div>}
    {required && values.length === 0 && <p className="workflow-muted">กรุณาเลือกอย่างน้อย 1 รายการ</p>}
  </div>;
}
