import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStudentApplicationsPaginated } from "@/lib/scholarships/server";
import { thaiDate } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "ใบสมัครของฉัน" };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(["student"]);
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pageSize = 10;

  const { applications, total, totalPages } = await listStudentApplicationsPaginated({
    page,
    pageSize,
  });

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="workflow-stack">
      <section className="panel workflow-heading">
        <div>
          <span className="workflow-eyebrow">MY APPLICATIONS</span>
          <h1>ใบสมัครของฉัน</h1>
          <p>
            ดูสถานะ เอกสาร และผลการพิจารณาของทุกใบสมัคร
            {total > 0 && ` (ทั้งหมด ${total} รายการ)`}
          </p>
        </div>
        <Link className="btn" href="/scholarships">
          ค้นหาทุน
        </Link>
      </section>

      {applications.length > 0 ? (
        <>
          <div className="workflow-row-list workflow-list-large">
            {applications.map((item) => (
              <Link key={item.id} href={`/applications/${item.id}`}>
                <span>
                  <strong>{item.scholarship?.title ?? "ทุนการศึกษา"}</strong>
                  <small>
                    ใบสมัคร #{item.application_no} · อัปเดต {thaiDate(item.updated_at, true)}
                  </small>
                </span>
                <ApplicationStatusBadge status={item.status} />
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="workflow-pagination" aria-label="การแบ่งหน้าใบสมัคร">
              <div className="workflow-pagination-info">
                หน้า {page} จาก {totalPages} (แสดง {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} จาก {total} รายการ)
              </div>
              <div className="workflow-pagination-controls">
                {hasPrevious ? (
                  <Link
                    className="btn secondary"
                    href={`/applications?page=${page - 1}`}
                  >
                    ← ก่อนหน้า
                  </Link>
                ) : (
                  <span className="btn secondary disabled" aria-disabled="true">
                    ← ก่อนหน้า
                  </span>
                )}

                {hasNext ? (
                  <Link
                    className="btn secondary"
                    href={`/applications?page=${page + 1}`}
                  >
                    ถัดไป →
                  </Link>
                ) : (
                  <span className="btn secondary disabled" aria-disabled="true">
                    ถัดไป →
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      ) : (
        <section className="panel workflow-empty">
          {page > 1 ? (
            <>
              <p>ไม่พบรายการในหน้านี้</p>
              <Link className="btn" href="/applications?page=1">
                กลับไปหน้าแรก
              </Link>
            </>
          ) : (
            <>
              ยังไม่มีใบสมัคร <Link href="/scholarships">เริ่มค้นหาทุนที่เปิดรับ</Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}
