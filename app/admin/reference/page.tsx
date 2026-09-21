import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import ReferenceForm from "@/components/admin/ReferenceForm";
import {referenceLabels,type ReferenceItem} from "@/lib/admin/types";
export default async function ReferencePage(){
 await requireRole(["admin"]);
 const client=await createClient();
 const {data,error}=await client.from("portal_reference_data").select("id,kind,name,active,version").order("kind").order("name").limit(1000);
 if(error) throw Error("โหลดข้อมูลพื้นฐานไม่สำเร็จ");
 return <><div className="admin-heading"><div><span className="admin-eyebrow">REFERENCE DATA</span><h1>จัดการข้อมูลพื้นฐาน</h1><p>เพิ่มและแก้ไขประเภททุน คณะ และสาขาวิชา พร้อมประวัติการเปลี่ยนแปลง</p></div></div>
 <p className="admin-note">ข้อมูลนี้บันทึกในฐานข้อมูลจริง เจ้าหน้าที่เลือกประเภททุนที่เปิดใช้งานได้เมื่อสร้างประกาศทุน</p>
 <div className="admin-columns"><section className="admin-card"><h2>เพิ่มรายการใหม่</h2><ReferenceForm/></section>
 <section><h2>รายการที่มีอยู่ ({data?.length??0})</h2>{!data?.length&&<p className="admin-empty">ยังไม่มีข้อมูล เริ่มเพิ่มรายการแรกได้เลย</p>}
 {(data??[]).map(item=><details className="admin-card" key={item.id}><summary>{item.name} · {referenceLabels[item.kind]} · {item.active?"เปิดใช้งาน":"ปิดใช้งาน"}</summary><ReferenceForm item={item as ReferenceItem}/></details>)}</section></div></>;
}
