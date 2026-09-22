"use client";

import Link from "next/link";
import {
  useActionState,
  useRef,
  useState,
} from "react";

import {
  registerStudent,
} from "@/app/actions/register";

import DigitsInput from "@/components/forms/DigitsInput";

/* =========================
   REGISTER STEPS
========================= */

const steps = [
  "ข้อมูลส่วนตัว",
  "บัญชีและการติดต่อ",
  "ข้อมูลการศึกษา",
  "ข้อมูลครอบครัว",
  "บัญชีรับเงิน",
];

/* =========================
   OPTIONS
========================= */

const parentStatuses = [
  "อยู่ด้วยกัน",
  "แยกกันอยู่",
  "หย่า",
  "บิดาเสียชีวิต",
  "มารดาเสียชีวิต",
  "เสียชีวิตทั้งคู่",
];

const banks = [
  "ธนาคารกรุงเทพ",
  "ธนาคารกรุงไทย",
  "ธนาคารกรุงศรีอยุธยา",
  "ธนาคารกสิกรไทย",
  "ธนาคารไทยพาณิชย์",
  "ธนาคารทหารไทยธนชาต",
  "ธนาคารออมสิน",
  "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
];

export default function RegisterForm() {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    registerStudent,
    {
      error: "",
      success: "",
    },
  );

  const formRef =
    useRef<HTMLFormElement>(
      null,
    );

  const [
    step,
    setStep,
  ] = useState(0);

  const [
    stepError,
    setStepError,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    parentStatus,
    setParentStatus,
  ] = useState("");

  const [
    bankChoice,
    setBankChoice,
  ] = useState("");

  const [
    customBank,
    setCustomBank,
  ] = useState("");

  /* =========================
     VALIDATE CURRENT STEP
  ========================= */

  function validateCurrentStep() {
    const section =
      formRef.current?.querySelector<HTMLElement>(
        `[data-register-step="${step}"]`,
      );

    const invalid =
      section?.querySelector<
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
      >(":invalid");

    if (invalid) {
      formRef.current?.classList.add(
        "form-validated",
      );

      invalid.reportValidity();
      invalid.focus();

      return false;
    }

    return true;
  }

  /* =========================
     NEXT
  ========================= */

  function nextStep() {
    setStepError("");

    if (!validateCurrentStep()) {
      setStepError(
        "กรุณากรอกข้อมูลในหน้านี้ให้ครบและถูกต้องก่อนกดถัดไป",
      );

      return;
    }

    setStep((current) =>
      Math.min(
        current + 1,
        steps.length - 1,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =========================
     PREVIOUS
  ========================= */

  function previousStep() {
    setStepError("");

    setStep((current) =>
      Math.max(
        current - 1,
        0,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="register-form"
      onInvalidCapture={(event) =>
        event.currentTarget.classList.add(
          "form-validated",
        )
      }
    >
      <p>
        สมัครสมาชิกสำหรับ{" "}
        <strong>
          นักศึกษา (Student)
        </strong>
      </p>

      {/* =========================
          STEPPER
      ========================= */}

      <div
        className="register-stepper"
        aria-label="ขั้นตอนการสมัครสมาชิก"
      >
        {steps.map(
          (
            label,
            index,
          ) => (
            <button
              key={label}
              type="button"
              className={
                index === step
                  ? "current"
                  : index < step
                    ? "complete"
                    : ""
              }
              onClick={() => {
                if (index < step) {
                  setStep(index);

                  window.scrollTo({
                    top: 0,
                    behavior:
                      "smooth",
                  });
                }
              }}
            >
              <span>
                {index + 1}
              </span>

              <small>
                {label}
              </small>
            </button>
          ),
        )}
      </div>

      {/* =====================================================
          STEP 1
          PERSONAL INFORMATION
      ===================================================== */}

      <section
        data-register-step="0"
        hidden={step !== 0}
      >
        <h3>
          ข้อมูลส่วนตัว
        </h3>

        <label htmlFor="register-prefix">
          คำนำหน้าชื่อ *
        </label>

        <select
          id="register-prefix"
          name="prefix"
          required
          defaultValue="นาย"
        >
          <option value="นาย">
            นาย
          </option>

          <option value="นางสาว">
            นางสาว
          </option>

          <option value="นาง">
            นาง
          </option>
        </select>

        <label htmlFor="register-first-name">
          ชื่อ *
        </label>

        <input
          id="register-first-name"
          name="first_name"
          type="text"
          autoComplete="given-name"
          required
          maxLength={100}
        />

        <label htmlFor="register-last-name">
          นามสกุล *
        </label>

        <input
          id="register-last-name"
          name="last_name"
          type="text"
          autoComplete="family-name"
          required
          maxLength={100}
        />

        <label htmlFor="register-id">
          รหัสนักศึกษา *
        </label>

        <DigitsInput
          id="register-id"
          name="student_id"
          minLength={8}
          maxLength={12}
          required
          placeholder="เช่น 67112268"
          title="กรุณากรอกรหัสนักศึกษา 8–12 หลัก"
        />
      </section>

      {/* =====================================================
          STEP 2
          ACCOUNT + CONTACT
      ===================================================== */}

      <section
        data-register-step="1"
        hidden={step !== 1}
      >
        <h3>
          บัญชีและการติดต่อ
        </h3>

        <label htmlFor="register-phone">
          เบอร์โทรศัพท์ *
        </label>

        <DigitsInput
          id="register-phone"
          name="phone"
          minLength={10}
          maxLength={10}
          required
          placeholder="0812345678"
          title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"
        />

        <label htmlFor="register-address">
          ที่อยู่ติดต่อ *
        </label>

        <textarea
          id="register-address"
          name="address"
          required
          minLength={5}
          maxLength={500}
          rows={3}
          autoComplete="street-address"
          placeholder="กรอกที่อยู่ปัจจุบัน"
        />

        <label htmlFor="register-email">
          อีเมลมหาวิทยาลัย *
        </label>

        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@mail.wu.ac.th"
          required
          maxLength={254}
        />

        <label htmlFor="register-password">
          รหัสผ่าน *
        </label>

        <span className="password-field">
          <input
            id="register-password"
            name="password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) =>
                  !current,
              )
            }
            aria-label={
              showPassword
                ? "ซ่อนรหัสผ่าน"
                : "แสดงรหัสผ่าน"
            }
          >
            {showPassword
              ? "ซ่อน"
              : "แสดง"}
          </button>
        </span>

        <label htmlFor="register-confirm">
          ยืนยันรหัสผ่าน *
        </label>

        <span className="password-field">
          <input
            id="register-confirm"
            name="confirm_password"
            type={
              showConfirmPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            placeholder="กรอกรหัสผ่านอีกครั้ง"
          />

          <button
            type="button"
            onClick={() =>
              setShowConfirmPassword(
                (current) =>
                  !current,
              )
            }
            aria-label={
              showConfirmPassword
                ? "ซ่อนรหัสผ่านยืนยัน"
                : "แสดงรหัสผ่านยืนยัน"
            }
          >
            {showConfirmPassword
              ? "ซ่อน"
              : "แสดง"}
          </button>
        </span>

        <p>
          ใช้รหัสผ่านอย่างน้อย
          8 ตัวอักษร
        </p>
      </section>

      {/* =====================================================
          STEP 3
          EDUCATION
      ===================================================== */}

      <section
        data-register-step="2"
        hidden={step !== 2}
      >
        <h3>
          ข้อมูลการศึกษา
        </h3>

        <label htmlFor="register-department">
          คณะ / สำนักวิชา *
        </label>

        <input
          id="register-department"
          name="department"
          type="text"
          required
          maxLength={150}
          placeholder="เช่น สำนักวิชาวิศวกรรมศาสตร์และเทคโนโลยี"
        />

        <label htmlFor="register-major">
          สาขาวิชา *
        </label>

        <input
          id="register-major"
          name="major"
          type="text"
          required
          maxLength={150}
          placeholder="เช่น วิศวกรรมคอมพิวเตอร์และปัญญาประดิษฐ์"
        />

        <label htmlFor="register-education-level">
          ระดับการศึกษา *
        </label>

        <select
          id="register-education-level"
          name="education_level"
          required
          defaultValue="ปริญญาตรี"
        >
          <option value="">
            เลือกระดับการศึกษา
          </option>

          <option value="ปริญญาตรี">
            ปริญญาตรี
          </option>

          <option value="ปริญญาโท">
            ปริญญาโท
          </option>

          <option value="ปริญญาเอก">
            ปริญญาเอก
          </option>

          <option value="อื่น ๆ">
            อื่น ๆ
          </option>
        </select>

        <label htmlFor="register-study-year">
          ชั้นปี *
        </label>

        <DigitsInput
          id="register-study-year"
          name="study_year"
          minLength={1}
          maxLength={1}
          required
          placeholder="เช่น 3"
          title="กรุณากรอกชั้นปี 1–8"
        />

        <label htmlFor="register-gpa">
          เกรดเฉลี่ยสะสม
          (GPA) *
        </label>

        <input
          id="register-gpa"
          name="gpa"
          type="number"
          min="0"
          max="4"
          step="0.01"
          required
          placeholder="เช่น 3.45"
        />
      </section>

      {/* =====================================================
          STEP 4
          FAMILY + EMERGENCY
      ===================================================== */}

      <section
        data-register-step="3"
        hidden={step !== 3}
      >
        <h3>
          ข้อมูลครอบครัว
        </h3>

        <label htmlFor="register-family-income">
          รายได้ครอบครัวต่อปี
          (บาท) *
        </label>

        <input
          id="register-family-income"
          name="family_income"
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          required
          placeholder="เช่น 180000"
        />

        <label htmlFor="register-family-members">
          จำนวนสมาชิกในครอบครัว *
        </label>

        <DigitsInput
          id="register-family-members"
          name="family_members"
          minLength={1}
          maxLength={2}
          required
          placeholder="เช่น 4"
          title="กรุณากรอกจำนวนสมาชิกในครอบครัว"
        />

        <label htmlFor="register-parent-status">
          สถานะบิดามารดา *
        </label>

        <select
          id="register-parent-status"
          name="parent_status"
          required
          value={
            parentStatus
          }
          onChange={(event) =>
            setParentStatus(
              event.target.value,
            )
          }
        >
          <option value="">
            เลือกสถานะ
          </option>

          {parentStatuses.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ),
          )}

          <option value="other">
            อื่น ๆ
          </option>
        </select>

        {parentStatus ===
          "other" && (
          <>
            <label htmlFor="register-parent-status-other">
              โปรดระบุสถานะบิดามารดา
              *
            </label>

            <input
              id="register-parent-status-other"
              name="parent_status_other"
              type="text"
              required
              maxLength={150}
            />
          </>
        )}

        <label htmlFor="register-emergency-name">
          ชื่อผู้ติดต่อฉุกเฉิน
        </label>

        <input
          id="register-emergency-name"
          name="emergency_name"
          type="text"
          maxLength={200}
          placeholder="ชื่อ–นามสกุล"
        />

        <label htmlFor="register-emergency-phone">
          โทรศัพท์ฉุกเฉิน
        </label>

        <DigitsInput
          id="register-emergency-phone"
          name="emergency_phone"
          minLength={10}
          maxLength={10}
          title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"
          placeholder="0812345678"
        />

        <label htmlFor="register-activities">
          กิจกรรมและผลงานที่ผ่านมา
        </label>

        <textarea
          id="register-activities"
          name="activities"
          maxLength={5000}
          rows={3}
          placeholder="ระบุกิจกรรม การแข่งขัน หรือผลงานที่ผ่านมา"
        />
      </section>

      {/* =====================================================
          STEP 5
          BANK
      ===================================================== */}

      <section
        data-register-step="4"
        hidden={step !== 4}
      >
        <h3>
          ข้อมูลบัญชีรับเงิน
        </h3>

        <p>
          ใช้สำหรับเป็นข้อมูลพื้นฐานในการรับทุน
          และสามารถแก้ไขภายหลังได้
        </p>

        <input
          type="hidden"
          name="bank_name"
          value={
            bankChoice ===
            "other"
              ? customBank
              : bankChoice
          }
        />

        <label htmlFor="register-bank">
          ธนาคาร *
        </label>

        <select
          id="register-bank"
          name="bank_choice"
          required
          value={
            bankChoice
          }
          onChange={(event) =>
            setBankChoice(
              event.target.value,
            )
          }
        >
          <option value="">
            เลือกธนาคาร
          </option>

          {banks.map(
            (bank) => (
              <option
                key={bank}
                value={bank}
              >
                {bank}
              </option>
            ),
          )}

          <option value="other">
            อื่น ๆ
          </option>
        </select>

        {bankChoice ===
          "other" && (
          <>
            <label htmlFor="register-bank-other">
              ระบุธนาคาร *
            </label>

            <input
              id="register-bank-other"
              name="bank_name_other"
              type="text"
              required
              maxLength={150}
              value={
                customBank
              }
              onChange={(event) =>
                setCustomBank(
                  event.target.value,
                )
              }
            />
          </>
        )}

        <label htmlFor="register-account-holder">
          ชื่อบัญชี *
        </label>

        <input
          id="register-account-holder"
          name="account_holder"
          type="text"
          required
          minLength={2}
          maxLength={200}
          placeholder="ชื่อเจ้าของบัญชี"
        />

        <label htmlFor="register-account-number">
          เลขบัญชี *
        </label>

        <DigitsInput
          id="register-account-number"
          name="account_number"
          minLength={10}
          maxLength={15}
          required
          title="กรุณากรอกเลขบัญชี 10–15 หลัก"
          placeholder="กรอกเลขบัญชี"
        />

        <p className="soft-box">
          เมื่อสมัครสมาชิกสำเร็จ
          ข้อมูลทั้งหมดจะถูกนำไปใช้เป็นข้อมูลโปรไฟล์นักศึกษา
          และแก้ไขได้ภายหลังที่หน้าโปรไฟล์
        </p>
      </section>

      {/* =========================
          ERROR / SUCCESS
      ========================= */}

      {stepError && (
        <p
          className="soft-box"
          role="alert"
        >
          {stepError}
        </p>
      )}

      {state.error && (
        <p
          className="soft-box"
          role="alert"
        >
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          className="soft-box"
          role="status"
        >
          {state.success}
        </p>
      )}

      {/* =========================
          NAVIGATION BUTTONS
      ========================= */}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop:
            "18px",
        }}
      >
        {step > 0 && (
          <button
            className="btn secondary"
            type="button"
            onClick={
              previousStep
            }
            disabled={
              pending
            }
          >
            ย้อนกลับ
          </button>
        )}

        {step <
        steps.length -
          1 ? (
          <button
            className="btn"
            type="button"
            onClick={
              nextStep
            }
          >
            ถัดไป
          </button>
        ) : (
          <button
            className="btn"
            type="submit"
            disabled={
              pending
            }
            onClick={(event) =>
              event.currentTarget.form?.classList.add(
                "form-validated",
              )
            }
          >
            {pending
              ? "กำลังสมัครสมาชิก…"
              : "สมัครสมาชิกนักศึกษา"}
          </button>
        )}
      </div>

      <p className="auth-switch">
        มีบัญชีแล้ว?{" "}
        <Link href="/login">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}