/** Согласовано с бэкендом `phone-normalize.ts` */
export function normalizePhoneRu(input: string): string {
  let digits = input.trim().replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    digits = "7" + digits;
  }
  return `+${digits}`;
}
