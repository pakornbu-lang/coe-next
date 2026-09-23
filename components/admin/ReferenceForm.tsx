"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveReference } from "@/app/actions/admin";
import { referenceLabels, type ReferenceItem } from "@/lib/admin/types";

export default function ReferenceForm({
  item,
  onCancel,
  onPendingChange,
}: {
  item?: ReferenceItem;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveReference, {
    error: "",
    success: "",
  });

  const isStale =
    state.error.includes("ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น") ||
    state.error.includes("STALE_VERSION");

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (isStale) e.preventDefault();
      }}
      className="admin-edit-form"
    >
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="version" value={item?.version ?? ""} />
      <fieldset
        disabled={pending || Boolean(state.success) || isStale}
        className="reference-fields"
      >
        {item ? (
          <input type="hidden" name="kind" value={item.kind} />
        ) : (
          <label>
            หมวดข้อมูล
            <select name="kind">
              {Object.entries(referenceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          ชื่อข้อมูล
          <input
            name="name"
            defaultValue={item?.name ?? ""}
            required
            maxLength={150}
          />
        </label>
        <label>
          สถานะ
          <select name="active" defaultValue={String(item?.active ?? true)}>
            <option value="true">เปิดใช้งาน</option>
            <option value="false">ปิดใช้งาน</option>
          </select>
        </label>
        <label>
          เหตุผล
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="ระบุเหตุผลในการเพิ่มหรือแก้ไขข้อมูล"
          />
        </label>
      </fieldset>
      {state.error && (
        <div role="alert" className="admin-error">
          <p>{state.error}</p>
          {isStale && (
            <button
              type="button"
              className="btn secondary"
              style={{ marginTop: "8px" }}
              onClick={() => {
                router.refresh();
                onCancel?.();
              }}
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
      <div className="reference-form-actions">
        {onCancel && (
          <button
            type="button"
            className="btn secondary"
            disabled={pending}
            onClick={onCancel}
          >
            {state.success ? "ปิด" : "ยกเลิก"}
          </button>
        )}
        {!state.success && (
          <button className="btn" disabled={pending || isStale}>
            {pending ? "กำลังบันทึก…" : item ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
          </button>
        )}
      </div>
    </form>
  );
}
