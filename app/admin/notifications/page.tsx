import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { retryNotificationEmail } from "@/app/actions/member-notifications";
export const metadata = { title: "ตรวจสอบการส่งแจ้งเตือน" };
export default async function NotificationDeliveryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page)) || 1));
  const client = await createClient();
  const { data, error } = await client.from("notification_email_outbox")
    .select("id,to_email,subject,status,attempts,max_retries,updated_at")
    .eq("status", "failed").order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * 20, page * 20 - 1);
  return <section><h1>ตรวจสอบการส่งแจ้งเตือน</h1>
    <p>รายการอีเมลที่ส่งไม่สำเร็จ · การเข้าคิวใหม่จะรอรอบส่งอีเมลถัดไป</p>
    <Link href="/notifications">กลับการแจ้งเตือนของฉัน</Link>
    {error ? <p role="alert">โหลดรายการไม่ได้ กรุณาตรวจว่าได้ติดตั้ง migration แล้ว</p> :
      !data?.length ? <p>ไม่มีรายการในหน้านี้</p> :
      <div className="panel" style={{ overflowX: "auto" }}><table><thead><tr><th>ผู้รับ</th><th>หัวข้อ</th><th>จำนวนครั้ง</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead>
        <tbody>{data.map(row => <tr key={row.id}><td>{row.to_email}</td><td>{row.subject}</td><td>{row.attempts}/{row.max_retries}</td><td>{row.attempts >= row.max_retries ? "หยุดส่ง ต้องตรวจสอบ" : "รอส่งซ้ำอัตโนมัติ"}</td>
          <td>{row.attempts >= row.max_retries && <form action={retryNotificationEmail}><input type="hidden" name="id" value={row.id} /><button className="btn secondary">เข้าคิวใหม่</button></form>}</td></tr>)}</tbody></table></div>}
    <nav aria-label="หน้ารายการส่งล้มเหลว" style={{ display: "flex", gap: 20 }}>
      {page > 1 && <Link href={`?page=${page - 1}`}>ก่อนหน้า</Link>}<span>หน้า {page}</span>
      {data?.length === 20 && <Link href={`?page=${page + 1}`}>ถัดไป</Link>}
    </nav>
  </section>;
}
