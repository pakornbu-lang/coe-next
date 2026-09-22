"use server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  isAuthConfigured,
} from "@/lib/supabase/config";

import {
  siteUrl,
} from "@/lib/auth/site-url";

export type RegisterState = {
  error: string;
  success: string;
};

/* =========================
   HELPER
========================= */

function value(
  form: FormData,
  key: string,
) {
  return String(
    form.get(key) ?? "",
  ).trim();
}

/* =========================
   REGISTER STUDENT
========================= */

export async function registerStudent(
  _previous: RegisterState,
  form: FormData,
): Promise<RegisterState> {

  /* =========================
     STEP 1
     PERSONAL
  ========================= */

  const prefix =
    value(
      form,
      "prefix",
    );

  const firstName =
    value(
      form,
      "first_name",
    );

  const lastName =
    value(
      form,
      "last_name",
    );

  const fullName =
    [
      prefix,
      firstName,
      lastName,
    ]
      .filter(Boolean)
      .join(" ");

  const studentId =
    value(
      form,
      "student_id",
    );

  /* =========================
     STEP 2
     CONTACT + ACCOUNT
  ========================= */

  const phone =
    value(
      form,
      "phone",
    );

  const address =
    value(
      form,
      "address",
    );

  const email =
    value(
      form,
      "email",
    ).toLowerCase();

  const password =
    String(
      form.get(
        "password",
      ) ?? "",
    );

  const confirmPassword =
    String(
      form.get(
        "confirm_password",
      ) ?? "",
    );

  /* =========================
     STEP 3
     EDUCATION
  ========================= */

  const department =
    value(
      form,
      "department",
    );

  const major =
    value(
      form,
      "major",
    );

  const educationLevel =
    value(
      form,
      "education_level",
    );

  const studyYear =
    value(
      form,
      "study_year",
    );

  const gpa =
    value(
      form,
      "gpa",
    );

  /* =========================
     STEP 4
     FAMILY
  ========================= */

  const familyIncome =
    value(
      form,
      "family_income",
    );

  const familyMembers =
    value(
      form,
      "family_members",
    );

  const parentStatus =
    value(
      form,
      "parent_status",
    );

  const parentStatusOther =
    value(
      form,
      "parent_status_other",
    );

  const emergencyName =
    value(
      form,
      "emergency_name",
    );

  const emergencyPhone =
    value(
      form,
      "emergency_phone",
    );

  const activities =
    value(
      form,
      "activities",
    );

  /* =========================
     STEP 5
     BANK
  ========================= */

  const bankName =
    value(
      form,
      "bank_name",
    );

  const accountHolder =
    value(
      form,
      "account_holder",
    );

  const accountNumber =
    value(
      form,
      "account_number",
    );

  /* =========================
     VALIDATE NAME
  ========================= */

  const allowedPrefixes = [
    "นาย",
    "นางสาว",
    "นาง",
  ];

  if (
    !allowedPrefixes.includes(
      prefix,
    ) ||
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

  /* =========================
     STUDENT ID
  ========================= */

  if (
    !/^[0-9]{8,12}$/.test(
      studentId,
    )
  ) {
    return {
      error:
        "รหัสนักศึกษาต้องเป็นตัวเลข 8–12 หลัก",
      success: "",
    };
  }

  /* =========================
     PHONE
  ========================= */

  if (
    !/^0[0-9]{9}$/.test(
      phone,
    )
  ) {
    return {
      error:
        "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก โดยขึ้นต้นด้วย 0",
      success: "",
    };
  }

  /* =========================
     ADDRESS
  ========================= */

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

  /* =========================
     EMAIL
  ========================= */

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

  /* =========================
     PASSWORD
  ========================= */

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

  if (
    password !==
    confirmPassword
  ) {
    return {
      error:
        "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน",
      success: "",
    };
  }

  /* =========================
     EDUCATION
  ========================= */

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

  if (
    !major ||
    major.length > 150
  ) {
    return {
      error:
        "กรุณากรอกสาขาวิชา",
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
      error:
        "กรุณาเลือกระดับการศึกษา",
      success: "",
    };
  }

  if (
    !/^[1-8]$/.test(
      studyYear,
    )
  ) {
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

  /* =========================
     FAMILY
  ========================= */

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      familyIncome,
    ) ||
    Number(
      familyIncome,
    ) < 0 ||
    Number(
      familyIncome,
    ) > 100000000
  ) {
    return {
      error:
        "รายได้ครอบครัวไม่ถูกต้อง",
      success: "",
    };
  }

  if (
    !/^[1-9]\d?$/.test(
      familyMembers,
    )
  ) {
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
    parentStatus ===
      "other" &&
    !parentStatusOther
  ) {
    return {
      error:
        "กรุณาระบุสถานะบิดามารดา",
      success: "",
    };
  }

  /* =========================
     EMERGENCY CONTACT
  ========================= */

  if (
    emergencyName.length > 200
  ) {
    return {
      error:
        "ชื่อผู้ติดต่อฉุกเฉินยาวเกินกำหนด",
      success: "",
    };
  }

  if (
    emergencyPhone &&
    !/^0[0-9]{9}$/.test(
      emergencyPhone,
    )
  ) {
    return {
      error:
        "เบอร์โทรศัพท์ฉุกเฉินต้องเป็นตัวเลข 10 หลัก",
      success: "",
    };
  }

  if (
    activities.length > 5000
  ) {
    return {
      error:
        "ข้อมูลกิจกรรมและผลงานยาวเกินกำหนด",
      success: "",
    };
  }

  /* =========================
     BANK
  ========================= */

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

  /* =========================
     CHECK SUPABASE
  ========================= */

  if (
    !isAuthConfigured()
  ) {
    console.error(
      "REGISTER_CONFIG_ERROR:",
      "Supabase auth is not configured",
    );

    return {
      error:
        "ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล",
      success: "",
    };
  }

  try {
    const client =
      await createClient();

    /* =========================
       SIGN UP

       ไม่ใช้ email_confirm: true
       ให้ Supabase ส่ง Email
       ยืนยันสมาชิกเอง
    ========================= */

    const {
      data,
      error,
    } =
      await client.auth.signUp(
        {
          email,
          password,

          options: {
            emailRedirectTo:
              `${siteUrl()}/auth/callback`,

            data: {
              full_name:
                fullName,

              student_id:
                studentId,

              prefix,

              first_name:
                firstName,

              last_name:
                lastName,

              phone,

              department,

              profile_details: {
                address,

                major,

                education_level:
                  educationLevel,

                study_year:
                  studyYear,

                gpa,

                family_income:
                  familyIncome,

                family_members:
                  familyMembers,

                parent_status:
                  parentStatus,

                parent_status_other:
                  parentStatus ===
                  "other"
                    ? parentStatusOther
                    : "",

                emergency_name:
                  emergencyName,

                emergency_phone:
                  emergencyPhone,

                activities,

                bank_name:
                  bankName,

                account_holder:
                  accountHolder,

                account_number:
                  accountNumber,
              },
            },
          },
        },
      );

    /* =========================
       SIGN UP ERROR
       แสดง Error จริงใน Terminal
    ========================= */

    if (error) {
      console.error(
        "REGISTER_SIGNUP_ERROR",
        {
          message:
            error.message,
          code:
            error.code,
          status:
            error.status,
          name:
            error.name,
        },
      );

      let message =
        "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

      if (
        error.status === 429
      ) {
        message =
          "ระบบส่งอีเมลถึงขีดจำกัดชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
      } else if (
        error.code ===
        "email_address_not_authorized"
      ) {
        message =
          "ระบบส่งอีเมลของ Supabase ไม่อนุญาตให้อีเมลนี้รับอีเมลยืนยัน";
      } else if (
        error.code ===
        "weak_password"
      ) {
        message =
          "รหัสผ่านไม่ผ่านข้อกำหนดความปลอดภัย กรุณาใช้รหัสผ่านที่เดายากขึ้น";
      } else if (
        error.code ===
        "user_already_exists"
      ) {
        message =
          "อีเมลนี้มีบัญชีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ";
      } else if (
        error.message
      ) {
        /*
         * ตอนพัฒนาในเครื่อง
         * แสดงข้อความจริงจาก Supabase
         * เพื่อให้รู้ว่าเสียตรงไหน
         */
        if (
          process.env.NODE_ENV ===
          "development"
        ) {
          message =
            `สมัครสมาชิกไม่สำเร็จ: ${error.message}`;
        }
      }

      return {
        error:
          message,
        success: "",
      };
    }

    /* =========================
       CHECK USER CREATED
    ========================= */

    if (
      !data.user
    ) {
      console.error(
        "REGISTER_SIGNUP_ERROR",
        {
          message:
            "Supabase returned no user",
          email,
        },
      );

      return {
        error:
          "Supabase ไม่ได้สร้างบัญชีผู้ใช้ กรุณาตรวจสอบการตั้งค่า Authentication",
        success: "",
      };
    }

    console.log(
      "REGISTER_SIGNUP_SUCCESS",
      {
        userId:
          data.user.id,
        email:
          data.user.email,
        hasSession:
          Boolean(
            data.session,
          ),
        emailConfirmedAt:
          data.user
            .email_confirmed_at,
      },
    );

    /* =========================
       ถ้ามี session กลับมา

       แปลว่า Confirm email
       ไม่ได้บังคับใช้อยู่
    ========================= */

    if (
      data.session
    ) {
      await client.auth.signOut(
        {
          scope:
            "local",
        },
      );

      return {
        error:
          "Supabase ยังไม่ได้บังคับการยืนยันอีเมล กรุณาตรวจสอบ Confirm email ใน Authentication",
        success: "",
      };
    }

    /* =========================
       SUCCESS

       ยังไม่ Login
       ยังไม่ Dashboard
       รอผู้ใช้กดยืนยัน Email
    ========================= */

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