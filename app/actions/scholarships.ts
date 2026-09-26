"use server";
import { isPersonName } from "@/lib/forms/person-name";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  prepareScholarshipCover,
  MAX_SCHOLARSHIP_COVER_BYTES,
} from "@/lib/scholarships/cover.mjs";
import { validApplicationDocument } from "@/lib/scholarships/document-validation";
import { invalidatePublishedScholarshipsCache } from "@/lib/scholarships/server";

export type WorkflowState = {
  error: string;
  success: string;
  applicationId?: string;
  scholarshipId?: string;
};

const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

const failure = (code?: string, message?: string): WorkflowState => {
  if (
    code === "PT409" ||
    code === "40001" ||
    (code === "P0001" && message === "STALE_VERSION")
  )
    return {
      error: "ข้อมูลนี้ถูกเปลี่ยนโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองอีกครั้ง",
      success: "",
    };

  if (code === "42501")
    return {
      error: "คุณไม่มีสิทธิ์ทำรายการนี้ หรือบัญชีไม่พร้อมใช้งาน",
      success: "",
    };

  if (code === "23505")
    return {
      error: "มีข้อมูลนี้ในระบบแล้ว กรุณาตรวจสอบและลองใหม่",
      success: "",
    };

  if (message === "Scholarship is not open")
    return {
      error:
        "ทุนนี้ยังไม่เปิดรับสมัคร หมดเขต หรือปิดรับสมัครแล้ว จึงส่งใบสมัครไม่ได้ หากเป็นการส่งเอกสารแก้ไข กรุณาติดต่อเจ้าหน้าที่",
      success: "",
    };

  if (message === "GPA is below scholarship minimum")
    return {
      error:
        "เกรดเฉลี่ยของคุณต่ำกว่าเกณฑ์ขั้นต่ำของทุนนี้ จึงไม่สามารถส่งใบสมัครได้",
      success: "",
    };

  if (message === "Invalid application GPA")
    return {
      error: "กรุณากรอกเกรดเฉลี่ยระหว่าง 0–4 และทศนิยมไม่เกิน 2 ตำแหน่ง",
      success: "",
    };

  if (message === "Invalid bank account details")
    return {
      error: "กรุณาเลือกธนาคาร กรอกชื่อบัญชี และเลขบัญชีให้ถูกต้อง",
      success: "",
    };

  if (message === "Bank account details are required")
    return {
      error: "กรุณากรอกข้อมูลบัญชีรับเงินให้ครบก่อนส่งใบสมัคร",
      success: "",
    };

  if (message === "Complete every required application field before submitting")
    return {
      error: "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบก่อนส่งใบสมัคร",
      success: "",
    };

  if (message === "Required documents are missing")
    return {
      error: "กรุณาอัปโหลดเอกสารที่ระบุว่า “จำเป็น” ให้ครบก่อนส่งใบสมัคร",
      success: "",
    };

  return {
    error: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่",
    success: "",
  };
};

function toBangkokTimestamp(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;

  const parsed = new Date(`${raw}:00+07:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function applicationData(form: FormData) {
  const limits: Record<string, number> = {
    faculty: 150,
    major: 150,
    gpa: 4,
    phone: 10,
    address: 500,
    study_year: 1,
    education_level: 50,
    income: 30,
    family_members: 3,
    parent_status: 50,
    parent_status_other: 150,
    reason: 5000,
    activities: 5000,
    emergency_name: 200,
    emergency_phone: 10,
  };

  const data: Record<string, string> = {};

  for (const [key, limit] of Object.entries(limits)) {
    const item = value(form, key);

    if (item.length > limit) throw new Error("INPUT_TOO_LONG");

    data[key] = item;
  }

  if (data.emergency_name && !isPersonName(data.emergency_name))
    throw new Error("INVALID_EMERGENCY_NAME");

  if (
    data.income &&
    (!/^\d+(\.\d{1,2})?$/.test(data.income) || Number(data.income) > 100000000)
  )
    throw new Error("INVALID_INCOME");

  if (data.family_members && !/^[1-9]\d?$/.test(data.family_members))
    throw new Error("INVALID_FAMILY");

  if (
    data.parent_status &&
    ![
      "อยู่ด้วยกัน",
      "แยกกันอยู่",
      "หย่า",
      "บิดาเสียชีวิต",
      "มารดาเสียชีวิต",
      "เสียชีวิตทั้งคู่",
      "other",
    ].includes(data.parent_status)
  )
    throw new Error("INVALID_PARENT_STATUS");

  return data;
}

export async function saveApplication(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["student"]);

  try {
    const scholarshipId = value(form, "scholarship_id");

    const applicationId = value(form, "application_id");

    const version = applicationId ? Number(value(form, "version")) : null;

    const mode = value(form, "mode");

    if (
      !uuid(scholarshipId) ||
      (applicationId && !uuid(applicationId)) ||
      (applicationId && (!Number.isSafeInteger(version) || version! < 1)) ||
      !["draft", "submit"].includes(mode)
    ) {
      return failure("22023");
    }

    const data = applicationData(form);

    const bankName = value(form, "bank_name");

    const accountHolder = value(form, "account_holder");

    const accountNumber = value(form, "account_number");

    const hasBankDetails = Boolean(bankName || accountHolder || accountNumber);

    const validBankDetails = Boolean(
      bankName &&
      accountHolder.length >= 2 &&
      /^\d{10,15}$/.test(accountNumber),
    );

    if (hasBankDetails && !validBankDetails) {
      return {
        error:
          "กรุณาเลือกธนาคาร กรอกชื่อบัญชี และเลขบัญชีเป็นตัวเลข 10–15 หลักให้ครบ",
        success: "",
        applicationId: applicationId || undefined,
      };
    }

    if (
      mode === "submit" &&
      (!/^0\d{9}$/.test(data.phone) ||
        (data.emergency_phone && !/^0\d{9}$/.test(data.emergency_phone)))
    ) {
      return {
        error: "กรุณากรอกหมายเลขโทรศัพท์เป็นตัวเลข 10 หลัก โดยขึ้นต้นด้วย 0",
        success: "",
        applicationId: applicationId || undefined,
      };
    }

    if (
      mode === "submit" &&
      (!bankName ||
        !accountHolder ||
        !accountNumber ||
        !data.faculty ||
        !data.major ||
        !data.education_level ||
        !data.study_year ||
        !data.gpa ||
        !data.phone ||
        !data.address ||
        !data.income ||
        !data.family_members ||
        !data.parent_status ||
        (data.parent_status === "other" && !data.parent_status_other) ||
        !data.reason)
    ) {
      return {
        error: "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบก่อนส่งใบสมัคร",
        success: "",
        applicationId: applicationId || undefined,
      };
    }

    const client = await createClient();

    const { data: savedId, error } = await client.rpc(
      "student_save_application",
      {
        p_application_id: applicationId || null,
        p_version: version,
        p_scholarship_id: scholarshipId,
        p_data: data,
        p_bank_name: bankName || null,
        p_account_holder: accountHolder || null,
        p_account_number: accountNumber || null,
        p_submit: mode === "submit",
      },
    );

    if (error || !savedId) return failure(error?.code, error?.message);

    revalidatePath("/dashboard");
    revalidatePath("/applications");

    revalidatePath(`/applications/${savedId}`);

    return {
      error: "",
      success:
        mode === "submit"
          ? "ส่งใบสมัครแล้ว เจ้าหน้าที่จะตรวจสอบเอกสารตามลำดับ"
          : "บันทึกร่างแล้ว ตอนนี้คุณสามารถอัปโหลดเอกสารประกอบได้",
      applicationId: savedId,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EMERGENCY_NAME")
      return {
        error:
          "ชื่อผู้ติดต่อฉุกเฉินใช้ได้เฉพาะตัวอักษร เว้นวรรค จุด หรือขีดกลาง ห้ามใช้ตัวเลข",
        success: "",
      };
    if (error instanceof Error && error.message === "INPUT_TOO_LONG")
      return {
        error: "ข้อมูลบางช่องยาวเกินกำหนด",
        success: "",
      };

    if (
      error instanceof Error &&
      ["INVALID_INCOME", "INVALID_FAMILY", "INVALID_PARENT_STATUS"].includes(
        error.message,
      )
    )
      return {
        error: "กรุณาตรวจสอบข้อมูลรายได้ สมาชิกครอบครัว และสถานะบิดามารดา",
        success: "",
      };

    return failure();
  }
}

const documentTypes: Record<
  string,
  {
    mime: string;
    extension: string;
  }
> = {
  "application/pdf": {
    mime: "application/pdf",
    extension: "pdf",
  },

  "image/jpeg": {
    mime: "image/jpeg",
    extension: "jpg",
  },

  "image/png": {
    mime: "image/png",
    extension: "png",
  },

  "application/msword": {
    mime: "application/msword",
    extension: "doc",
  },

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  },
};

export async function uploadApplicationDocument(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  const viewer = await requireRole(["student"]);

  const applicationId = value(form, "application_id");

  const requirementId = value(form, "requirement_id");

  const file = form.get("document");

  if (
    !uuid(applicationId) ||
    !uuid(requirementId) ||
    !(file instanceof File) ||
    !file.size
  )
    return failure("22023");

  const type = documentTypes[file.type];

  if (!type || file.size > 10 * 1024 * 1024 || file.name.length > 255) {
    return {
      error: "รองรับ PDF, JPG, PNG, DOC และ DOCX ขนาดไม่เกิน 10 MB",
      success: "",
      applicationId,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (!(await validApplicationDocument(bytes, type.mime))) {
    return {
      error: "ไฟล์ไม่ตรงกับชนิดที่เลือกหรือไฟล์เสียหาย กรุณาเลือกไฟล์ใหม่",
      success: "",
      applicationId,
    };
  }

  const path = `${viewer.id}/${applicationId}/${randomUUID()}.${type.extension}`;

  const client = await createClient();

  const { data: appData, error: appCheckError } = await client
    .from("applications")
    .select("id,status,student_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (appCheckError || !appData || appData.student_id !== viewer.id) {
    return {
      error: "ไม่มีสิทธิ์แก้ไขหรืออัปโหลดเอกสารสำหรับใบสมัครนี้",
      success: "",
      applicationId,
    };
  }

  if (!["draft", "revision_requested"].includes(appData.status)) {
    return {
      error: "ใบสมัครนี้อยู่ในสถานะที่ไม่สามารถแก้ไขเอกสารได้",
      success: "",
      applicationId,
    };
  }

  const admin = createAdminClient();

  if (!admin)
    return {
      error: "ระบบอัปโหลดเอกสารยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ",
      success: "",
      applicationId,
    };

  const { error: uploadError } = await admin.storage
    .from("scholarship-documents")
    .upload(path, bytes, {
      contentType: type.mime,
      upsert: false,
    });

  if (uploadError)
    return {
      error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่",
      success: "",
      applicationId,
    };

  const { error } = await client.rpc("student_replace_application_document", {
    p_application_id: applicationId,
    p_requirement_id: requirementId,
    p_file_path: path,
    p_file_name: file.name,
    p_mime_type: type.mime,
    p_file_size: file.size,
  });

  if (error) {
    await admin.storage.from("scholarship-documents").remove([path]);

    return failure(error.code, error.message);
  }

  revalidatePath(`/applications/${applicationId}`);

  revalidatePath("/apply");

  return {
    error: "",
    success: `อัปโหลด ${file.name} แล้ว`,
    applicationId,
  };
}

function parseRequirements(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, details = "", requiredValue = "required"] = line
        .split("|")
        .map((part) => part.trim());

      const required = !["optional", "ไม่บังคับ", "false"].includes(
        requiredValue.toLowerCase(),
      );

      return {
        label,
        details,
        required,
        sort_order: index + 1,
      };
    });
}

function parseCriteria(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, rawScore, details = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        label,
        details,
        max_score: Number(rawScore),
        sort_order: index + 1,
      };
    });
}

export async function saveScholarship(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  const viewer = await requireRole(["staff"]);

  const restricted = value(form, "faculty_scope") === "selected";
  const faculties = restricted
    ? [
        ...new Set(
          form
            .getAll("eligible_faculties")
            .map(String)
            .map((v) => v.trim()),
        ),
      ]
    : [];
  const majors = restricted
    ? [
        ...new Set(
          form
            .getAll("eligible_majors")
            .map(String)
            .map((v) => v.trim()),
        ),
      ]
    : [];
  if (
    (restricted && !faculties.length) ||
    faculties.length > 100 ||
    majors.length > 200 ||
    [...faculties, ...majors].some((v) => !v || v.length > 150)
  )
    return {
      error: "กรุณาเลือกสำนักวิชาอย่างน้อย 1 รายการ และตรวจสอบรายชื่อสาขา",
      success: "",
    };
  const id = value(form, "id");

  const version = id ? Number(value(form, "version")) : null;

  const opensAt = toBangkokTimestamp(value(form, "opens_at"));

  const closesAt = toBangkokTimestamp(value(form, "closes_at"));

  const requirements = parseRequirements(value(form, "requirements"));

  const criteria = parseCriteria(value(form, "criteria"));

  const amount = Number(value(form, "amount"));

  const quota = Number(value(form, "quota"));

  const minimumGpa = value(form, "minimum_gpa");

  const invalidRequirement = requirements.some(
    (item) =>
      item.label.length < 2 ||
      item.label.length > 150 ||
      item.details.length > 1000,
  );

  const invalidCriterion = criteria.some(
    (item) =>
      item.label.length < 2 ||
      item.label.length > 150 ||
      !Number.isFinite(item.max_score) ||
      item.max_score <= 0 ||
      item.max_score > 1000 ||
      item.details.length > 1000,
  );

  if (
    (id && (!uuid(id) || !Number.isSafeInteger(version) || version! < 1)) ||
    !opensAt ||
    !closesAt ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(quota) ||
    !requirements.length ||
    !criteria.length ||
    invalidRequirement ||
    invalidCriterion
  ) {
    return {
      error: "กรุณากรอกข้อมูลทุน รายการเอกสาร และเกณฑ์คะแนนให้ครบ",
      success: "",
    };
  }

  const client = await createClient();

  const uploadedCover = form.get("cover");

  const existingCoverPath = value(form, "current_cover_path") || null;

  let coverPath = existingCoverPath;

  if (uploadedCover instanceof File && uploadedCover.size) {
    if (uploadedCover.size > MAX_SCHOLARSHIP_COVER_BYTES)
      return {
        error: "ภาพปกต้องมีขนาดไม่เกิน 5 MB",
        success: "",
      };

    let coverBytes: Buffer;

    try {
      coverBytes = await prepareScholarshipCover(
        Buffer.from(await uploadedCover.arrayBuffer()),
      );
    } catch {
      return {
        error:
          "กรุณาใช้ภาพ JPG, PNG หรือ WebP ที่ไม่ใช่ภาพเคลื่อนไหว และมีขนาดไม่เกิน 5 MB",
        success: "",
      };
    }

    coverPath = `${viewer.id}/${randomUUID()}.webp`;

    const { error: uploadError } = await client.storage
      .from("scholarship-covers")
      .upload(coverPath, coverBytes, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError)
      return {
        error: "อัปโหลดภาพปกไม่สำเร็จ กรุณาลองใหม่",
        success: "",
      };
  }

  const { data, error } = await client.rpc(
    "staff_save_scholarship_with_audience",
    {
      p_faculties: faculties,
      p_majors: majors,
      p_data: {
        p_id: id || null,
        p_version: version,
        p_title: value(form, "title"),
        p_type_id: value(form, "scholarship_type_id") || null,
        p_description: value(form, "description"),
        p_eligibility: value(form, "eligibility"),
        p_amount: amount,
        p_quota: quota,
        p_minimum_gpa: minimumGpa ? Number(minimumGpa) : null,
        p_opens_at: opensAt,
        p_closes_at: closesAt,
        p_status: value(form, "status"),
        p_program_kind: value(form, "program_kind"),
        p_cover_path: coverPath,
        p_requirements: requirements,
        p_criteria: criteria,
        p_reason: value(form, "reason"),
      },
    },
  );

  if (error || !data) {
    if (coverPath && coverPath !== existingCoverPath)
      await client.storage.from("scholarship-covers").remove([coverPath]);

    return failure(error?.code, error?.message);
  }

  if (existingCoverPath && coverPath !== existingCoverPath)
    await client.storage.from("scholarship-covers").remove([existingCoverPath]);

  invalidatePublishedScholarshipsCache();
  revalidatePath("/");
  revalidatePath("/scholarships");
  revalidatePath("/staff");

  revalidatePath("/staff/scholarships");

  return {
    error: "",
    success: "บันทึกทุนและเงื่อนไขแล้ว",
    scholarshipId: data,
  };
}

/* =========================================================
   ลบทุนการศึกษา
   ========================================================= */

export async function deleteScholarship(form: FormData): Promise<void> {
  await requireRole(["staff"]);

  const scholarshipId = value(form, "scholarship_id");

  if (!uuid(scholarshipId)) {
    redirect("/staff/scholarships?delete_result=failed");
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect("/staff/scholarships?delete_result=failed");
  }

  /*
   * ดึงข้อมูลทุนก่อนลบ
   * เพื่อเก็บ path ของภาพปกไว้
   */
  const { data: scholarship, error: scholarshipError } = await admin
    .from("scholarships")
    .select("id, cover_path")
    .eq("id", scholarshipId)
    .maybeSingle();

  if (scholarshipError || !scholarship) {
    redirect("/staff/scholarships?delete_result=failed");
  }

  /*
   * ถ้ามีใบสมัครของทุนนี้แล้ว
   * ไม่ลบทุน เพื่อไม่ให้ข้อมูลใบสมัครเสีย
   */
  const { count, error: applicationError } = await admin
    .from("applications")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("scholarship_id", scholarshipId);

  if (applicationError) {
    redirect("/staff/scholarships?delete_result=failed");
  }

  if ((count ?? 0) > 0) {
    redirect("/staff/scholarships?delete_result=blocked");
  }

  /*
   * ลบทุน
   *
   * scholarship_document_requirements
   * และ scholarship_review_criteria
   * จะถูกลบตามด้วย ON DELETE CASCADE
   */
  const { error: deleteError } = await admin
    .from("scholarships")
    .delete()
    .eq("id", scholarshipId);

  if (deleteError) {
    redirect("/staff/scholarships?delete_result=failed");
  }

  /*
   * ถ้ามีภาพปก
   * ลบออกจาก Storage ด้วย
   */
  if (scholarship.cover_path) {
    await admin.storage
      .from("scholarship-covers")
      .remove([scholarship.cover_path]);
  }

  invalidatePublishedScholarshipsCache();
  revalidatePath("/");
  revalidatePath("/scholarships");
  revalidatePath("/staff");

  revalidatePath("/staff/scholarships");

  redirect("/staff/scholarships?delete_result=deleted");
}

export async function reviewApplicationDocuments(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["staff"]);

  const applicationId = value(form, "application_id");

  const version = Number(value(form, "version"));

  const action = value(form, "action");

  let documents: unknown;

  try {
    documents = JSON.parse(value(form, "documents"));
  } catch {
    return failure("22023");
  }

  if (
    !uuid(applicationId) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !["verify", "request_revision"].includes(action) ||
    !Array.isArray(documents)
  )
    return failure("22023");

  const client = await createClient();

  const { error } = await client.rpc("staff_review_application_documents", {
    p_application_id: applicationId,
    p_version: version,
    p_documents: documents,
    p_action: action,
    p_reason: value(form, "reason"),
  });

  if (error) return failure(error.code, error.message);

  revalidatePath(`/staff/review/${applicationId}`);

  revalidatePath("/staff/review");

  return {
    error: "",
    success:
      action === "verify"
        ? "ยืนยันการตรวจเอกสารแล้ว พร้อมมอบหมายกรรมการ"
        : "ส่งคำขอแก้ไขเอกสารให้นักศึกษาแล้ว",
  };
}

// มอบหมายกรรมการครั้งแรกจาก StaffReviewPanel ให้ใบสมัคร ผ่าน RPC staff_assign_reviewer
// แก้ช่องเลือกกรรมการ/เหตุผล: components/workflow/StaffReviewPanel.tsx
// แก้ข้อมูลที่ส่ง: parameter p_* ด้านล่าง; เปลี่ยนกฎงานซ้ำหรือสถานะใบสมัครต้องเพิ่ม migration ของ RPC
// การเปลี่ยน/ถอนงานหลังมอบหมายใช้ manageReview ใน app/actions/review-operations.ts
export async function assignReviewer /* มอบหมายกรรมการให้ใบสมัครผ่าน RPC */(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["staff"]);

  const applicationId = value(form, "application_id");

  const reviewerId = value(form, "reviewer_id");

  if (!uuid(applicationId) || !uuid(reviewerId)) return failure("22023");

  const client = await createClient() /* Supabase client ที่ใช้ session ของผู้ใช้ปัจจุบัน */;

  const { error } = await client.rpc("staff_assign_reviewer", {
    p_application_id: applicationId /* รหัสใบสมัครเป้าหมาย */,
    p_reviewer_id: reviewerId /* รหัสกรรมการที่เจ้าหน้าที่เลือกมอบหมาย */,
    p_reason: value(form, "reason") /* เหตุผลประกอบการทำรายการ */,
  });

  if (error) return failure(error.code, error.message);

  revalidatePath(`/staff/review/${applicationId}`); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  revalidatePath("/staff/review"); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  return {
    error: "",
    success: "มอบหมายกรรมการแล้ว",
  };
}

// รับคะแนนจาก EvaluationPanel แล้วบันทึกลง evaluations ผ่าน committee_save_evaluation
// assignment_id อ้างถึงงานใน review_assignments; scores เป็น JSON ของ criterion_id, score, comment
// mode=draft เก็บร่าง; mode=submit ส่งผลจริง; version ป้องกันบันทึกทับข้อมูลที่เปลี่ยนแล้ว
// เพิ่มเกณฑ์คะแนนรายทุนผ่าน ScholarshipStructureEditor; เปลี่ยน schema scores ต้องแก้ type/UI/RPC ด้วย
// RPC มีนิยามแก้ไขใน 20260921160000_fix_committee_drafts_and_links.sql และ migration ที่ตามมา
export async function saveEvaluation /* รับคะแนนจากฟอร์มและบันทึกร่างหรือส่งผลจริง */(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["committee"]);

  const assignmentId = value(form, "assignment_id");

  const version = value(form, "version")
    ? Number(value(form, "version"))
    : null /* รุ่นข้อมูล ใช้ป้องกันการบันทึกจากหน้าเก่าทับข้อมูลใหม่ */;

  let scores: unknown /* ชุดคะแนนรายเกณฑ์ แต่ละรายการมีรหัสเกณฑ์และคะแนน */;

  try {
    scores = JSON.parse(value(form, "scores"));
  } catch {
    return failure("22023");
  }

  if (
    !uuid(assignmentId) ||
    (version !== null && (!Number.isSafeInteger(version) || version < 1)) ||
    !Array.isArray(scores)
  )
    return failure("22023");

  const client = await createClient() /* Supabase client ที่ใช้ session ของผู้ใช้ปัจจุบัน */;

  const { error } = await client.rpc("committee_save_evaluation", {
    p_assignment_id: assignmentId /* รหัสงานมอบหมายที่จะบันทึกผลประเมิน */,
    p_version: version /* ส่งรุ่นข้อมูลเดิมให้ฐานข้อมูลตรวจว่ามีใครแก้ไปแล้วหรือไม่ */,
    p_scores: scores /* คะแนนรายเกณฑ์ที่ส่งให้ RPC ตรวจและบันทึก */,
    p_recommendation: value(form, "recommendation") /* ข้อเสนอแนะผลการพิจารณาของกรรมการ */,
    p_comment: value(form, "comment") /* ความคิดเห็นที่ส่งไปฐานข้อมูล */,
    p_submit: value(form, "mode") === "submit" /* true คือส่งผลจริง; false คือเก็บเป็นร่าง */,
  });

  if (error) return failure(error.code, error.message);

  revalidatePath("/committee"); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  revalidatePath(`/staff/evaluation?assignment=${assignmentId}`); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  return {
    error: "",
    success:
      value(form, "mode") === "submit"
        ? "ส่งผลประเมินให้เจ้าหน้าที่แล้ว"
        : "บันทึกร่างผลประเมินแล้ว",
  };
}

// รับผลตัดสินสุดท้ายจากเจ้าหน้าที่ ซึ่งแยกจาก recommendation ของกรรมการ
// ตัวเลือกผลอยู่ StaffEvaluationSummary/StaffReviewPanel; กฎจำนวนกรรมการและโควตาอยู่ staff_decide_application
// หากเปลี่ยนกฎอนุมัติ ให้เพิ่ม migration ใหม่ ไม่แก้เฉพาะเงื่อนไขแสดงปุ่มบนหน้าเว็บ
export async function decideApplication /* บันทึกผลตัดสินสุดท้ายของเจ้าหน้าที่ */(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["staff"]);

  const applicationId = value(form, "application_id");

  const version = Number(value(form, "version")) /* รุ่นข้อมูล ใช้ป้องกันการบันทึกจากหน้าเก่าทับข้อมูลใหม่ */;

  if (!uuid(applicationId) || !Number.isSafeInteger(version) || version < 1)
    return failure("22023");

  const client = await createClient() /* Supabase client ที่ใช้ session ของผู้ใช้ปัจจุบัน */;

  const { error } = await client.rpc("staff_decide_application", {
    p_application_id: applicationId /* รหัสใบสมัครเป้าหมาย */,
    p_version: version /* ส่งรุ่นข้อมูลเดิมให้ฐานข้อมูลตรวจว่ามีใครแก้ไปแล้วหรือไม่ */,
    p_decision: value(form, "decision") /* ผลตัดสินของเจ้าหน้าที่ เช่น approved, reserve หรือ rejected */,
    p_reason: value(form, "reason") /* เหตุผลประกอบการทำรายการ */,
  });

  if (error) return failure(error.code, error.message);

  revalidatePath(`/staff/review/${applicationId}`); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  revalidatePath("/staff/review"); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */

  return {
    error: "",
    success: "บันทึกผลการพิจารณาและแจ้งนักศึกษาแล้ว",
  };
}

const proofTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function recordDisbursement(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireRole(["staff"]);

  const applicationId = value(form, "application_id");

  const version = value(form, "version")
    ? Number(value(form, "version"))
    : null;

  const amount = Number(value(form, "amount"));

  if (
    !uuid(applicationId) ||
    (version !== null && (!Number.isSafeInteger(version) || version < 1)) ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return failure("22023");

  const client = await createClient();

  const proof = form.get("proof");

  const existingPath = value(form, "current_proof") || null;

  let path = existingPath;

  if (proof instanceof File && proof.size) {
    const extension = proofTypes[proof.type];

    if (!extension || proof.size > 5 * 1024 * 1024)
      return {
        error: "หลักฐานการโอนต้องเป็น PDF, JPG หรือ PNG ขนาดไม่เกิน 5 MB",
        success: "",
      };

    path = `${applicationId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from("scholarship-payment-proofs")
      .upload(path, proof, {
        contentType: proof.type,
        upsert: false,
      });

    if (uploadError)
      return {
        error: "อัปโหลดหลักฐานการโอนไม่สำเร็จ",
        success: "",
      };
  }

  const transferDate = value(form, "transfer_date");

  const { error } = await client.rpc("staff_record_disbursement", {
    p_application_id: applicationId,
    p_version: version,
    p_amount: amount,
    p_status: value(form, "status"),
    p_transfer_date: transferDate || null,
    p_transfer_reference: value(form, "transfer_reference") || null,
    p_proof_path: path,
    p_reason: value(form, "reason"),
  });

  if (error) {
    if (path && path !== existingPath)
      await client.storage.from("scholarship-payment-proofs").remove([path]);

    return failure(error.code, error.message);
  }

  if (existingPath && path !== existingPath)
    await client.storage
      .from("scholarship-payment-proofs")
      .remove([existingPath]);

  revalidatePath(`/staff/review/${applicationId}`);

  revalidatePath("/staff");

  return {
    error: "",
    success: "บันทึกข้อมูลการจ่ายทุนแล้ว",
  };
}
