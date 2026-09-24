import Link from "next/link";
import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import {actionLabels} from "@/lib/admin/types";

const fields:Record<string,string>={
  full_name:"ชื่อ–นามสกุล",
  student_id:"รหัสประจำตัว",
  email:"อีเมล",
  role:"บทบาท",
  active:"เปิดใช้งาน",
  pending_role:"บทบาทรออนุมัติ",
  name:"ชื่อข้อมูล",
  kind:"หมวดข้อมูล"
};

Object.assign(fields,{
  phone:"เบอร์โทรศัพท์",
  department:"หน่วยงาน",
  position:"ตำแหน่ง",
  expertise:"ความเชี่ยวชาญ",
  avatar_path:"ไฟล์รูปโปรไฟล์",
  address:"ที่อยู่ติดต่อ",
  major:"สาขาวิชา",
  education_level:"ระดับการศึกษา",
  study_year:"ชั้นปี",
  gpa:"เกรดเฉลี่ย",
  parent_status:"สถานะบิดามารดา",
  parent_status_other:"รายละเอียดสถานะบิดามารดา"
});

function display(value:unknown){
  if(value===null||value===undefined)return "—";
  if(typeof value==="boolean")return value?"ใช่":"ไม่";
  return String(value);
}

export default async function AuditPage({
  searchParams
}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}){
  await requireRole(["admin"]);

  const params=await searchParams;

  const page=Math.max(
    1,
    Math.min(10000,Math.floor(Number(params.page))||1)
  );

  const client=await createClient();

  const {data,error,count}=await client
    .from("portal_audit_log")
    .select(
      "id,actor_name,action,target_id,before_data,after_data,reason,created_at",
      {count:"exact"}
    )
    .order("created_at",{ascending:false})
    .order("id",{ascending:false})
    .range((page-1)*30,page*30-1);

  if(error)throw Error("โหลดประวัติไม่สำเร็จ");

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">
            AUDIT HISTORY
          </span>

          <h1>ประวัติการแก้ไข</h1>

          <p>
            ตรวจสอบผู้ทำรายการ เวลา เหตุผล และค่าก่อน–หลัง ·
            ประวัติในหน้านี้แก้ไขหรือลบไม่ได้
          </p>
        </div>
      </div>

      <p>
        {count??0} รายการ · หน้า {page}
      </p>

      {(data??[]).map(row=>
        <article className="admin-card" key={row.id}>
          <header>
            <div>
              <h2>
                {actionLabels[row.action]??row.action}
              </h2>

              <p>
                โดย {row.actor_name} ·{" "}
                {new Date(row.created_at).toLocaleString(
                  "th-TH",
                  {timeZone:"Asia/Bangkok"}
                )}
              </p>
            </div>

            <span className="admin-badge">
              #{row.id}
            </span>
          </header>

          <p>
            เหตุผล: {row.reason}
          </p>

          <p className="admin-muted">
            รายการ:{" "}
            {row.after_data?.full_name??
             row.after_data?.name??
             row.target_id}
          </p>

          <details>
            <summary>
              ดูสิ่งที่เปลี่ยนแปลง
            </summary>

            <div className="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ข้อมูล</th>
                    <th>ก่อนแก้ไข</th>
                    <th>หลังแก้ไข</th>
                  </tr>
                </thead>

                <tbody>
                  {Object.entries(fields)
                    .filter(
                      ([field])=>
                        JSON.stringify(
                          row.before_data?.[field]
                        )!==
                        JSON.stringify(
                          row.after_data?.[field]
                        )
                    )
                    .map(([field,label])=>
                      <tr key={field}>
                        <th>{label}</th>
                        <td>
                          {display(
                            row.before_data?.[field]
                          )}
                        </td>
                        <td>
                          {display(
                            row.after_data?.[field]
                          )}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      )}

      {!data?.length&&
        <p className="admin-empty">
          ยังไม่มีประวัติการแก้ไข
        </p>
      }

      <nav
        className="admin-pagination"
        aria-label="หน้าประวัติ"
      >
        {page>1&&
          <Link
            href={
              "/admin/audit?page="+(page-1)
            }
          >
            ← ก่อนหน้า
          </Link>
        }

        {page*30<(count??0)&&
          <Link
            href={
              "/admin/audit?page="+(page+1)
            }
          >
            ถัดไป →
          </Link>
        }
      </nav>
    </>
  );
}