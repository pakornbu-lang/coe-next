import Link from "next/link";
import Script from "next/script";
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

export const dynamic = "force-dynamic";

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

  const now = Date.now();

  const openItems = filtered.filter(
    (item) =>
      new Date(item.closes_at).getTime() > now,
  );

  const closedItems = filtered.filter(
    (item) =>
      new Date(item.closes_at).getTime() <= now,
  );

  const renderScholarshipCard = (
    item: (typeof filtered)[number],
    isExpired: boolean,
  ) => (
    <article
      className={`panel workflow-scholarship-card student-scholarship-card ${
        isExpired ? "scholarship-expired" : ""
      }`}
      key={item.id}
      data-scholarship-card
      data-closes-at={item.closes_at}
    >
      {scholarshipCoverUrl(item.cover_path) && (
        <div
          className="workflow-scholarship-cover"
          role="img"
          aria-label={`ภาพประกอบ ${item.title}`}
          style={{
            backgroundImage: `url("${scholarshipCoverUrl(
              item.cover_path,
            )}")`,
          }}
        />
      )}

      <div className="workflow-card-head">
        <span
          className="scholarship-open-status"
          hidden={isExpired}
        >
          <ScholarshipStatusBadge
            status={item.status}
          />
        </span>

        <span
          className="scholarship-expired-status"
          hidden={!isExpired}
        >
          ปิดรับสมัคร
        </span>

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

        <Link
          className="btn scholarship-apply-button"
          href={`/apply?scholarship=${item.id}`}
          hidden={isExpired}
        >
          สมัครทุน
        </Link>

        <span
          className="btn scholarship-closed-button"
          hidden={!isExpired}
          aria-disabled="true"
        >
          ปิดรับสมัคร
        </span>
      </div>
    </article>
  );

  return (
    <div className="workflow-stack">
      <style>{`
        .student-scholarship-card {
          min-width: 0;
          overflow: hidden;
        }

        .student-scholarship-card h2,
        .student-scholarship-card p,
        .student-scholarship-card dt,
        .student-scholarship-card dd {
          max-width: 100%;
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .student-scholarship-card.scholarship-expired {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .student-scholarship-card.scholarship-expired
        .workflow-scholarship-cover {
          filter: grayscale(100%);
          opacity: 0.6;
        }

        .student-scholarship-card.scholarship-expired h2,
        .student-scholarship-card.scholarship-expired p,
        .student-scholarship-card.scholarship-expired dt,
        .student-scholarship-card.scholarship-expired dd {
          color: #6b7280;
        }

        .scholarship-expired-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 700;
          background: #e5e7eb;
          color: #6b7280;
          white-space: nowrap;
        }

        .scholarship-closed-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          cursor: not-allowed;
          background: #d1d5db;
          border-color: #d1d5db;
          color: #6b7280;
          pointer-events: none;
        }

        .scholarship-section-title {
          margin: 12px 0 0;
          color: #14215e;
        }

        .closed-scholarship-section {
          margin-top: 28px;
        }
      `}</style>

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

      {/* =========================
          ทุนที่เปิดรับสมัคร
          ========================= */}

      <h2 className="scholarship-section-title">
        ทุนที่เปิดรับสมัคร
      </h2>

      <div
        className="workflow-card-grid"
        id="open-scholarships-grid"
      >
        {openItems.map((item) =>
          renderScholarshipCard(
            item,
            false,
          ),
        )}
      </div>

      {/* =========================
          ทุนที่ปิดรับสมัคร
          อยู่ล่างสุด
          ========================= */}

      <section
        id="closed-scholarships-section"
        className="closed-scholarship-section"
        hidden={!closedItems.length}
      >
        <h2 className="scholarship-section-title">
          ปิดรับสมัคร
        </h2>

        <div
          className="workflow-card-grid"
          id="closed-scholarships-grid"
        >
          {closedItems.map((item) =>
            renderScholarshipCard(
              item,
              true,
            ),
          )}
        </div>
      </section>

      {!filtered.length && (
        <section className="panel workflow-empty">
          ยังไม่พบทุนที่ตรงกับคำค้นหา
        </section>
      )}

      <Script
        id="scholarship-expiry-check"
        strategy="afterInteractive"
      >
        {`
          function updateScholarshipExpiry() {
            const now = Date.now();

            const openGrid =
              document.getElementById(
                "open-scholarships-grid"
              );

            const closedGrid =
              document.getElementById(
                "closed-scholarships-grid"
              );

            const closedSection =
              document.getElementById(
                "closed-scholarships-section"
              );

            document
              .querySelectorAll(
                "[data-scholarship-card]"
              )
              .forEach((card) => {
                const closesAt =
                  card.getAttribute(
                    "data-closes-at"
                  );

                if (!closesAt) return;

                const closeTime =
                  new Date(
                    closesAt
                  ).getTime();

                const expired =
                  Number.isFinite(
                    closeTime
                  ) &&
                  now >= closeTime;

                if (!expired) {
                  return;
                }

                card.classList.add(
                  "scholarship-expired"
                );

                const openStatus =
                  card.querySelector(
                    ".scholarship-open-status"
                  );

                const expiredStatus =
                  card.querySelector(
                    ".scholarship-expired-status"
                  );

                const applyButton =
                  card.querySelector(
                    ".scholarship-apply-button"
                  );

                const closedButton =
                  card.querySelector(
                    ".scholarship-closed-button"
                  );

                if (openStatus) {
                  openStatus.hidden = true;
                }

                if (expiredStatus) {
                  expiredStatus.hidden =
                    false;
                }

                if (applyButton) {
                  applyButton.hidden =
                    true;
                }

                if (closedButton) {
                  closedButton.hidden =
                    false;
                }

                if (
                  closedGrid &&
                  card.parentElement !==
                    closedGrid
                ) {
                  closedGrid.appendChild(
                    card
                  );
                }

                if (closedSection) {
                  closedSection.hidden =
                    false;
                }
              });
          }

          updateScholarshipExpiry();

          setInterval(
            updateScholarshipExpiry,
            1000
          );
        `}
      </Script>
    </div>
  );
}