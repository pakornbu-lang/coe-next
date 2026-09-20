"use client";
import { numericInputProps } from "@/lib/numeric-input";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type ScholarshipDraft = {
  title: string;
  amount: number;
  quota: number;
  deadline: string;
  description: string;
};

export default function ScholarshipForm() {
  const [preview, setPreview] = useState<ScholarshipDraft | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("กรุณาระบุชื่อทุนการศึกษา");
      return;
    }
    setError("");
    setPreview({
      title,
      amount: Number(data.get("amount")),
      quota: Number(data.get("quota")),
      deadline: String(data.get("deadline")),
      description: String(data.get("description") ?? "").trim(),
    });
  }

  function clearPreview() {
    setPreview(null);
    setError("");
  }

  return (
    <div className="portal-form-layout">
      <Card>
        <h2>รายละเอียดทุน</h2>
        <p id="form-help">ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก</p>
        <form className="portal-form" aria-describedby="form-help" onSubmit={handleSubmit} onChange={clearPreview} onReset={clearPreview}>
          <div className="portal-field">
            <label htmlFor="scholarship-title">ชื่อทุนการศึกษา <span aria-hidden="true">*</span></label>
            <input id="scholarship-title" name="title" type="text" maxLength={200} required aria-invalid={Boolean(error)} aria-describedby={error ? "title-error" : undefined} placeholder="เช่น ทุนส่งเสริมโอกาสทางการศึกษา" />
            {error && <p id="title-error" className="portal-field-error" role="alert">{error}</p>}
          </div>
          <div className="portal-grid-two">
            <div className="portal-field">
              <label htmlFor="scholarship-amount">จำนวนเงินต่อทุน (บาท) <span aria-hidden="true">*</span></label>
              <input id="scholarship-amount" name="amount" type="number" {...numericInputProps("decimal")} min="0.01" step="0.01" required placeholder="เช่น 10000" />
            </div>
            <div className="portal-field">
              <label htmlFor="scholarship-quota">จำนวนโควตา (คน) <span aria-hidden="true">*</span></label>
              <input id="scholarship-quota" name="quota" type="number" {...numericInputProps()} min="1" step="1" required placeholder="เช่น 20" />
            </div>
          </div>
          <div className="portal-field">
            <label htmlFor="scholarship-deadline">วันสิ้นสุดการรับสมัคร <span aria-hidden="true">*</span></label>
            <input id="scholarship-deadline" name="deadline" type="date" required />
          </div>
          <div className="portal-field">
            <label htmlFor="scholarship-description">รายละเอียดและคุณสมบัติ</label>
            <textarea id="scholarship-description" name="description" rows={5} maxLength={5000} placeholder="ระบุคุณสมบัติผู้สมัคร เงื่อนไขทุน และเอกสารที่ต้องใช้" />
          </div>
          <div className="portal-form-actions">
            <Button type="submit">ดูตัวอย่างประกาศ</Button>
            <Button type="reset" variant="secondary">ล้างข้อมูล</Button>
            <Link className="portal-text-link" href="/">กลับแดชบอร์ด</Link>
          </div>
        </form>
      </Card>
      <aside className="portal-page-stack" aria-label="ตัวอย่างประกาศทุน">
        <Card className="portal-help-card">
          <span className="portal-badge">หน้าตัวอย่าง</span>
          <h2>ตรวจข้อมูลก่อนประกาศ</h2>
          <p>กรอกรายละเอียดแล้วกดดูตัวอย่างประกาศ ข้อมูลจะอยู่ในหน้านี้เท่านั้น ยังไม่ได้บันทึกหรือเผยแพร่ในระบบ</p>
        </Card>
        <div aria-live="polite" aria-atomic="true">
          {preview && (
            <Card className="portal-preview-card">
              <span className="portal-eyebrow">ตัวอย่างประกาศ</span>
              <h2>{preview.title}</h2>
              <dl className="portal-summary">
                <div><dt>จำนวนเงินต่อทุน</dt><dd>{preview.amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</dd></div>
                <div><dt>จำนวนโควตา</dt><dd>{preview.quota.toLocaleString("th-TH")} คน</dd></div>
                <div><dt>สิ้นสุดการรับสมัคร</dt><dd><time dateTime={preview.deadline}>{new Date(preview.deadline + "T00:00:00").toLocaleDateString("th-TH", { dateStyle: "long" })}</time></dd></div>
              </dl>
              {preview.description && <p className="portal-preserve-lines">{preview.description}</p>}
              <p className="portal-preview-note">ตัวอย่างนี้ยังไม่ได้บันทึกลงระบบ</p>
            </Card>
          )}
        </div>
      </aside>
    </div>
  );
}
