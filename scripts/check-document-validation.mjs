import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { strToU8, zipSync } from "fflate";
import { validApplicationDocument } from "../lib/scholarships/document-validation.ts";

const docx = (extra = {}) => Buffer.from(zipSync({
  "[Content_Types].xml": strToU8('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  "word/document.xml": strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>'),
  ...extra,
}));

test("accepts real PDF, JPEG, PNG, and DOCX content", async () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n");
  const jpg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.equal(await validApplicationDocument(pdf, "application/pdf"), true);
  assert.equal(await validApplicationDocument(jpg, "image/jpeg"), true);
  assert.equal(await validApplicationDocument(png, "image/png"), true);
  assert.equal(await validApplicationDocument(docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true);
});

test("rejects spoofed, damaged, and macro-enabled files", async () => {
  assert.equal(await validApplicationDocument(Buffer.from("not a PDF"), "application/pdf"), false);
  assert.equal(await validApplicationDocument(Buffer.from("%PDF-1.7"), "application/pdf"), false);
  assert.equal(await validApplicationDocument(Buffer.from("not a JPEG"), "image/jpeg"), false);
  assert.equal(await validApplicationDocument(docx(), "application/pdf"), false);
  assert.equal(await validApplicationDocument(docx({ "word/vbaProject.bin": strToU8("macro") }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
  assert.equal(await validApplicationDocument(Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf"), false);
});
