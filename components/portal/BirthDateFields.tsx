"use client";

import { useId, useState } from "react";

const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
type Parts = { year: string; month: string; day: string };
const pad = (value: number) => String(value).padStart(2, "0");

function limits(parts: Parts, today: Parts) {
  const month = parts.year === today.year ? Number(today.month) : 12;
  const year = Number(parts.year || 2000);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const day = parts.year === today.year && parts.month === today.month
    ? Number(today.day) : days[Number(parts.month) - 1] ?? 31;
  return { month, day };
}

export default function BirthDateFields({ value, currentDate, onChange }: {
  value: string;
  currentDate: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [parts, setParts] = useState<Parts>(() => {
    const [year = "", month = "", day = ""] = value.split("-");
    return { year, month, day };
  });
  const [year, month, day] = currentDate.split("-");
  const today = { year, month, day };
  const max = limits(parts, today);
  const earliestYear = Math.min(1900, Number(parts.year || year));
  function change(key: keyof Parts, selected: string) {
    const next = { ...parts, [key]: selected };
    if (Number(next.month) > limits(next, today).month) next.month = "";
    if (Number(next.day) > limits(next, today).day) next.day = "";
    setParts(next);
    onChange(next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "");
  }
  return <fieldset className="birth-date-fields wide">
    <legend>วันเกิด <b>*</b></legend>
    <div className="birth-date-selects">
      <label htmlFor={`${id}-day`}>วัน
        <select id={`${id}-day`} name="birth_day" autoComplete="bday-day" value={parts.day} onChange={e => change("day", e.target.value)} required>
          <option value="">เลือกวัน</option>
          {Array.from({ length: max.day }, (_, i) => <option key={i + 1} value={pad(i + 1)}>{i + 1}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-month`}>เดือน
        <select id={`${id}-month`} name="birth_month" autoComplete="bday-month" value={parts.month} onChange={e => change("month", e.target.value)} required>
          <option value="">เลือกเดือน</option>
          {months.slice(0, max.month).map((name, i) => <option key={name} value={pad(i + 1)}>{name}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-year`}>ปี พ.ศ.
        <select id={`${id}-year`} name="birth_year" autoComplete="bday-year" value={parts.year} onChange={e => change("year", e.target.value)} required>
          <option value="">เลือกปี</option>
          {Array.from({ length: Number(year) - earliestYear + 1 }, (_, i) => <option key={Number(year) - i} value={Number(year) - i}>{Number(year) - i + 543}</option>)}
        </select>
      </label>
    </div>
    <input type="hidden" name="birth" value={value} />
  </fieldset>;
}
