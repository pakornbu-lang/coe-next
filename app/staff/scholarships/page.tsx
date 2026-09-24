import Link from "next/link";
import { deleteScholarship } from "@/app/actions/scholarships";
import { requireRole } from "@/lib/auth/server";
import { getScholarship, listStaffScholarships, getAcademicOptions } from "@/lib/scholarships/server";
import { createClient } from "@/lib/supabase/server";
import ScholarshipEditor from "@/components/workflow/ScholarshipEditor";
import { ScholarshipStatusBadge } from "@/components/workflow/StatusBadge";
import { ScholarshipProcessForm } from "@/components/workflow/WorkflowExtensions";

const programLabels: Record<string, string> = {
  academic: "ผลการเรียนดี",
  financial_need: "ขาดแคลนทุนทรัพย์",
  activity: "กิจกรรม",
  talent: "ความสามารถพิเศษ",
  research: "วิจัย",
  emergency: "ฉุกเฉิน",
  general: "ทั่วไป",
};

export const metadata = {
  title: "จัดการทุนการศึกษา",
};

export default async function StaffScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(["staff"]);

  const { edit } = await searchParams;

  const client = await createClient();

  const [scholarships, typesResult, selected, academicOptions] = await Promise.all([
    listStaffScholarships(),

    client
      .from("portal_reference_data")
      .select("id,name")
      .eq("kind", "scholarship_type")
      .eq("active", true)
      .order("name"),

    edit ? getScholarship(edit) : Promise.resolve(null),
    getAcademicOptions(),
  ]);

  /*
   * เรียงทุนที่ปิดรับสมัคร / หมดเวลา
   * ให้อยู่ล่างสุดของรายการ
   */
  // Server-rendered snapshot used only to order the current response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const isScholarshipClosed = (
    item: (typeof scholarships)[number],
  ) => {
    return (
      item.status === "closed" ||
      item.status === "archived" ||
      now >= new Date(item.closes_at).getTime()
    );
  };

  const sortedScholarships = [...scholarships].sort(
    (a, b) => {
      const aClosed = isScholarshipClosed(a);
      const bClosed = isScholarshipClosed(b);

      if (aClosed === bClosed) {
        return 0;
      }

      return aClosed ? 1 : -1;
    },
  );

  return (
    <div className="workflow-stack">
      <section className="panel workflow-heading">
        <div>
          <span className="workflow-eyebrow">
            SCHOLARSHIP MANAGEMENT
          </span>

          <h1>จัดการทุนการศึกษา</h1>

          <p>
            สร้างทุนจากแม่แบบ กำหนดเงื่อนไข อัปโหลดภาพปก
            และติดตามรอบรับสมัครได้ในที่เดียว
          </p>
        </div>

        <Link className="btn" href="/scholarships/new">
          สร้างทุนใหม่
        </Link>
      </section>

      {edit && selected ? (
        <ScholarshipEditor
          scholarship={selected}
          academicOptions={academicOptions}
          types={typesResult.data ?? []}
        />
      ) : (
        <>
          <section className="panel">
            <h2>รายการทุน</h2>

            {scholarships.length ? (
              <div className="workflow-scholarship-admin-list">
                {sortedScholarships.map((item) => (
                  <article
                    className="workflow-scholarship-admin"
                    key={item.id}
                  >
                    <div className="workflow-row-summary">
                      <span>
                        <strong>{item.title}</strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "6px",
                            lineHeight: "1.7",
                          }}
                        >
                          <small style={{ display: "block" }}>
                            ประเภททุน:{" "}
                            {programLabels[item.program_kind] ?? "ทั่วไป"}
                          </small>

                          <small style={{ display: "block" }}>
                            GPA ขั้นต่ำ:{" "}
                            {item.minimum_gpa ?? "ไม่กำหนด"}
                          </small>

                          <small style={{ display: "block" }}>
                            สำนักวิชาที่เปิดรับ:{" "}
                            {item.eligible_faculties?.length
                              ? item.eligible_faculties
                                  .map((faculty) =>
                                    faculty
                                      .replace("สำนักวิชา", "")
                                      .replace("วิทยาลัย", ""),
                                  )
                                  .join(", ")
                              : "ทุกสำนักวิชา / ทุกสาขาวิชา"}
                          </small>
                        </span>
                      </span>

                      <span className="workflow-actions">
                        <ScholarshipStatusBadge
                          status={item.status}
                        />

                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <Link
                            className="btn secondary"
                            href={`/staff/scholarships?edit=${item.id}`}
                          >
                            แก้ไข
                          </Link>

                          <form action={deleteScholarship}>
                            <input
                              type="hidden"
                              name="scholarship_id"
                              value={item.id}
                            />

                            <button
                              type="submit"
                              className="btn secondary"
                              style={{
                                color: "#dc2626",
                                borderColor: "#dc2626",
                              }}
                            >
                              ลบ
                            </button>
                          </form>
                        </span>
                      </span>
                    </div>

                    <ScholarshipProcessForm
                      scholarship={item}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="workflow-empty">
                ยังไม่มีทุน{" "}
                <Link href="/scholarships/new">
                  สร้างทุนแรก
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}