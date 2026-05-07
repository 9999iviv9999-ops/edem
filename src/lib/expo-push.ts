const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "high" | "normal";
  channelId?: string;
};

/**
 * Отправка через Expo Push API (массив тел в теле запроса).
 * Ошибки логируются, не бросают наружу — уведомления не должны ломать основной запрос.
 */
export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const chunkSize = 90;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(chunk)
      });
      const text = await res.text();
      if (!res.ok) {
        console.warn("[push] Expo HTTP error", res.status, text.slice(0, 500));
        continue;
      }
      try {
        const json = JSON.parse(text) as {
          data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
        };
        const tickets = json.data ?? [];
        for (const t of tickets) {
          const st = t.status || "";
          if (st !== "ok" && st !== "success") {
            console.warn(
              "[push] Expo ticket:",
              st,
              t.message || t.details?.error || JSON.stringify(t).slice(0, 200)
            );
          }
        }
      } catch {
        /* ответ не JSON — уже залогировали статус */
      }
    } catch (err) {
      console.warn("[push] Expo fetch failed", err);
    }
  }
}
