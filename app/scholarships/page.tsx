import Link from "next/link";
import { listPublishedScholarships } from "@/lib/scholarships/server";
import {
  money,
  scholarshipCoverUrl,
  thaiDate,
} from "@/lib/scholarships/types";
import { ScholarshipStatusBadge } from "@/components/workflow/StatusBadge";

const programLabels: Record<string, string> = {
  academic: "ผลการเรียนดี",
  financial_need: "ขาดแคลนทุนทรัพย์",
  activity: "กิจกรรมและความเป็นผู้นำ",
  talent: "ความสามารถพิเศษ",
  research: "วิจัยและนวัตกรรม",
  emergency: "ฉุกเฉิน",
  general: "ทั่วไป",
};

export const metadata = {
  title: "ทุนการศึกษา",
};

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const items = await listPublishedScholarships();

  const search = q
    .trim()
    .toLocaleLowerCase("th-TH");

  const filtered = search
    ? items.filter((item) =>
        `${item.title} ${item.description} ${item.eligibility}`
          .toLocaleLowerCase("th-TH")
          .includes(search),
      )
    : items;

  return (
    <div className="workflow-stack">
      <section className="workflow-heading panel">
        <div>
          <span className="workflow-eyebrow">
            SCHOLARSHIPS
          </span>

          <h1>ค้นหาทุนการศึกษา</h1>

          <p>
            เลือกทุนที่เหมาะกับคุณ
            และตรวจสอบคุณสมบัติก่อนเริ่มสมัคร
          </p>
        </div>
      </section>

      <form
        className="workflow-search"
        method="get"
      >
        <label>
          ค้นหาทุน
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="ชื่อทุน คุณสมบัติ หรือคำสำคัญ"
          />
        </label>

        <button className="btn">
          ค้นหา
        </button>
      </form>

      <p className="workflow-count">
        พบ {filtered.length} ทุน
      </p>

      <div className="workflow-card-grid">
        {filtered.map((item) => {
          const isExpired =
            new Date(item.closes_at).getTime() <= Date.now();

          return (
            <article
              className="panel workflow-scholarship-card"
              key={item.id}
              style={
                isExpired
                  ? {
                      background: "#f3f4f6",
                      borderColor: "#d1d5db",
                    }
                  : undefined
              }
            >
              {scholarshipCoverUrl(
                item.cover_path,
              ) && (
                <div
                  className="workflow-scholarship-cover"
                  role="img"
                  aria-label={`ภาพประกอบ ${item.title}`}
                  style={{
                    backgroundImage: `url("${scholarshipCoverUrl(
                      item.cover_path,
                    )}")`,
                    ...(isExpired
                      ? {
                          filter: "grayscale(100%)",
                          opacity: 0.65,
                        }
                      : {}),
                  }}
                />
              )}

              <div className="workflow-card-head">
                {isExpired ? (
                  <span
                    className="workflow-status"
                    style={{
                      background: "#e5e7eb",
                      color: "#6b7280",
                    }}
                  >
                    หมดเวลารับสมัคร
                  </span>
                ) : (
                  <ScholarshipStatusBadge
                    status={item.status}
                  />
                )}

                {item.minimum_gpa !== null && (
                  <span>
                    GPA ขั้นต่ำ{" "}
                    {item.minimum_gpa.toFixed(2)}
                  </span>
                )}
              </div>

              <h2>{item.title}</h2>

              <p>
                {item.description ||
                  "ดูรายละเอียดคุณสมบัติและขั้นตอนสมัคร"}
              </p>

              <dl>
                <div>
                  <dt>ประเภททุน</dt>
                  <dd>
                    {programLabels[
                      item.program_kind
                    ] ?? "ทั่วไป"}
                  </dd>
                </div>

                <div>
                  <dt>จำนวนทุน</dt>
                  <dd>{item.quota} คน</dd>
                </div>

                <div>
                  <dt>มูลค่าต่อทุน</dt>
                  <dd>
                    {money(item.amount)} บาท
                  </dd>
                </div>

                <div>
                  <dt>เปิดรับสมัคร</dt>
                  <dd>
                    {thaiDate(
                      item.opens_at,
                      true,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>ปิดรับสมัคร</dt>
                  <dd>
                    {thaiDate(
                      item.closes_at,
                      true,
                    )}
                  </dd>
                </div>
              </dl>

              <div className="workflow-actions">
                <Link
                  className="btn secondary"
                  href={`/scholarships/${item.id}`}
                >
                  ดูรายละเอียด
                </Link>

                {!isExpired && (
                  <Link
                    className="btn"
                    href={`/apply?scholarship=${item.id}`}
                  >
                    สมัครทุน
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <section className="panel workflow-empty">
          ยังไม่พบทุนที่ตรงกับคำค้นหา
        </section>
      )}
    </div>
  );
}