"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireViewer, invalidateViewerCache } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { prepareAvatar, MAX_AVATAR_BYTES } from "@/lib/account/avatar.mjs";
import type { ProfileState } from "@/lib/account/types";

export async function updateMyProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const viewer = await requireViewer();
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const phone = value("phone"), department = value("department"), position = viewer.role === "student" ? "" : value("position");
  const details: Record<string, string> = { address: value("address") };
  if (viewer.role === "student") for (const key of ["major", "education_level", "study_year", "gpa", "parent_status", "parent_status_other"]) details[key] = value(key);
  const expertise = viewer.role === "committee" ? value("expertise") : "";
  const version = Number(value("version"));
  const fail = (error: string): ProfileState => ({ error, success: "", version: _previous.version });
  if (details.address.length > 500 || (details.major?.length ?? 0) > 150 || (details.education_level?.length ?? 0) > 50 || (details.parent_status_other?.length ?? 0) > 150) return fail("ข้อมูลยาวเกินกำหนด กรุณาตรวจสอบที่อยู่และข้อมูลการศึกษา");
  if (details.study_year && !/^[1-8]$/.test(details.study_year)) return fail("ชั้นปีต้องอยู่ระหว่าง 1–8");
  if (details.gpa && (!/^[0-4](\.[0-9]{1,2})?$/.test(details.gpa) || Number(details.gpa) > 4)) return fail("เกรดเฉลี่ยต้องอยู่ระหว่าง 0–4 และมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  if (details.parent_status && !["อยู่ด้วยกัน", "แยกกันอยู่", "หย่า", "บิดาเสียชีวิต", "มารดาเสียชีวิต", "เสียชีวิตทั้งคู่", "other"].includes(details.parent_status)) return fail("กรุณาเลือกสถานะบิดามารดาจากรายการที่กำหนด");
  if (details.parent_status === "other" && !details.parent_status_other) return fail("กรุณาระบุสถานะบิดามารดา");
  if (!Number.isSafeInteger(version) || version < 1) return fail("กรุณารีเฟรชหน้าแล้วลองใหม่");
  if (phone && !/^0\d{9}$/.test(phone)) return fail("กรุณากรอกหมายเลขโทรศัพท์เป็นตัวเลข 10 หลัก โดยขึ้นต้นด้วย 0");
  if (department.length > 150 || position.length > 150 || expertise.length > 500) {
    return fail("หน่วยงานและตำแหน่งไม่เกิน 150 ตัวอักษร ความเชี่ยวชาญไม่เกิน 500 ตัวอักษร");
  }
  const upload = form.get("avatar");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const remove = form.get("remove_avatar") === "on";
  if (remove && file) return fail("เลือกอัปโหลดรูปใหม่หรือลบรูปเดิมอย่างใดอย่างหนึ่ง");
  if (file && file.size > MAX_AVATAR_BYTES) return fail("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 2 MB");
  let bytes: Buffer | null = null;
  if (file) {
    try { bytes = await prepareAvatar(Buffer.from(await file.arrayBuffer())); }
    catch { return fail("กรุณาใช้รูป JPG, PNG หรือ WebP ที่ไม่ใช่ภาพเคลื่อนไหว ขนาดไม่เกิน 2 MB และไม่เกิน 20 ล้านพิกเซล"); }
  }
  const client = await createClient();
  const { data: previous, error: loadError } = await client.from("portal_profiles")
    .select("avatar_path,version").eq("id", viewer.id).single();
  if (loadError || !previous) return fail("โหลดข้อมูลบัญชีไม่สำเร็จ กรุณาลองใหม่");
  if (previous.version !== version) return fail("ข้อมูลถูกเปลี่ยนแล้ว กรุณารีเฟรชหน้าแล้วแก้ไขอีกครั้ง");
  const newPath = bytes ? `${viewer.id}/${randomUUID()}.webp` : null;
  if (bytes && newPath) {
    const { error } = await client.storage.from("portal-avatars").upload(newPath, bytes, { contentType: "image/webp", upsert: false });
    if (error) return fail("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
  const { error } = await client.rpc("update_my_profile", {
    p_version: version, p_phone: phone, p_department: department, p_position: position, p_expertise: expertise,
    p_avatar_action: newPath ? "replace" : remove ? "remove" : "keep", p_avatar_path: newPath,
    p_details: details,
  });
  if (error) {
    if (newPath) await client.storage.from("portal-avatars").remove([newPath]);
    return fail(error.code === "40001" ? "ข้อมูลถูกเปลี่ยนแล้ว กรุณารีเฟรชหน้าแล้วแก้ไขอีกครั้ง" : "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและสิทธิ์บัญชีแล้วลองใหม่");
  }
  // The profile is committed first; never delete the old image on a failed save.
  if ((newPath || remove) && previous.avatar_path) {
    await client.storage.from("portal-avatars").remove([previous.avatar_path]);
  }
  invalidateViewerCache(viewer.id);
  revalidatePath("/", "layout");
  return { error: "", success: "บันทึกโปรไฟล์แล้ว พร้อมเก็บประวัติการแก้ไข", version: version + 1 };
}
