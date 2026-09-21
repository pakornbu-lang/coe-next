"use client";
import { useSyncExternalStore } from "react";
import { scholarships } from "@/lib/ui-data";

export type DemoApplication = { id: string; scholarshipId: string; submittedAt: string; fileCount: number };
const eventName = "scholarship-demo-applications-changed";
const storageKey = (userId: string) => `scholarship-demo-applications:v1:${userId}`;
const unavailable = "storage-unavailable";

export function parseDemoApplications(raw: string): DemoApplication[] {
  const items: unknown = JSON.parse(raw);
  if (!Array.isArray(items) || items.some(item => !item || typeof item.id !== "string" ||
    !scholarships.some(s => s.id === item.scholarshipId) || typeof item.submittedAt !== "string" ||
    !Number.isFinite(Date.parse(item.submittedAt)) || !Number.isInteger(item.fileCount) || item.fileCount < 1)) {
    throw new Error("Invalid demo applications");
  }
  return items.map(({ id, scholarshipId, submittedAt, fileCount }) => ({ id, scholarshipId, submittedAt, fileCount }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function saveDemoApplication(userId: string, scholarshipId: string, fileCount: number) {
  const key = storageKey(userId);
  const items = parseDemoApplications(localStorage.getItem(key) ?? "[]");
  if (items.some(item => item.scholarshipId === scholarshipId)) return;
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, "0")).join("");
  const next = { id, scholarshipId, fileCount, submittedAt: new Date().toISOString() };
  const serialized = JSON.stringify([next, ...items]);
  parseDemoApplications(serialized);
  localStorage.setItem(key, serialized);
  window.dispatchEvent(new Event(eventName));
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}

export function useDemoApplications(userId: string) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(storageKey(userId)) ?? "[]"; }
    catch { return unavailable; }
  }, () => null);
  try {
    return { items: raw === null ? [] : parseDemoApplications(raw), loading: raw === null, error: "" };
  } catch {
    return { items: [], loading: false, error: "อ่านรายการทดลองไม่ได้ กรุณาตรวจการอนุญาตจัดเก็บข้อมูลของเบราว์เซอร์ หรือทดลองเปิดใหม่" };
  }
}
