import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import ReferenceManager from "@/components/admin/ReferenceManager";
import type { ReferenceItem } from "@/lib/admin/types";

export default async function ReferencePage() {
  await requireRole(["admin"]);
  const client = await createClient();
  const { data, error } = await client.from("portal_reference_data")
    .select("id,kind,name,active,version").order("kind").order("name").limit(1000);
  if (error) throw Error("โหลดข้อมูลพื้นฐานไม่สำเร็จ");
  return <>
    <div className="admin-heading"><div>
      <span className="admin-eyebrow">REFERENCE DATA</span>
      <h1>จัดการข้อมูลพื้นฐาน</h1>
      <p>เพิ่มและแก้ไขประเภททุน คณะ และสาขาวิชา พร้อมประวัติการเปลี่ยนแปลง</p>
    </div></div>
    <p className="admin-note">ข้อมูลนี้บันทึกในฐานข้อมูลจริง เจ้าหน้าที่เลือกประเภททุนที่เปิดใช้งานได้เมื่อสร้างประกาศทุน</p>
    <ReferenceManager items={(data ?? []) as ReferenceItem[]} />
  </>;
}
