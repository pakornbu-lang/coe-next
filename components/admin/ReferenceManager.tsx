"use client";

import { useId, useRef, useState } from "react";
import ReferenceForm from "./ReferenceForm";
import { referenceLabels, type ReferenceItem } from "@/lib/admin/types";

function ReferenceDialog({ item }: { item?: ReferenceItem }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [session, setSession] = useState(0);
  const [pending, setPending] = useState(false);
  const open = () => {
    setSession((value) => value + 1);
    dialog.current?.showModal();
  };
  return <>
    <button type="button" className={item ? "btn secondary" : "btn"} onClick={open}>
      {item ? "แก้ไข" : "+ เพิ่มข้อมูล"}
    </button>
    <dialog ref={dialog} className="reference-dialog" aria-labelledby={titleId}
      onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <header className="reference-dialog-heading">
        <div><span className="admin-eyebrow">REFERENCE DATA</span>
          <h2 id={titleId}>{item ? "แก้ไขข้อมูลพื้นฐาน" : "เพิ่มข้อมูลพื้นฐาน"}</h2>
          <p>{item ? referenceLabels[item.kind] : "เลือกหมวดข้อมูลและระบุรายละเอียด"}</p>
        </div>
        <button type="button" className="reference-dialog-close" aria-label="ปิดหน้าต่าง"
          disabled={pending} onClick={() => dialog.current?.close()}>×</button>
      </header>
      <ReferenceForm key={session} item={item} onPendingChange={setPending}
        onCancel={() => dialog.current?.close()} />
    </dialog>
  </>;
}

export default function ReferenceManager({ items }: { items: ReferenceItem[] }) {
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) =>
    (!kind || item.kind === kind) && item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <section className="reference-stats" aria-label="จำนวนข้อมูลแต่ละหมวด">
      {Object.entries(referenceLabels).map(([key, label]) =>
        <div className="admin-card" key={key}><span>{label}</span>
          <strong>{items.filter((item) => item.kind === key).length}</strong></div>)}
    </section>
    <section className="admin-card">
      <div className="reference-toolbar">
        <div><h2>รายการข้อมูลพื้นฐาน</h2><p>แสดง {filtered.length} จาก {items.length} รายการ</p></div>
        <ReferenceDialog />
      </div>
      <div className="reference-filters">
        <label>ค้นหาชื่อ<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาประเภททุน คณะ หรือสาขาวิชา" /></label>
        <label>หมวดข้อมูล<select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">ทุกหมวดข้อมูล</option>
          {Object.entries(referenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      {filtered.length ? <div className="admin-table-scroll"><table>
        <caption className="reference-caption">ประเภททุน คณะ และสาขาวิชา</caption>
        <thead><tr><th scope="col">ชื่อข้อมูล</th><th scope="col">หมวดข้อมูล</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id}>
          <td><strong>{item.name}</strong></td><td>{referenceLabels[item.kind]}</td>
          <td><span className={`admin-badge ${item.active ? "good" : "bad"}`}>{item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></td>
          <td><ReferenceDialog item={item} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">{items.length ? "ไม่พบข้อมูลที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูล กด “+ เพิ่มข้อมูล” เพื่อเริ่มต้น"}</p>}
    </section>
  </>;
}
