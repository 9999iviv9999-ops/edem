import { prisma } from "./prisma";
import { sendExpoPushMessages } from "./expo-push";

/** Expo FCM ожидает строковые значения в `data`. */
function stringifyPushData(data?: Record<string, unknown>): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export async function notifyUserDevices(
  recipientUserId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  try {
    const devices = await prisma.pushDevice.findMany({
      where: { userId: recipientUserId },
      select: { token: true }
    });
    const tokens = devices.map((d) => d.token).filter(Boolean);
    if (tokens.length === 0) {
      console.warn("[push] нет токенов для userId=%s — клиент не зарегистрировал push", recipientUserId);
      return;
    }

    const data = stringifyPushData(payload.data);

    await sendExpoPushMessages(
      tokens.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data,
        sound: "default" as const,
        priority: "high" as const,
        channelId: "default"
      }))
    );
  } catch (err) {
    console.warn("[push] notifyUserDevices failed", err);
  }
}
