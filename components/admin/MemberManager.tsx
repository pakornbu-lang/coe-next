"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMember } from "@/app/actions/admin";
import { roleLabels } from "@/lib/auth/types";
import type { Member } from "@/lib/admin/types";
import { numericInputProps } from "@/lib/numeric-input";

const initial = { error: "", success: "" };

function MemberCard({ member: m }: { member: Member }) {
  const router = useRouter();
  const [operation, setOperation] = useState("edit_identity");

  const [state, action, pending] = useActionState(
    async (previous: typeof initial, form: FormData) => {
      const result = await updateMember(previous, form);

      if (result.success) {
        setOperation("edit_identity");
      }

      return result;
    },
    initial,
  );

  const protectedAccount = m.role === "admin";

  const isStale =
    state.error.includes("ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น") ||
    state.error.includes("STALE_VERSION");

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <article className="admin-card">
      <header>
        <div>
          <h2>{m.full_name}</h2>
          <p>
            {m.student_id} · {m.email}
          </p>
        </div>

        <div className="admin-badges">
          <span className="admin-badge">{roleLabels[m.role]}</span>

          <span className={"admin-badge " + (m.active ? "good" : "bad")}>
            {m.active ? "เปิดใช้งาน" : "ระงับบัญชี"}
          </span>
        </div>
      </header>

      {m.pending_role && (
        <p className="admin-pending">
          มีคำขอบทบาทเดิม: {roleLabels[m.pending_role]} ·
          เลือกบทบาทแล้วบันทึกและอนุมัติได้เลย
        </p>
      )}

      {protectedAccount ? (
        <p className="admin-note">
          บัญชี Admin ได้รับการป้องกัน
          ไม่สามารถเปลี่ยนสิทธิ์หรือระงับจากหน้านี้
        </p>
      ) : (
        <details>
          <summary>จัดการบัญชี / อนุมัติบทบาท</summary>

          <form
            action={action}
            className="admin-edit-form"
            onSubmit={(event) => {
              if (isStale || state.success) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={m.id} />

            <input
              type="hidden"
              name="version"
              value={m.version}
            />

            <label>
              รายการที่ต้องการทำ

              <select
                name="action"
                value={operation}
                disabled={pending || isStale || Boolean(state.success)}
                onChange={(event) =>
                  setOperation(event.target.value)
                }
              >
                <option value="edit_identity">
                  แก้ไขชื่อและรหัสนักศึกษา
                </option>

                {m.active && (
                  <option value="set_role">
                    กำหนดบทบาทและอนุมัติทันที
                  </option>
                )}

                <option value={m.active ? "suspend" : "activate"}>
                  {m.active ? "ระงับบัญชี" : "เปิดใช้งานบัญชี"}
                </option>
              </select>
            </label>

            {operation === "set_role" && (
              <label>
                บทบาทที่ต้องการกำหนด

                <select
                  name="value"
                  defaultValue={m.pending_role ?? m.role}
                  disabled={pending || isStale || Boolean(state.success)}
                >
                  <option value="student">
                    Student — นักศึกษา
                  </option>

                  <option value="staff">
                    Officer — เจ้าหน้าที่ทุน
                  </option>

                  <option value="committee">
                    Committee — กรรมการ
                  </option>
                </select>
              </label>
            )}

            {operation === "edit_identity" && (
              <>
                <label>
                  ชื่อ–นามสกุล

                  <input
                    name="full_name"
                    defaultValue={m.full_name}
                    required
                    maxLength={200}
                    disabled={pending || isStale || Boolean(state.success)}
                  />
                </label>

                <label>
                  รหัสนักศึกษา / รหัสประจำตัว

                  <input
                    name="student_id"
                    {...numericInputProps()}
                    defaultValue={m.student_id}
                    required
                    pattern="[0-9]{8,12}"
                    maxLength={12}
                    disabled={pending || isStale || Boolean(state.success)}
                  />
                </label>
              </>
            )}

            {operation === "set_role" && (
              <p className="admin-note">
                การบันทึกถือเป็นการอนุมัติ
                บัญชีนี้จะใช้บทบาทที่เลือกแทนบทบาทเดิมทันที
                ในการเปิดหน้าหรือทำรายการครั้งถัดไป
              </p>
            )}

            {operation === "suspend" && (
              <p className="admin-pending">
                บัญชีนี้จะไม่สามารถเข้าหน้าสำหรับสมาชิก
                หรือใช้สิทธิ์เดิมได้ในการร้องขอครั้งถัดไป
              </p>
            )}

            <label>
              เหตุผลที่บันทึกในประวัติ

              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                placeholder="ระบุเหตุผลหรือข้อมูลการตรวจสอบ"
                disabled={pending || isStale || Boolean(state.success)}
              />
            </label>

            <button
              className="btn"
              disabled={pending || isStale || Boolean(state.success)}
            >
              {pending
                ? "กำลังบันทึก…"
                : operation === "set_role"
                  ? "บันทึกและอนุมัติ"
                  : "ยืนยันรายการ"}
            </button>

            {state.error && (
              <div role="alert" className="admin-error">
                <p>{state.error}</p>

                {isStale && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ marginTop: "8px" }}
                    onClick={() => router.refresh()}
                  >
                    🔄 รีเฟรชข้อมูลล่าสุด
                  </button>
                )}
              </div>
            )}

            {state.success && (
              <p role="status" className="admin-success">
                {state.success}
              </p>
            )}
          </form>
        </details>
      )}
    </article>
  );
}

export default function MemberManager({
  members,
}: {
  members: Member[];
}) {
  return (
    <div className="admin-members">
      {members.length ? (
        members.map((member) => (
          <MemberCard
            key={`${member.id}:${member.version}`}
            member={member}
          />
        ))
      ) : (
        <p className="admin-empty">
          ไม่พบสมาชิกที่ตรงกับเงื่อนไข
        </p>
      )}
    </div>
  );
}