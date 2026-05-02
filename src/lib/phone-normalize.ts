/**
 * Один формат телефона для РФ/КЗ (+7): то, что попадает в БД и в поиск при входе.
 * «8 9xx …» и «9xx …» (10 цифр) приводятся к +79… чтобы совпадало с регистрацией и старыми аккаунтами.
 */
export function normalizePhone(input: string): string {
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
