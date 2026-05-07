export const appConfig = {
  appName: "ЭДЕМ",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "https://edem.press").replace(/\/+$/, "")
};

/** Совпадает с app.json → expo.extra.eas.projectId; нужен, если Constants.expoConfig пустой в релизе. */
export const easProjectId = "d4a95449-4e03-4c8b-b2ac-567ef803ff25";

/** Веб-клиент ЭДЕМ: nginx редиректит app.edem.press → edem.press; по умолчанию сразу основной домен. */
export const webAppBaseUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://edem.press").replace(/\/+$/, "");

export const privacyPolicyUrl = `${webAppBaseUrl}/privacy`;

export const vipConfig = {
  phone: "+79124740987",
  status: "Founder Diamond"
};

/** Как на сервере: 8…→+7…, 10 цифр с 9→+79… */
export function normalizePhone(input: string) {
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

export function isVipPhone(phone: string) {
  return normalizePhone(phone) === vipConfig.phone;
}
