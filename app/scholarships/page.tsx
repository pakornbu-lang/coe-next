import Link from "next/link";
import Script from "next/script";
import { listPublishedScholarships } from "@/lib/scholarships/server";
import {
  getScholarshipTimeState,
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

export const revalidate = 60;

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
}) {
  const {
    q = "",
    status = "all",
  } = await searchParams;

  const items =
    await listPublishedScholarships();

  const search = q
    .trim()
    .toLocaleLowerCase("th-TH");

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  /*
   * กำหนดสถานะของทุนตามวันและเวลา
   *
   * upcoming = ยังไม่ถึงวันเปิดรับสมัคร
   * open     = อยู่ในช่วงเปิดรับสมัคร
   * closed   = หมดเวลาแล้ว หรือเจ้าหน้าที่ปิดทุน
   */
  const scholarshipState = (
    item: (typeof items)[number],
  ) => {
    return getScholarshipTimeState(item, now);
  };

  /*
   * ค้นหาทุนก่อน
   */
  const searchedItems = search
    ? items.filter((item) =>
        `${item.title} ${item.description} ${item.eligibility}`
          .toLocaleLowerCase("th-TH")
          .includes(search),
      )
    : items;

  /*
   * แยกทุนแต่ละสถานะ
   */
  const openItems = searchedItems.filter(
    (item) =>
      scholarshipState(item) ===
      "open",
  );

  const upcomingItems =
    searchedItems.filter(
      (item) =>
        scholarshipState(item) ===
        "upcoming",
    );

  const closedItems =
    searchedItems.filter(
      (item) =>
        scholarshipState(item) ===
        "closed",
    );

  /*
   * กรองตามสถานะ
   *
   * ทั้งหมด:
   * เปิดรับสมัคร -> ยังไม่เปิดรับสมัคร -> ปิดรับสมัคร
   *
   * ตัวเลือกอื่น:
   * แสดงเฉพาะสถานะที่เลือก
   */
  const filtered =
    status === "open"
      ? openItems
      : status === "upcoming"
        ? upcomingItems
        : status === "closed"
          ? closedItems
          : [
              ...openItems,
              ...upcomingItems,
              ...closedItems,
            ];

  /*
   * ชื่อหัวข้อตามตัวกรอง
   */
  const sectionTitle =
    status === "open"
      ? "เปิดรับสมัคร"
      : status === "upcoming"
        ? "ยังไม่เปิดรับสมัคร"
        : status === "closed"
          ? "ปิดรับสมัคร"
          : "ทุนทั้งหมด";

  /*
   * การ์ดทุน
   */
  const renderScholarshipCard = (
    item: (typeof items)[number],
  ) => {
    const currentState =
      scholarshipState(item);

    const isOpen =
      currentState === "open";

    const isUpcoming =
      currentState === "upcoming";

    const isClosed =
      currentState === "closed";

    return (
      <article
        className={`panel workflow-scholarship-card student-scholarship-card ${
          isClosed
            ? "scholarship-expired"
            : ""
        }`}
        key={item.id}
        data-scholarship-card
        data-scholarship-id={item.id}
        data-opens-at={
          item.opens_at
        }
        data-closes-at={
          item.closes_at
        }
        data-state={
          currentState
        }
        data-status={
          item.status
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
            }}
          />
        )}

        <div className="workflow-card-head">
          {isOpen && (
            <ScholarshipStatusBadge
              status={item.status}
            />
          )}

          {isUpcoming && (
            <span className="scholarship-upcoming-status" data-scholarship-badge>
              ยังไม่เปิดรับสมัคร
            </span>
          )}

          {isClosed && (
            <span className="scholarship-expired-status" data-scholarship-badge>
              ปิดรับสมัคร
            </span>
          )}

          {item.minimum_gpa !==
            null && (
            <span>
              GPA ขั้นต่ำ{" "}
              {item.minimum_gpa.toFixed(
                2,
              )}
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
            <dd>
              {item.quota} คน
            </dd>
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

          <span data-apply-button-slot>
            {/* เปิดรับสมัคร */}
            {isOpen && (
              <Link
                className="btn"
                href={`/apply?scholarship=${item.id}`}
              >
                สมัครทุน
              </Link>
            )}

            {/* ยังไม่เปิดรับสมัคร */}
            {isUpcoming && (
              <span
                className="btn scholarship-upcoming-button"
                aria-disabled="true"
              >
                ยังไม่เปิดรับสมัคร
              </span>
            )}

            {/* ปิดรับสมัคร */}
            {isClosed && (
              <span
                className="btn scholarship-closed-button"
                aria-disabled="true"
              >
                ปิดรับสมัคร
              </span>
            )}
          </span>
        </div>
      </article>
    );
  };

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

        /* ปิดรับสมัคร */
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

        /* ยังไม่เปิดรับสมัคร */
        .scholarship-upcoming-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 700;
          background: #fff4dc;
          color: #835f13;
          white-space: nowrap;
        }

        .scholarship-upcoming-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          cursor: not-allowed;
          background: #eef0f4;
          border-color: #d1d5db;
          color: #6b7280;
          pointer-events: none;
        }

        .scholarship-status-section {
          display: grid;
          gap: 14px;
        }

        .scholarship-status-title {
          margin: 0;
          color: #14215e;
          font-size: 24px;
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

      {/* =========================
          ค้นหา + ตัวกรองสถานะ
          ========================= */}

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

        <label>
          สถานะทุน
          <select
            name="status"
            defaultValue={status}
          >
            <option value="all">
              ทั้งหมด
            </option>

            <option value="open">
              เปิดรับสมัคร
            </option>

            <option value="upcoming">
              ยังไม่เปิดรับสมัคร
            </option>

            <option value="closed">
              ปิดรับสมัคร
            </option>
          </select>
        </label>

        <button className="btn">
          ค้นหา
        </button>
      </form>

      <p className="workflow-count">
        พบ {filtered.length} ทุน
      </p>

      {/* =========================
          แสดงทุนตามตัวกรอง
          ========================= */}

      <section className="scholarship-status-section">
        <h2 className="scholarship-status-title">
          {sectionTitle}
        </h2>

        {filtered.length ? (
          <div className="workflow-card-grid">
            {filtered.map((item) =>
              renderScholarshipCard(
                item,
              ),
            )}
          </div>
        ) : (
          <div className="panel workflow-empty">
            {status === "open"
              ? "ไม่มีทุนที่เปิดรับสมัคร"
              : status === "upcoming"
                ? "ไม่มีทุนที่ยังไม่เปิดรับสมัคร"
                : status === "closed"
                  ? "ไม่มีทุนที่ปิดรับสมัคร"
                  : "ยังไม่พบทุนที่ตรงกับคำค้นหา"}
          </div>
        )}
      </section>

      {/* =========================
          เช็กเวลาอัตโนมัติ
          ========================= */}

      <Script
        id="scholarship-time-check"
        strategy="afterInteractive"
      >
        {`
          const activeFilter = ${JSON.stringify(status)};

          function updateScholarshipTimeStatus() {
            const now = Date.now();
            let nextMilestone = null;
            let filterNeedsReload = false;

            document
              .querySelectorAll("[data-scholarship-card]")
              .forEach((card) => {
                const opensAt = card.getAttribute("data-opens-at");
                const closesAt = card.getAttribute("data-closes-at");
                const scholarshipStatus = card.getAttribute("data-status");
                const scholarshipId = card.getAttribute("data-scholarship-id");

                if (!opensAt || !closesAt) return;

                const openTime = new Date(opensAt).getTime();
                const closeTime = new Date(closesAt).getTime();

                if (openTime > now && (nextMilestone === null || openTime < nextMilestone)) {
                  nextMilestone = openTime;
                }
                if (closeTime > now && (nextMilestone === null || closeTime < nextMilestone)) {
                  nextMilestone = closeTime;
                }

                let nextState = "open";
                if (scholarshipStatus === "closed" || now >= closeTime) {
                  nextState = "closed";
                } else if (now < openTime) {
                  nextState = "upcoming";
                }

                if (card.getAttribute("data-state") !== nextState) {
                  if (activeFilter !== "all") {
                    filterNeedsReload = true;
                    return;
                  }

                  card.setAttribute("data-state", nextState);
                  const badge = card.querySelector("[data-scholarship-badge]") || card.querySelector(".workflow-status");
                  if (badge) {
                    if (nextState === "closed") {
                      badge.textContent = "ปิดรับสมัครแล้ว";
                      badge.className = "workflow-status scholarship-closed";
                    } else if (nextState === "upcoming") {
                      badge.textContent = "ยังไม่เปิดรับ";
                      badge.className = "workflow-status scholarship-draft";
                    } else {
                      badge.textContent = "เปิดรับสมัคร";
                      badge.className = "workflow-status scholarship-published";
                    }
                  }

                  const btnSlot = card.querySelector("[data-apply-button-slot]");
                  if (btnSlot) {
                    if (nextState === "closed") {
                      btnSlot.innerHTML = '<span class="btn scholarship-closed-button" aria-disabled="true">ปิดรับสมัคร</span>';
                    } else if (nextState === "upcoming") {
                      btnSlot.innerHTML = '<span class="btn scholarship-upcoming-button" aria-disabled="true">ยังไม่เปิดรับสมัคร</span>';
                    } else {
                      btnSlot.innerHTML = '<a class="btn" href="/apply?scholarship=' + encodeURIComponent(scholarshipId || "") + '">สมัครทุน</a>';
                    }
                  }

                  if (nextState === "closed") {
                    card.classList.add("scholarship-expired");
                  } else {
                    card.classList.remove("scholarship-expired");
                  }
                }
              });

            if (filterNeedsReload) {
              window.location.reload();
              return;
            }

            if (nextMilestone !== null) {
              const delay = Math.max(200, nextMilestone - now + 500);
              if (delay <= 2147483647) {
                setTimeout(() => {
                  updateScholarshipTimeStatus();
                }, delay);
              }
            }
          }

          updateScholarshipTimeStatus();
        `}
      </Script>
    </div>
  );
}