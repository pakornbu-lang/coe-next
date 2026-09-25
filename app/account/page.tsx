import { requireViewer } from "@/lib/auth/server";
import Link from "next/link";
import ProfileOverview from "@/components/account/ProfileOverview";
import EmailChangeForm from "@/components/account/EmailChangeForm";
import { createClient } from "@/lib/supabase/server";
import type { PersonalProfile } from "@/lib/account/types";
import "./account.css";
import { roleLabels } from "@/lib/auth/types";

export const metadata = { title: "บัญชีของฉัน" };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const viewer = await requireViewer();
  const { edit } = await searchParams;
  const client = await createClient();
  const { data, error } = await client.from("portal_profiles").select("phone,department,position,expertise,avatar_path,version,profile_details").eq("id", viewer.id).single();
  if (error || !data) throw new Error("โหลดโปรไฟล์ไม่สำเร็จ");
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw new Error("โหลดข้อมูลอีเมลไม่สำเร็จ");
  return (
    <div className="account-page">
      <header className="profile-heading profile-banner">
        <div className="profile-banner-copy">
          <span className="profile-eyebrow">MY PROFILE</span>
          <h1>โปรไฟล์ของฉัน</h1>
          <p>จัดการข้อมูลส่วนตัวและข้อมูลติดต่อของคุณ</p>
          <span className="profile-role-chip"><span aria-hidden="true"/>บัญชี{roleLabels[viewer.role]}</span>
        </div>
        <div className="profile-banner-art" aria-hidden="true">
          <div className="profile-banner-orbit"/>
          <div className="profile-banner-card">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="24" cy="16" r="7"/><path d="M10 39v-3a14 14 0 0 1 28 0v3"/></svg>
            <span/><span/>
          </div>
          <div className="profile-banner-spark">✦</div>
        </div>
      </header>
      <ProfileOverview key={viewer.id} viewer={viewer} profile={data as PersonalProfile} initialEditing={viewer.role === "student" && edit === "1"} />
      <EmailChangeForm key={viewer.email} email={viewer.email} pendingEmail={auth.user?.new_email} />
    {viewer.role === "student" && <section id="documents" className="panel profile-security"><h2>เอกสารประกอบการสมัครทุน</h2><p>อัปโหลดและติดตามผลตรวจเอกสารได้จากใบสมัครของแต่ละทุน เพื่อให้เอกสารผูกกับรอบสมัครอย่างถูกต้อง</p><Link className="btn secondary" href="/applications">ดูใบสมัครของฉัน</Link></section>}
    </div>
  );
}
