// Shared by the browser and server action; combining marks preserve Thai names.
export const personNamePattern = "(?=.*\\p{L})[\\p{L}\\p{M} .’'\\-]+";
export function isPersonName(value: string) {
  return /^(?=.*\p{L})[\p{L}\p{M} .’'\-]+$/u.test(value.trim());
}
