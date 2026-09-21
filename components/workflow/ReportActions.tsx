"use client";

export default function ReportActions() {
  return <button className="btn secondary" type="button" onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>;
}
