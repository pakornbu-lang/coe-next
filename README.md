# ระบบติดตามทุนการศึกษา

ใช้ Next.js App Router + TypeScript และ Supabase Auth, Postgres และ private Storage สำหรับจัดการทุนหนึ่งรอบต่อหนึ่งประกาศ ตั้งแต่รับสมัคร ตรวจเอกสาร ประเมิน ตัดสินผล จนถึงบันทึกการจ่ายทุน

## เปิดโปรเจกต์

เปิดโฟลเดอร์ `coe-next` ที่มี `package.json` และ `.git` อยู่ภายใน ใช้ Node.js 22 ขึ้นไป

```bash
npm ci
```

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ Project URL และ Publishable key ของ Supabase โปรเจกต์เดียวกับทีม (เครื่องที่ตั้งค่าแล้วไม่ต้องคัดลอกทับ) จากนั้น:

```bash
npm run dev
```

เปิด [หน้าเข้าสู่ระบบ](http://localhost:3000/login) บน Windows PowerShell สามารถใช้ `npm.cmd` แทน `npm` ได้

ดู [คู่มือระบบบัญชีและสิทธิ์](docs/authentication.md) สำหรับการตั้งค่า สร้างบัญชี ขอบเขตระบบ และทดสอบ ห้ามอัปโหลดรหัสผ่าน `.env.local` หรือ Secret/Service role key ขึ้น Git

## ติดตั้ง Supabase ก่อนใช้งานจริง

ล็อกอิน CLI ไปยังบัญชีที่เป็นสมาชิกของ Supabase project เป้าหมาย แล้วเชื่อมและ push migration ตามลำดับนี้:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`project-ref` คือส่วนหน้าของ URL ใน `.env.local` เช่น `https://abcxyz.supabase.co` มี project ref เป็น `abcxyz` หลัง push ให้สร้างหรือกำหนดบัญชี Admin ตาม [คู่มือระบบบัญชี](docs/authentication.md) ก่อนใช้งานส่วนจัดการสมาชิก การ login ด้วย CLI ไม่ต้องนำ access token มาใส่ใน source code

อ่าน [คู่มือ workflow ทุน](docs/scholarship-workflow.md) เพื่อดูบทบาท สถานะ ขอบเขตข้อมูล และรายการทดสอบก่อนเปิดใช้งาน

## หน้าเว็บและสิทธิ์

| URL | หน้าที่ / สิทธิ์ |
| --- | --- |
| `/` | หน้าแรกสาธารณะ |
| `/login` | เข้าสู่ระบบจริงด้วยอีเมลและรหัสผ่าน |
| `/register` | สมัครนักศึกษาจริง (ต้องตั้ง SMTP สำหรับยืนยันอีเมล) |
| `/scholarships`, `/scholarships/[id]` | รายการและรายละเอียดทุนที่ประกาศแล้ว (สาธารณะ) |
| `/dashboard`, `/profile`, `/applications`, `/apply` | นักศึกษา |
| `/staff`, `/staff/scholarships`, `/staff/review`, `/scholarships/new` | เจ้าหน้าที่: จัดการทุน ตรวจเอกสาร มอบหมายกรรมการ ตัดสินผล และบันทึกจ่ายทุน |
| `/committee`, `/staff/evaluation` | กรรมการ |
| `/admin`, `/admin/reference`, `/admin/audit` | Admin: สมาชิก ข้อมูลพื้นฐาน และประวัติ |
| `/account` | ข้อมูลจริงของบัญชีที่เข้าสู่ระบบ |
| `/menu` | ส่งกลับหน้าหลักตามบทบาท |
| `/about` | ข้อมูลระบบ |
| `/access-denied` | แจ้งเมื่อไม่มีสิทธิ์เปิดหน้า |

ผู้ดูแลกำหนดชื่อ รหัสนักศึกษา บทบาท และสถานะบัญชีใน `portal_profiles` ส่วนรหัสผ่านจัดการโดย Supabase Auth ผู้ใช้ไม่สามารถแก้บทบาทของตัวเองผ่านเว็บหรือ Data API

ข้อมูลทุน ใบสมัคร เอกสาร ผลประเมิน และการจ่ายทุนบันทึกด้วย RPC ที่ตรวจสิทธิ์ซ้ำในฐานข้อมูล เอกสารและหลักฐานการโอนอยู่ใน Supabase Storage แบบ private และเปิดผ่าน signed URL ระยะสั้นเท่านั้น

## โครงสร้างส่วนกลาง

```text
app/
  layout.tsx                 # อ่านบัญชีที่ยืนยันแล้วและครอบด้วย Shell
  scholarships/               # รายการทุนสาธารณะและรายละเอียดทุน
  applications/, apply/       # ใบสมัครนักศึกษาและเอกสารส่วนตัว
  staff/                       # งานเจ้าหน้าที่และกรรมการ
  admin/                    # สมาชิก ข้อมูลพื้นฐาน ประวัติจริง
  actions/scholarships.ts   # การบันทึกทุน ใบสมัคร เอกสาร ผลประเมิน และจ่ายทุน
  actions/admin.ts          # คำสั่ง Admin ผ่าน RPC
  actions/auth.ts            # เข้าสู่ระบบและออกจากระบบฝั่งเซิร์ฟเวอร์
  account/page.tsx           # ข้อมูลบัญชีจริง
  committee/page.tsx         # พื้นที่กรรมการ
  access-denied/page.tsx
  globals.css
  ui-v1.css                  # หน้าตา portal ปัจจุบัน
components/
  auth/                     # ฟอร์มล็อกอินและปุ่มออกจากระบบ
  portal/Shell.tsx           # Header, Navbar ตามบัญชี, main และ footer
  workflow/                 # ฟอร์มและสถานะของ workflow ทุน
  ui/                       # ส่วนประกอบ UI ที่ใช้ซ้ำ
lib/
  auth/                     # Viewer, role และการตรวจสิทธิ์บนเซิร์ฟเวอร์
  supabase/                 # Supabase client ฝั่งเซิร์ฟเวอร์
  scholarships/             # Query และ type สำหรับข้อมูลจริง
proxy.ts                    # ต่ออายุคุกกี้และกำหนด cache header
supabase/migrations/        # สคีมา, RPC, RLS และ Storage policies
scripts/check-auth.mjs     # ตรวจสิทธิ์กับระบบจริง
```

`layouts/AppLayout.tsx`, `components/Navbar.tsx`, `lib/navigation.ts` เป็นส่วนของเทมเพลตรุ่นก่อน เมนูที่ใช้อยู่ตอนนี้อยู่ใน `components/portal/Shell.tsx`

## เพิ่มหน้าของสมาชิกในทีม

สร้าง `app/<ชื่อโมดูล>/page.tsx` โดยไม่ต้องครอบ Shell ซ้ำ หน้าที่ต้องใช้บัญชีให้ตรวจสิทธิ์ก่อนคืนเนื้อหา เช่น:

```tsx
import { requireRole } from "@/lib/auth/server";

export default async function ApplicationsPage() {
  const viewer = await requireRole(["student"]);
  return <section className="panel">ใบสมัครของ {viewer.fullName}</section>;
}
```

- เพิ่มเมนูตามบทบาทที่ `components/portal/Shell.tsx` หลังจากมีหน้าเป้าหมายแล้ว
- ใช้ `next/link` สำหรับเปลี่ยนหน้า
- แยกส่วนที่ใช้ state/event handlers เป็น Client Component
- ทุก Server Action และ Route Handler ต้องตรวจสิทธิ์และเจ้าของข้อมูลซ้ำ ไม่เชื่อ role/user ID จากฟอร์มหรือ URL
- ตารางใหม่ต้องมี RLS ของโมดูลนั้น การซ่อนเมนูหรือป้องกันหน้าเว็บอย่างเดียวไม่คุ้มครอง Data API
- อ่าน `AGENTS.md` และเอกสาร Next.js ที่ติดตั้งก่อนพัฒนา

## ตรวจงานก่อนส่ง

หน้าโปรไฟล์จริงใช้ร่วมกันทุกบทบาทที่ `/profile` ดูฟิลด์ที่แก้ไขได้ การตั้งค่า และวิธีทดสอบใน [docs/profiles.md](docs/profiles.md)

```bash
npm run lint
npm run build
```

ทดสอบล็อกอินทั้งสี่บทบาท รหัสผ่านผิด รีเฟรช เปิด URL ที่ไม่มีสิทธิ์ และออกจากระบบ จากนั้นทดสอบ flow ทุนตาม [docs/scholarship-workflow.md](docs/scholarship-workflow.md)

## การจัดการ branch

- `main` เป็น branch หลักสำหรับงานที่รวมแล้ว
- สร้าง branch งานใหม่จาก `main` โดยใช้ `feature/<ชื่องาน>`, `fix/<ชื่อปัญหา>` หรือ `chore/<ชื่องาน>`
- ส่งงานผ่าน Pull Request เข้า `main` และลบ branch งานหลังรวมสำเร็จ
- ตรวจ `git status` ก่อนสลับ branch เพื่อไม่ให้มีงานค้างปะปน

สำหรับ checkout นี้ `origin` คือ `https://github.com/pakornbu-lang/coe-next.git` ตรวจ remote ของเครื่องตนเองด้วย `git remote -v` ก่อนส่งงาน

ตัวอย่างเริ่มงานใหม่เมื่อไม่มีงานค้าง:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/your-task
```

เมื่อทำงานและ commit เรียบร้อย ให้ส่ง branch ของตนเองแล้วเปิด Pull Request:

```bash
git push -u origin feature/your-task
```

หากทำงานผ่าน fork ให้ตั้ง `origin` เป็น fork ของตนเอง และเพิ่ม `upstream` ที่ชี้ไปยัง repository หลักก่อนซิงก์งาน
