"use client";

export function nextScore(value: string, direction: number, max: number) {
  return String(Math.round(Math.min(max, Math.max(0, (Number(value) || 0) + direction * 0.5)) * 100) / 100);
}

export default function ScoreInput({ value, onChange, max, disabled, label }: {
  value: string; onChange: (value: string) => void; max: number; disabled: boolean; label: string;
}) {
  return <div className="score-stepper">
    <button type="button" className="btn secondary" disabled={disabled || Number(value) <= 0}
      aria-label={`ลดคะแนน ${label} ครั้งละ 0.5`} onClick={() => onChange(nextScore(value, -1, max))}>−</button>
    <input type="number" inputMode="decimal" required disabled={disabled} aria-label={`คะแนน ${label}`}
      min={0} max={max} step="any" value={value} onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault(); onChange(nextScore(value, event.key === "ArrowUp" ? 1 : -1, max));
        }
      }}/>
    <button type="button" className="btn secondary" disabled={disabled || Number(value) >= max}
      aria-label={`เพิ่มคะแนน ${label} ครั้งละ 0.5`} onClick={() => onChange(nextScore(value, 1, max))}>+</button>
  </div>;
}
