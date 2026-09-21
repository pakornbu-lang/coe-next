import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "เกี่ยวกับระบบ" };

export default function AboutPage() {
  return (
    <div className="portal-page-stack">
      <PageHeader title="เกี่ยวกับระบบ" description="ร่วมดูแลทุนการศึกษา ตั้งแต่การสมัครจนถึงการติดตามผล" />
      <Card className="portal-prose">
        <h2>ระบบติดตามทุนการศึกษา</h2>
        <p>ระบบจัดการและติดตามทุนการศึกษาภายในมหาวิทยาลัย เพื่อให้นักศึกษา เจ้าหน้าที่ คณะกรรมการ และผู้ดูแลระบบทำงานร่วมกันได้อย่างเป็นขั้นตอน</p>
        <h2>สิ่งที่ใช้งานได้</h2>
        <ul>
          <li>สมัครสมาชิกและเข้าสู่ระบบตามบทบาท</li>
          <li>สร้างและประกาศทุน พร้อมเอกสารและเกณฑ์ให้คะแนน</li>
          <li>บันทึกใบสมัคร อัปโหลดเอกสาร ตรวจเอกสาร ประเมิน ตัดสินผล และบันทึกการจ่ายทุน</li>
          <li>เก็บเอกสารและหลักฐานการโอนแบบ private ตามสิทธิ์ของผู้ใช้</li>
        </ul>
        <p className="portal-demo-note">ระบบบันทึกข้อมูลการโอนเงินและหลักฐาน แต่ไม่เชื่อมต่อธนาคารเพื่อสั่งโอนเงินจริง</p>
      </Card>
    </div>
  );
}
