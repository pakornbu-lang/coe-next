import "server-only";

type NotificationEmail = {
  subject: string;
  body: string;
  actionUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function heading(subject: string) {
  return subject.replace(/^\[ระบบทุนการศึกษา\]\s*/, "").trim() || "มีรายการใหม่ในระบบ";
}

function recipient(href: string) {
  if (href.startsWith("/staff/")) return "เจ้าหน้าที่ทุน";
  if (href.startsWith("/committee")) return "คณะกรรมการ";
  return "นักศึกษา";
}

function actionLabel(href: string, value: string) {
  if (/แก้ไขเอกสาร/.test(value)) return "เข้าสู่ระบบเพื่อแก้ไขเอกสาร";
  if (href.startsWith("/staff/review")) return "เปิดรายการเพื่อตรวจสอบ";
  if (href.startsWith("/committee")) return "เปิดรายการเพื่อประเมิน";
  if (href.startsWith("/disbursements")) return "ดูรายละเอียดการจ่ายทุน";
  return "เข้าสู่ระบบเพื่อดูรายละเอียด";
}

function introduction(href: string, value: string) {
  if (/แก้ไขเอกสาร/.test(value)) return "เจ้าหน้าที่ตรวจพบข้อมูลหรือเอกสารที่ต้องแก้ไขในใบสมัครของคุณ โปรดตรวจสอบรายละเอียดและอัปโหลดเอกสารใหม่";
  if (href.startsWith("/staff/review")) return "มีรายการใหม่ที่รอการตรวจสอบในระบบทุนการศึกษา โปรดตรวจสอบรายละเอียดด้านล่าง";
  if (href.startsWith("/committee")) return "มีรายการที่ได้รับมอบหมายให้คุณพิจารณา โปรดตรวจสอบรายละเอียดด้านล่าง";
  return "มีรายการอัปเดตในระบบทุนการศึกษา โปรดตรวจสอบรายละเอียดด้านล่าง";
}

export function notificationEmailText({ subject, body, actionUrl }: NotificationEmail) {
  const title = heading(subject);
  return `ระบบติดตามทุนการศึกษา\nทุนภายในมหาวิทยาลัย\n\n${title}\n\nเรียน ${recipient(new URL(actionUrl).pathname)}\n${body}\n\nเปิดรายการในระบบ: ${actionUrl}`;
}

export function notificationEmailHtml({ subject, body, actionUrl }: NotificationEmail) {
  const title = heading(subject);
  const href = new URL(actionUrl).pathname;
  const safeUrl = escapeHtml(actionUrl);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  const button = escapeHtml(actionLabel(href, title));
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#edf9f2;color:#102447;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf9f2;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(20,78,52,.10);">
      <tr><td align="center" style="padding:28px 32px 18px;">
        <div style="font-size:21px;line-height:1.35;font-weight:700;color:#0f2450;">ระบบติดตามทุนการศึกษา</div>
        <div style="margin-top:2px;font-size:13px;line-height:1.5;color:#60708a;">ทุนภายในมหาวิทยาลัย</div>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:#dce5ec;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td style="padding:26px 32px 8px;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:#1473d4;">แจ้งเตือนเกี่ยวกับระบบทุนการศึกษา</div>
        <h1 style="margin:7px 0 0;font-size:30px;line-height:1.3;color:#102447;">${safeTitle}</h1>
      </td></tr>
      <tr><td style="padding:18px 32px 8px;font-size:16px;line-height:1.75;color:#1b3155;">
        <strong>เรียน ${escapeHtml(recipient(href))}</strong><br>
        ${escapeHtml(introduction(href, title))}
      </td></tr>
      <tr><td style="padding:16px 32px 8px;"><div style="padding:16px 18px;background:#edf9f2;border-radius:10px;font-size:14px;line-height:1.7;color:#174f3a;"><strong style="display:block;color:#087246;margin-bottom:4px;">รายละเอียดการแจ้งเตือน</strong>${safeBody}</div></td></tr>
      <tr><td align="center" style="padding:20px 32px 10px;"><a href="${safeUrl}" style="display:block;padding:14px 18px;border-radius:6px;background:#1677f1;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">${button}</a></td></tr>
      <tr><td align="center" style="padding:5px 32px 24px;font-size:12px;line-height:1.6;color:#6d7b90;">กรุณาเข้าสู่ระบบด้วยบัญชีของคุณเพื่อดูข้อมูลและดำเนินการ</td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:#dce5ec;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td align="center" style="padding:18px 32px 28px;font-size:11px;line-height:1.7;color:#8491a2;">อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ<br>หากมีข้อสงสัย โปรดติดต่อเจ้าหน้าที่ทุนการศึกษา</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function passwordResetEmailText(actionUrl: string) {
  return `ระบบติดตามทุนการศึกษา\nทุนภายในมหาวิทยาลัย\n\nตั้งรหัสผ่านใหม่\n\nมีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: ${actionUrl}\n\nหากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้`;
}

export function passwordResetEmailHtml(actionUrl: string) {
  const safeUrl = escapeHtml(actionUrl);
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#edf9f2;color:#102447;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf9f2;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(20,78,52,.10);">
      <tr><td align="center" style="padding:28px 32px 18px;"><div style="font-size:21px;line-height:1.35;font-weight:700;color:#0f2450;">ระบบติดตามทุนการศึกษา</div><div style="margin-top:2px;font-size:13px;line-height:1.5;color:#60708a;">ทุนภายในมหาวิทยาลัย</div></td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:#dce5ec;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td style="padding:28px 32px 8px;text-align:center;"><div style="font-size:14px;font-weight:700;color:#1473d4;">ความปลอดภัยของบัญชี</div><h1 style="margin:7px 0 0;font-size:30px;line-height:1.3;color:#102447;">ตั้งรหัสผ่านใหม่</h1></td></tr>
      <tr><td style="padding:18px 32px 8px;font-size:16px;line-height:1.75;color:#1b3155;">มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อดำเนินการ</td></tr>
      <tr><td align="center" style="padding:20px 32px 10px;"><a href="${safeUrl}" style="display:block;padding:14px 18px;border-radius:6px;background:#1677f1;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">ตั้งรหัสผ่านใหม่</a></td></tr>
      <tr><td align="center" style="padding:5px 32px 24px;font-size:12px;line-height:1.6;color:#6d7b90;">หากปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br><span style="word-break:break-all;">${safeUrl}</span></td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:#dce5ec;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td align="center" style="padding:18px 32px 28px;font-size:11px;line-height:1.7;color:#8491a2;">หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้<br>อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
