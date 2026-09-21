/**
 * ระบบส่งอีเมลแจ้งเตือนทุนการศึกษา
 *
 * 1. เก็บ secret ไว้ที่ Project Settings > Script properties
 *    key: NOTIFICATION_APPS_SCRIPT_SECRET
 * 2. Deploy เป็น Web app ที่ Execute as: Me และ Who has access: Anyone
 * 3. นำ URL ที่ลงท้ายด้วย /exec ไปตั้งค่าใน NOTIFICATION_APPS_SCRIPT_URL
 */

const SECRET_PROPERTY = "NOTIFICATION_APPS_SCRIPT_SECRET";

function doPost(event) {
  const requestId = Utilities.getUuid();
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw) return response({ ok: false, error: "Request body is required", requestId });

    const request = JSON.parse(raw);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
    if (!expectedSecret || !secureEquals(String(request.secret || ""), expectedSecret)) {
      return response({ ok: false, error: "Unauthorized", requestId });
    }

    const message = request.message || {};
    const to = String(message.to || "").trim();
    const subject = String(message.subject || "").trim();
    const text = String(message.text || "").trim();
    const html = String(message.html || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text || !html) {
      return response({ ok: false, error: "Invalid email message", requestId });
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return response({ ok: false, error: "Daily Google email quota is exhausted", requestId });
    }

    MailApp.sendEmail({
      to,
      subject,
      body: text,
      htmlBody: html,
      name: "ระบบติดตามทุนการศึกษา",
    });
    return response({ ok: true, requestId });
  } catch (error) {
    console.error(error);
    return response({ ok: false, error: "Unable to send email", requestId });
  }
}

function secureEquals(value, expected) {
  const left = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  const right = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, expected);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function response(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
