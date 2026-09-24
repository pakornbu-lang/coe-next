"use client";
import { useTransition } from "react";

export default function PageError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <section className="panel workflow-empty" role="alert">
    <h1>โหลดข้อมูลไม่สำเร็จ</h1>
    <p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง</p>
    <button type="button" className="btn" disabled={pending} onClick={() => startTransition(() => retry())}>
      {pending ? "กำลังลองใหม่…" : "ลองใหม่"}
    </button>
  </section>;
}
