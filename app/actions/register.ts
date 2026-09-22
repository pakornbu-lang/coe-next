"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthConfigured } from "@/lib/supabase/config";
import { siteUrl } from "@/lib/auth/site-url";

export type RegisterState = {
  error: string;
  success: string;
};

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

async function reserveRegistrationAttempt(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
) {
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;

  if (!secret) {
    throw new Error("Registration rate limit is not configured");
  }

  const hash = (input: string) =>
    createHmac("sha256", secret).update(input).digest("hex");

  const emailHash = hash(`signup:email:${email}`);

  const requestHeaders = await headers();

  const ip = (
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-real-ip") ??
    ""
  )
    .split(",")[0]
    .trim();

  const ipHash = ip ? hash(`signup:ip:${ip}`) : null;

  const since = new Date(
    Date.now() - 60 * 60_000,
  ).toISOString();

  const emailCount = admin
    .from("registration_rate_limits")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("email_hash", emailHash)
    .gte("requested_at", since);

  const ipCount = ipHash
    ? admin
        .from("registration_rate_limits")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("ip_hash", ipHash)
        .gte("requested_at", since)
    : Promise.resolve({
        count: 0,
        error: null,
      });

  const totalCount = admin
    .from("registration_rate_limits")
    .select("id", {
      count: "exact",
      head: true,
    })
    .gte("requested_at", since);

  const [byEmail, byIp, total] =
    await Promise.all([
      emailCount,
      ipCount,
      totalCount,
    ]);

  if (
    byEmail.error ||
    byIp.error ||
    total.error
  ) {
    throw new Error(
      "Registration rate limit unavailable",
    );
  }

  if (
    (byEmail.count ?? 0) >= 3 ||
    (byIp.count ?? 0) >= 20 ||
    (total.count ?? 0) >= 100
  ) {
    return false;
  }

  const { error } = await admin
    .from("registration_rate_limits")
    .insert({
      email_hash: emailHash,
      ip_hash: ipHash,
    });

  if (error) {
    throw new Error(
      "Registration rate limit unavailable",
    );
  }

  return true;
}

export async function registerStudent(
  _previous: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  const prefix = value(form, "prefix");
  const firstName = value(form, "first_name");
  const lastName = value(form, "last_name");

  const fullName = [
    prefix,
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(" ");

  const studentId = value(form, "student_id");

  const phone = value(form, "phone");
  const address = value(form, "address");

  const email = value(
    form,
    "email",
  ).toLowerCase();

  const password = String(
    form.get("password") ?? "",
  );

  const confirmPassword = String(
    form.get("confirm_password") ?? "",
  );

  const department = value(
    form,
    "department",
  );

  const major = value(form, "major");

  const educationLevel = value(
    form,
    "education_level",
  );

  const studyYear = value(
    form,
    "study_year",
  );

  const gpa = value(form, "gpa");

  const familyIncome = value(
    form,
    "family_income",
  );

  const familyMembers = value(
    form,
    "family_members",
  );

  const parentStatus = value(
    form,
    "parent_status",
  );

  const parentStatusOther = value(
    form,
    "parent_status_other",
  );

  const emergencyName = value(
    form,
    "emergency_name",
  );

  const emergencyPhone = value(
    form,
    "emergency_phone",
  );

  const activities = value(
    form,
    "activities",
  );

  const bankName = value(
    form,
    "bank_name",
  );

  const accountHolder = value(
    form,
    "account_holder",
  );

  const accountNumber = value(
    form,
    "account_number",
  );

  const allowedPrefixes = [
    "นาย",
    "นางสาว",
    "นาง",
  ];

  if (
    !allowedPrefixes.includes(prefix) ||
    !firstName ||
    firstName.length > 100 ||
    !lastName ||
    lastName.length > 100 ||
    !fullName ||
    fullName.length > 200
  ) {
    return {
      error:
        "กรุณากรอกคำนำหน้า ชื่อ และนามสกุลให้ถูกต้อง",
      success: "",
    };
  }

  if (!/^[0-9]{8,12}$/.test(studentId)) {
    return {
      error:
        "รหัสนักศึกษาต้องเป็นตัวเลข 8–12 หลัก",
      success: "",
    };
  }

  if (!/^0[0-9]{9}$/.test(phone)) {
    return {
      error:
        "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก โดยขึ้นต้นด้วย 0",
      success: "",
    };
  }

  if (
    address.length < 5 ||
    address.length > 500
  ) {
    return {
      error:
        "กรุณากรอกที่อยู่ติดต่อให้ถูกต้อง",
      success: "",
    };
  }

  if (
    !/^[^\s@]+@mail\.wu\.ac\.th$/.test(
      email,
    ) ||
    email.length > 254
  ) {
    return {
      error:
        "กรุณาใช้อีเมลมหาวิทยาลัย @mail.wu.ac.th",
      success: "",
    };
  }

  if (
    password.length < 8 ||
    password.length > 128
  ) {
    return {
      error:
        "รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร",
      success: "",
    };
  }

  if (password !== confirmPassword) {
    return {
      error:
        "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน",
      success: "",
    };
  }

  if (
    !department ||
    department.length > 150
  ) {
    return {
      error:
        "กรุณากรอกคณะ / สำนักวิชา",
      success: "",
    };
  }

  if (!major || major.length > 150) {
    return {
      error: "กรุณากรอกสาขาวิชา",
      success: "",
    };
  }

  const educationLevels = [
    "ปริญญาตรี",
    "ปริญญาโท",
    "ปริญญาเอก",
    "อื่น ๆ",
  ];

  if (
    !educationLevels.includes(
      educationLevel,
    )
  ) {
    return {
      error: "กรุณาเลือกระดับการศึกษา",
      success: "",
    };
  }

  if (!/^[1-8]$/.test(studyYear)) {
    return {
      error:
        "ชั้นปีต้องอยู่ระหว่าง 1–8",
      success: "",
    };
  }

  if (
    !/^[0-4](\.[0-9]{1,2})?$/.test(
      gpa,
    ) ||
    Number(gpa) > 4
  ) {
    return {
      error:
        "GPA ต้องอยู่ระหว่าง 0.00–4.00",
      success: "",
    };
  }

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      familyIncome,
    ) ||
    Number(familyIncome) < 0 ||
    Number(familyIncome) > 100000000
  ) {
    return {
      error:
        "รายได้ครอบครัวไม่ถูกต้อง",
      success: "",
    };
  }

  if (!/^[1-9]\d?$/.test(familyMembers)) {
    return {
      error:
        "จำนวนสมาชิกในครอบครัวต้องอยู่ระหว่าง 1–99 คน",
      success: "",
    };
  }

  const parentStatuses = [
    "อยู่ด้วยกัน",
    "แยกกันอยู่",
    "หย่า",
    "บิดาเสียชีวิต",
    "มารดาเสียชีวิต",
    "เสียชีวิตทั้งคู่",
    "other",
  ];

  if (
    !parentStatuses.includes(
      parentStatus,
    )
  ) {
    return {
      error:
        "กรุณาเลือกสถานะบิดามารดา",
      success: "",
    };
  }

  if (
    parentStatus === "other" &&
    !parentStatusOther
  ) {
    return {
      error:
        "กรุณาระบุสถานะบิดามารดา",
      success: "",
    };
  }

  if (emergencyName.length > 200) {
    return {
      error:
        "ชื่อผู้ติดต่อฉุกเฉินยาวเกินกำหนด",
      success: "",
    };
  }

  if (
    emergencyPhone &&
    !/^0[0-9]{9}$/.test(emergencyPhone)
  ) {
    return {
      error:
        "เบอร์โทรศัพท์ฉุกเฉินต้องเป็นตัวเลข 10 หลัก",
      success: "",
    };
  }

  if (activities.length > 5000) {
    return {
      error:
        "ข้อมูลกิจกรรมและผลงานยาวเกินกำหนด",
      success: "",
    };
  }

  if (
    bankName.length < 2 ||
    bankName.length > 150
  ) {
    return {
      error:
        "กรุณาเลือกหรือระบุธนาคาร",
      success: "",
    };
  }

  if (
    accountHolder.length < 2 ||
    accountHolder.length > 200
  ) {
    return {
      error:
        "กรุณากรอกชื่อบัญชีให้ถูกต้อง",
      success: "",
    };
  }

  if (
    !/^[0-9]{10,15}$/.test(
      accountNumber,
    )
  ) {
    return {
      error:
        "เลขบัญชีต้องเป็นตัวเลข 10–15 หลัก",
      success: "",
    };
  }

  if (!isAuthConfigured()) {
    return {
      error:
        "ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล",
      success: "",
    };
  }

  try {
    /*
     * ของ main:
     * จำกัดจำนวนการสมัครต่ออีเมล/IP
     */
    const admin = createAdminClient();

    if (!admin) {
      return {
        error:
          "ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล",
        success: "",
      };
    }

    if (
      !(await reserveRegistrationAttempt(
        admin,
        email,
      ))
    ) {
      return {
        error:
          "มีการสมัครสมาชิกหลายครั้งเกินไป กรุณารอหนึ่งชั่วโมงแล้วลองใหม่",
        success: "",
      };
    }

    /*
     * ของ M01:
     * สมัครผ่าน Supabase Auth และรอผู้ใช้ยืนยันอีเมล
     */
    const client = await createClient();

    const { data, error } =
      await client.auth.signUp({
        email,
        password,

        options: {
          emailRedirectTo:
            `${siteUrl()}/auth/callback`,

          data: {
            full_name: fullName,
            student_id: studentId,
            prefix,
            first_name: firstName,
            last_name: lastName,
            phone,
            department,

            profile_details: {
              address,
              major,
              education_level:
                educationLevel,
              study_year: studyYear,
              gpa,
              family_income:
                familyIncome,
              family_members:
                familyMembers,
              parent_status:
                parentStatus,
              parent_status_other:
                parentStatus === "other"
                  ? parentStatusOther
                  : "",
              emergency_name:
                emergencyName,
              emergency_phone:
                emergencyPhone,
              activities,
              bank_name: bankName,
              account_holder:
                accountHolder,
              account_number:
                accountNumber,
            },
          },
        },
      });

    if (error) {
      console.error(
        "REGISTER_SIGNUP_ERROR",
        {
          message: error.message,
          code: error.code,
          status: error.status,
          name: error.name,
        },
      );

      let message =
        "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

      if (error.status === 429) {
        message =
          "มีการสมัครสมาชิกหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
      } else if (
        error.code ===
        "email_address_not_authorized"
      ) {
        message =
          "ระบบส่งอีเมลของ Supabase ไม่อนุญาตให้อีเมลนี้รับอีเมลยืนยัน";
      } else if (
        error.code === "weak_password"
      ) {
        message =
          "รหัสผ่านไม่ผ่านข้อกำหนดความปลอดภัย กรุณาใช้รหัสผ่านที่เดายากขึ้น";
      } else if (
        error.code ===
          "user_already_exists" ||
        error.code === "email_exists"
      ) {
        message =
          "อีเมลนี้มีบัญชีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ";
      } else if (
        process.env.NODE_ENV ===
          "development" &&
        error.message
      ) {
        message =
          `สมัครสมาชิกไม่สำเร็จ: ${error.message}`;
      }

      return {
        error: message,
        success: "",
      };
    }

    if (!data.user) {
      return {
        error:
          "Supabase ไม่ได้สร้างบัญชีผู้ใช้ กรุณาตรวจสอบการตั้งค่า Authentication",
        success: "",
      };
    }

    /*
     * ถ้ามี session ทันที แปลว่า Confirm email
     * ถูกปิดอยู่ ซึ่งไม่ตรงกับ flow ของ M01 นี้
     */
    if (data.session) {
      await client.auth.signOut({
        scope: "local",
      });

      return {
        error:
          "Supabase ยังไม่ได้บังคับการยืนยันอีเมล กรุณาตรวจสอบ Confirm email ใน Authentication",
        success: "",
      };
    }

    return {
      error: "",
      success:
        `สมัครสมาชิกสำเร็จ ระบบได้สร้างบัญชี ${email} แล้ว กรุณาตรวจอีเมลและกดปุ่ม “ยืนยันอีเมล” ก่อนเข้าสู่ระบบ`,
    };
  } catch (error) {
    console.error(
      "REGISTER_UNEXPECTED_ERROR",
      error,
    );

    const detail =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return {
      error:
        process.env.NODE_ENV ===
        "development"
          ? `ไม่สามารถสมัครสมาชิกได้: ${detail}`
          : "ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล",
      success: "",
    };
  }
}