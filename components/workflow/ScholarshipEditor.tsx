"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { numericInputProps } from "@/lib/numeric-input";
import {
  saveScholarship,
  type WorkflowState,
} from "@/app/actions/scholarships";
import type {
  Criterion,
  Requirement,
  ScholarshipProgramKind,
  ScholarshipStatus,
  ScholarshipSummary,
} from "@/lib/scholarships/types";
import { ScholarshipStatusBadge } from "./StatusBadge";
import SearchableMultiSelect from "@/components/forms/SearchableMultiSelect";
import MoneyInput from "@/components/forms/MoneyInput";
import {
  CriterionEditor,
  RequirementEditor,
  parseCriterionRows,
  parseRequirementRows,
} from "./ScholarshipStructureEditor";

const empty: WorkflowState = {
  error: "",
  success: "",
};

function toDateTimeLocal(
  value?: string,
  fallbackOffset = 60 * 60 * 1000,
) {
  const date = value
    ? new Date(value)
    : new Date(Date.now() + fallbackOffset);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>(
      (all, part) => ({
        ...all,
        [part.type]: part.value,
      }),
      {},
    );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const defaultRequirements =
  "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
  "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน";

const defaultCriteria =
  "ผลการเรียน | 30 | ผลการเรียนและพัฒนาการ\n" +
  "ความจำเป็น / ความเหมาะสม | 30 | ฐานะทางการเงินและเหตุผลสมัคร\n" +
  "กิจกรรมและผลงาน | 20 | การมีส่วนร่วมและผลงาน\n" +
  "สัมภาษณ์ / ภาพรวม | 20 | ศักยภาพและความเหมาะสม";

const programs: {
  value: ScholarshipProgramKind;
  label: string;
  requirements: string;
  criteria: string;
  eligibility: string;
}[] = [
    {
      value: "academic",
      label: "ทุนผลการเรียนดี",
      requirements:
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
        "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน",
      criteria:
        "ผลการเรียน | 60 | GPA และผลการเรียน\n" +
        "กิจกรรมและผลงาน | 20 | ผลงานหรือกิจกรรมที่เกี่ยวข้อง\n" +
        "ความเหมาะสม | 20 | คุณสมบัติตามประกาศ",
      eligibility: "มีผลการเรียนตรงตามเกณฑ์ที่กำหนดในประกาศ",
    },
    {
      value: "financial_need",
      label: "ทุนขาดแคลนทุนทรัพย์",
      requirements:
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
        "เอกสารรับรองรายได้ครอบครัว | เอกสารยืนยันฐานะการเงิน\n" +
        "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน",
      criteria:
        "ความจำเป็นทางการเงิน | 50 | รายได้และภาระครอบครัว\n" +
        "ผลการเรียน | 25 | GPA และความต่อเนื่องทางการศึกษา\n" +
        "เหตุผลในการสมัคร | 25 | ความชัดเจนและความเหมาะสม",
      eligibility:
        "เป็นนักศึกษาปัจจุบันและมีความจำเป็นด้านทุนทรัพย์",
    },
    {
      value: "activity",
      label: "ทุนกิจกรรมและความเป็นผู้นำ",
      requirements:
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
        "หลักฐานกิจกรรม / เกียรติบัตร | เอกสารหรือภาพผลงาน\n" +
        "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน",
      criteria:
        "ผลงานกิจกรรม | 45 | บทบาทและผลลัพธ์ของกิจกรรม\n" +
        "ภาวะผู้นำ | 30 | ประสบการณ์และความรับผิดชอบ\n" +
        "ผลการเรียน | 25 | GPA และความต่อเนื่อง",
      eligibility:
        "มีผลงานกิจกรรมหรือบทบาทผู้นำที่ตรวจสอบได้",
    },
    {
      value: "talent",
      label: "ทุนความสามารถพิเศษ",
      requirements:
        "หลักฐานความสามารถพิเศษ | เกียรติบัตร ผลงาน หรือแฟ้มสะสมงาน\n" +
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
        "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน",
      criteria:
        "ความสามารถและผลงาน | 60 | คุณภาพ ระดับ และความต่อเนื่องของผลงาน\n" +
        "ศักยภาพพัฒนา | 25 | แผนการต่อยอดความสามารถ\n" +
        "ผลการเรียน | 15 | GPA และความต่อเนื่อง",
      eligibility:
        "มีความสามารถพิเศษและหลักฐานผลงานตามประกาศ",
    },
    {
      value: "research",
      label: "ทุนวิจัยและนวัตกรรม",
      requirements:
        "ข้อเสนอโครงการ | วัตถุประสงค์ วิธีดำเนินงาน และงบประมาณ\n" +
        "หนังสือรับรองอาจารย์ที่ปรึกษา | ลงนามโดยอาจารย์ที่ปรึกษา\n" +
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด",
      criteria:
        "คุณภาพข้อเสนอโครงการ | 45 | ความชัดเจนและความเป็นไปได้\n" +
        "ผลกระทบและนวัตกรรม | 30 | ประโยชน์และความใหม่\n" +
        "ความพร้อมของผู้สมัคร | 25 | ผลงานและแผนดำเนินงาน",
      eligibility:
        "มีโครงการวิจัยหรือนวัตกรรมที่ได้รับการรับรองจากอาจารย์ที่ปรึกษา",
    },
    {
      value: "emergency",
      label: "ทุนฉุกเฉิน",
      requirements:
        "เอกสารยืนยันเหตุฉุกเฉิน | เอกสารประกอบเหตุการณ์หรือค่าใช้จ่าย\n" +
        "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\n" +
        "เอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน",
      criteria:
        "ความเร่งด่วน | 50 | ผลกระทบต่อการศึกษา\n" +
        "ความจำเป็นทางการเงิน | 35 | ภาระและทรัพยากรที่มี\n" +
        "แผนการศึกษา | 15 | ความต่อเนื่องในการเรียน",
      eligibility:
        "ประสบเหตุจำเป็นเร่งด่วนที่กระทบต่อการศึกษา",
    },
    {
      value: "general",
      label: "ทุนทั่วไป",
      requirements: defaultRequirements,
      criteria: defaultCriteria,
      eligibility:
        "เป็นนักศึกษาปัจจุบันและมีคุณสมบัติตามประกาศ",
    },
  ];

/* =========================================================
   รายชื่อสำนักวิชา / วิทยาลัย มหาวิทยาลัยวลัยลักษณ์
   ========================================================= */

const walailakAcademicUnits = [
  "สำนักวิชาการจัดการ",
  "สำนักวิชาการบัญชีและการเงิน",
  "สำนักวิชาเทคโนโลยีการเกษตรและอุตสาหกรรมอาหาร",
  "สำนักวิชานิติศาสตร์",
  "สำนักวิชาพยาบาลศาสตร์",
  "สำนักวิชาพหุภาษาและการศึกษาทั่วไป",
  "สำนักวิชาแพทยศาสตร์",
  "สำนักวิชาเภสัชศาสตร์",
  "สำนักวิชารัฐศาสตร์และรัฐประศาสนศาสตร์",
  "สำนักวิชาวิทยาศาสตร์",
  "สำนักวิชาวิศวกรรมศาสตร์และเทคโนโลยี",
  "สำนักวิชาศิลปศาสตร์",
  "สำนักวิชาศึกษาศาสตร์",
  "สำนักวิชาสถาปัตยกรรมศาสตร์และการออกแบบ",
  "สำนักวิชาสหเวชศาสตร์",
  "สำนักวิชาสาธารณสุขศาสตร์",
  "สำนักวิชาสารสนเทศศาสตร์",
  "วิทยาลัยทันตแพทยศาสตร์นานาชาติ",
  "วิทยาลัยนานาชาติ",
  "วิทยาลัยสัตวแพทยศาสตร์อัครราชกุมารี",
  "บัณฑิตวิทยาลัย",
];

type ScholarshipEditorScholarship = ScholarshipSummary & {
  requirements: Requirement[];
  criteria: Criterion[];

  /*
   * รองรับข้อมูลนี้ไว้สำหรับตอนเชื่อมฐานข้อมูล
   * ถ้ายังไม่มี field นี้ ระบบก็ยังเปิดหน้าสร้างทุนได้ตามปกติ
   */
  eligible_faculties?: string[];
};

export default function ScholarshipEditor({
  scholarship,
  types,
  academicOptions = { faculties: [], majors: [] },
}: {
  academicOptions?: { faculties: string[]; majors: string[]; documentTypes?: string[] };
  scholarship?: ScholarshipEditorScholarship;
  types: {
    id: string;
    name: string;
  }[];
}) {
  const router = useRouter();

  const [state, action, pending] = useActionState(
    saveScholarship,
    empty,
  );

  const [programKind, setProgramKind] =
    useState<ScholarshipProgramKind>(
      scholarship?.program_kind ?? "general",
    );

  /* =========================================================
     คณะ / สำนักวิชาที่เปิดรับสมัคร
     ========================================================= */

  const [facultyScope, setFacultyScope] = useState<
    "all" | "selected"
  >(
    scholarship?.eligible_faculties?.length
      ? "selected"
      : "all",
  );

  const [selectedFaculties, setSelectedFaculties] = useState<
    string[]
  >(scholarship?.eligible_faculties ?? []);

  const [selectedMajors, setSelectedMajors] = useState<string[]>(scholarship?.eligible_majors ?? []);

  const eligibilityRef =
    useRef<HTMLTextAreaElement>(null);

  const [requirementRows, setRequirementRows] =
    useState(() =>
      scholarship?.requirements.map((item) => ({
        label: item.label,
        details: item.details,
        required: item.required,
      })) ?? parseRequirementRows(defaultRequirements),
    );

  const [criterionRows, setCriterionRows] =
    useState(() =>
      scholarship?.criteria.map((item) => ({
        label: item.label,
        details: item.details,
        maxScore: String(item.max_score),
      })) ?? parseCriterionRows(defaultCriteria),
    );

  useEffect(() => {
    if (state.success) {
      router.push("/staff/scholarships");
    }
  }, [router, state.success]);

  const applyTemplate = (
    template: (typeof programs)[number],
  ) => {
    setProgramKind(template.value);

    setRequirementRows(
      parseRequirementRows(template.requirements),
    );

    setCriterionRows(
      parseCriterionRows(template.criteria),
    );

    if (
      eligibilityRef.current &&
      !eligibilityRef.current.value.trim()
    ) {
      eligibilityRef.current.value =
        template.eligibility;
    }
  };

  return (
    <form
      action={action}
      className="workflow-form"
      onInvalidCapture={(event) =>
        event.currentTarget.classList.add(
          "form-validated",
        )
      }
    >
      <input
        type="hidden"
        name="id"
        value={scholarship?.id ?? ""}
      />

      <input
        type="hidden"
        name="version"
        value={scholarship?.version ?? ""}
      />

      <input
        type="hidden"
        name="current_cover_path"
        value={scholarship?.cover_path ?? ""}
      />

      {/* =====================================================
          หัวข้อ
          ===================================================== */}

      <section className="panel workflow-heading">
        <div>
          <span className="workflow-eyebrow">
            SCHOLARSHIP MANAGEMENT
          </span>

          <h1>
            {scholarship
              ? "แก้ไขทุนการศึกษา"
              : "สร้างทุนการศึกษา"}
          </h1>

          <p>
            หนึ่งรายการทุนคือหนึ่งรอบรับสมัคร
            เพื่อป้องกันการสมัครซ้ำและติดตามผลได้ชัดเจน
          </p>
        </div>

        {scholarship && (
          <ScholarshipStatusBadge
            status={scholarship.status}
          />
        )}
      </section>

      {/* =====================================================
          รูปแบบทุน
          ===================================================== */}

      <section className="panel">
        <h2>รูปแบบทุนและแม่แบบ</h2>

        <p className="workflow-muted">
          เลือกแม่แบบเพื่อเติมเอกสารและเกณฑ์คะแนนตามประเภททุน
          แล้วแก้ไขรายละเอียดให้ตรงกับประกาศจริงได้
        </p>

        <div className="workflow-template-list">
          {programs.map((template) => (
            <button
              type="button"
              key={template.value}
              className={`btn secondary ${programKind === template.value
                ? "selected"
                : ""
                }`}
              onClick={() =>
                applyTemplate(template)
              }
            >
              {template.label}
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================
          รายละเอียดทุน
          ===================================================== */}

      <section className="panel">
        <h2>รายละเอียดทุน</h2>

        <div className="workflow-grid">
          {/* ชื่อทุน */}

          <label className="workflow-wide">
            ชื่อทุน *
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              defaultValue={
                scholarship?.title ?? ""
              }
            />
          </label>

          {/* รูปแบบทุน */}

          <label>
            รูปแบบทุน *
            <select
              name="program_kind"
              required
              value={programKind}
              onChange={(event) =>
                setProgramKind(
                  event.target
                    .value as ScholarshipProgramKind,
                )
              }
            >
              {programs.map((program) => (
                <option
                  key={program.value}
                  value={program.value}
                >
                  {program.label}
                </option>
              ))}
            </select>
          </label>

          {/* ประเภททุน */}

          <label>
            ประเภททุน (ข้อมูลอ้างอิง)
            <select
              name="scholarship_type_id"
              defaultValue={
                scholarship?.scholarship_type_id ??
                ""
              }
            >
              <option value="">
                ไม่ระบุ
              </option>

              {types.map((type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          {/* สถานะ */}

          <label>
            สถานะ *
            <select
              name="status"
              required
              defaultValue={
                (scholarship?.status ??
                  "draft") as ScholarshipStatus
              }
            >
              <option value="draft">
                ฉบับร่าง
              </option>

              <option value="published">
                เปิดรับสมัคร
              </option>

              <option value="closed">
                ปิดรับสมัคร
              </option>

              <option value="archived">
                เก็บถาวร
              </option>
            </select>
          </label>

          {/* จำนวนเงิน */}

          <label>
            จำนวนเงินต่อคน (บาท) *
            <MoneyInput
              name="amount"
              required
              defaultValue={
                scholarship?.amount ?? ""
              }
            />
          </label>

          {/* จำนวนทุน */}

          <label>
            จำนวนโควตา (คน) *
            <input
              name="quota"
              type="number"
              required
              min="1"
              step="1"
              {...numericInputProps("integer")}
              defaultValue={
                scholarship?.quota ?? ""
              }
            />
          </label>

          {/* GPA */}

          <label>
            GPA ขั้นต่ำ
            <input
              name="minimum_gpa"
              type="number"
              min="0"
              max="4"
              step="0.01"
              {...numericInputProps("decimal")}
              defaultValue={
                scholarship?.minimum_gpa ?? ""
              }
            />
          </label>

          {/* เปิดรับ */}

          <label>
            เปิดรับสมัคร *
            <input
              name="opens_at"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocal(
                scholarship?.opens_at,
              )}
            />
          </label>

          {/* ปิดรับ */}

          <label>
            ปิดรับสมัคร *
            <input
              name="closes_at"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocal(
                scholarship?.closes_at,
                30 * 24 * 60 * 60 * 1000,
              )}
            />
          </label>

          <fieldset className="workflow-wide academic-audience"><legend>คณะ / สำนักวิชาและสาขาที่เปิดรับสมัคร</legend>
            <label><input type="radio" name="faculty_scope" value="all" checked={facultyScope === "all"} onChange={() => setFacultyScope("all")}/> ทุกสำนักวิชาและทุกสาขา</label>
            <label><input type="radio" name="faculty_scope" value="selected" checked={facultyScope === "selected"} onChange={() => setFacultyScope("selected")}/> ระบุสำนักวิชา / สาขา</label>
            {facultyScope === "selected" && <div className="workflow-grid">
              <SearchableMultiSelect label="คณะ / สำนักวิชา" name="eligible_faculties" options={academicOptions.faculties.length ? academicOptions.faculties : walailakAcademicUnits} values={selectedFaculties} onChange={setSelectedFaculties} required/>
              <SearchableMultiSelect label="สาขาวิชา" name="eligible_majors" options={academicOptions.majors} values={selectedMajors} onChange={setSelectedMajors}/>
              <p className="workflow-wide workflow-muted">เลือกได้หลายรายการ ไม่เลือกสาขาหมายถึงทุกสาขาของสำนักวิชาที่เลือก หากไม่มีสาขาในรายการ ให้ผู้ดูแลระบบเพิ่มที่ข้อมูลพื้นฐาน</p>
            </div>}
          </fieldset>

          {/* ภาพปก */}

          <label className="workflow-wide">
            ภาพปกทุน (JPG, PNG หรือ WebP
            ไม่เกิน 5 MB)
            <input
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />

            {scholarship?.cover_path && (
              <small className="workflow-muted">
                มีภาพปกเดิมอยู่แล้ว
                เลือกไฟล์ใหม่เมื่อต้องการแทนที่
              </small>
            )}
          </label>

          {/* รายละเอียด */}

          <label className="workflow-wide">
            รายละเอียดทุน *
            <textarea
              name="description"
              required
              maxLength={5000}
              rows={5}
              defaultValue={
                scholarship?.description ?? ""
              }
            />
          </label>

          {/* คุณสมบัติ */}

          <label className="workflow-wide">
            คุณสมบัติและเงื่อนไข
            <textarea
              ref={eligibilityRef}
              name="eligibility"
              maxLength={5000}
              rows={5}
              defaultValue={
                scholarship?.eligibility ?? ""
              }
            />
          </label>
        </div>
      </section>

      {/* =====================================================
          เอกสาร
          ===================================================== */}

      <section className="panel">
        <h2>เอกสารที่ต้องใช้</h2>

        <p className="workflow-muted">
          เพิ่ม ลบ เรียงลำดับ
          และกำหนดว่าเอกสารใดบังคับได้จากตารางนี้
        </p>

        <RequirementEditor
          documentTypes={academicOptions.documentTypes}
          rows={requirementRows}
          onChange={setRequirementRows}
        />
      </section>

      {/* =====================================================
          เกณฑ์คะแนน
          ===================================================== */}

      <section className="panel">
        <h2>เกณฑ์ให้คะแนน</h2>

        <p className="workflow-muted">
          กำหนดชื่อเกณฑ์ คะแนนเต็ม และคำอธิบาย
          ระบบจะแสดงคะแนนรวมให้อัตโนมัติ
        </p>

        <CriterionEditor
          rows={criterionRows}
          onChange={setCriterionRows}
        />
      </section>

      {/* =====================================================
          เหตุผล
          ===================================================== */}

      <section className="panel">
        <label>
          เหตุผลในการสร้างหรือแก้ไข *
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            placeholder="เช่น เปิดรับสมัครประจำปีการศึกษา 2569"
          />
        </label>
      </section>

      {/* =====================================================
          ปุ่มด้านล่าง
          ===================================================== */}

      <div className="workflow-actions">
        <Link
          className="btn secondary"
          href="/staff/scholarships"
        >
          ยกเลิก
        </Link>

        <button
          className="btn"
          disabled={pending}
          onClick={(event) =>
            event.currentTarget.form?.classList.add(
              "form-validated",
            )
          }
         aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}
          {pending
            ? "กำลังบันทึก…"
            : scholarship
              ? "บันทึกการแก้ไข"
              : "สร้างทุน"}
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          className="workflow-error"
        >
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          role="status"
          className="workflow-success"
        ><span className="action-success-mark" aria-hidden="true">✓</span>
          {state.success}
        </p>
      )}
    </form>
  );
}
