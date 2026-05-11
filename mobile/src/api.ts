import AsyncStorage from "@react-native-async-storage/async-storage";
import { appConfig } from "./config";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  requireAuth?: boolean;
};

const ACCESS_TOKEN_KEY = "edem_access_token_mobile";
const REFRESH_TOKEN_KEY = "edem_refresh_token_mobile";
const AUTH_PHONE_KEY = "edem_auth_phone_mobile";

type SessionState = {
  accessToken: string;
  refreshToken: string;
};

const session: SessionState = {
  accessToken: "",
  refreshToken: ""
};

/** Сервер отдаёт ошибки по-английски — показываем понятный текст в приложении */
function mapApiErrorMessage(raw: string | undefined, status: number): string {
  const r = (raw || "").trim();
  const table: Record<string, string> = {
    "Invalid credentials": "Неверный номер или пароль.",
    "Invalid refresh token": "Сессия устарела. Войди снова.",
    "Invalid token": "Сессия устарела. Войди снова.",
    Unauthorized: "Нужен вход в приложение.",
    "Email or phone already used": "Этот номер или почта уже заняты.",
    "Account is banned": "Аккаунт заблокирован.",
    "Account is banned or unavailable": "Аккаунт недоступен.",
    "Current password is incorrect": "Текущий пароль неверный.",
    "User not found": "Пользователь не найден.",
    "Too many auth attempts. Try again in a few minutes.": "Слишком много попыток входа. Подожди несколько минут.",
    "Too many login attempts for this account. Try again later.": "Слишком много попыток для этого номера. Попробуй позже.",
    "Validation error": "Проверь номер и пароль (не короче 6 символов).",
    "Internal server error": "Ошибка сервера. Попробуй позже."
  };
  if (table[r]) return table[r];
  if (status === 429 && !r) return "Слишком много запросов. Подожди немного.";
  if (status === 401 && !r) return "Сессия истекла. Войди снова.";
  return r || "Не удалось выполнить запрос";
}
let authExpiredHandler: (() => void) | null = null;
/** Один refresh за раз: иначе два параллельных 401 отзывают разные refresh-токены и второй запрос «выбивает» сессию. */
let refreshInFlight: Promise<boolean> | null = null;

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler;
}

export async function hydrateSessionFromStorage() {
  const [accessToken, refreshToken] = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  session.accessToken = accessToken?.[1] || "";
  session.refreshToken = refreshToken?.[1] || "";
  return { ...session };
}

export async function persistSession(accessToken: string, refreshToken: string) {
  session.accessToken = accessToken;
  session.refreshToken = refreshToken;
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken]
  ]);
}

export async function clearSession() {
  session.accessToken = "";
  session.refreshToken = "";
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, AUTH_PHONE_KEY]);
}

export async function setCurrentAuthPhone(phone: string) {
  await AsyncStorage.setItem(AUTH_PHONE_KEY, phone);
}

export async function getCurrentAuthPhone() {
  return (await AsyncStorage.getItem(AUTH_PHONE_KEY)) || "";
}

async function refreshSessionIfNeeded(): Promise<boolean> {
  if (!session.refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = session.refreshToken;
      if (!refreshToken) return false;
      const res = await fetch(`${appConfig.apiUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!res.ok || !payload.accessToken || !payload.refreshToken) {
        await clearSession();
        authExpiredHandler?.();
        return false;
      }
      await persistSession(payload.accessToken, payload.refreshToken);
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (options.requireAuth !== false && session.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    let res: Response;
    try {
      res = await fetch(`${appConfig.apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch {
      throw new Error("Нет сети или сервер недоступен. Проверь интернет и адрес API.");
    }
    const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { res, payload };
  };

  let { res, payload } = await send();
  if (res.status === 401 && options.requireAuth !== false) {
    const refreshed = await refreshSessionIfNeeded();
    if (refreshed) {
      ({ res, payload } = await send());
    }
  }

  if (!res.ok) {
    if (res.status === 401 && options.requireAuth !== false) {
      await clearSession();
      authExpiredHandler?.();
    }
    throw new Error(payload?.error || (res.status === 401 ? "Сессия истекла. Войди снова." : "Request failed"));
  }
  return payload;
}

/** Multipart upload профильного фото; возвращает URL как на сервере (/uploads/... или абсолютный). */
export async function uploadProfilePhoto(localUri: string, mimeType: string, fileName: string): Promise<string> {
  const post = async () => {
    const form = new FormData();
    form.append("photo", { uri: localUri, name: fileName, type: mimeType } as unknown as Blob);
    const headers: Record<string, string> = {};
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let res: Response;
    try {
      res = await fetch(`${appConfig.apiUrl}/api/media/upload-photo`, {
        method: "POST",
        headers,
        body: form
      });
    } catch {
      throw new Error("Нет сети или сервер недоступен.");
    }
    const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    return { res, payload };
  };

  let { res, payload } = await post();
  if (res.status === 401) {
    const refreshed = await refreshSessionIfNeeded();
    if (refreshed) ({ res, payload } = await post());
  }
  if (!res.ok) {
    if (res.status === 401) {
      await clearSession();
      authExpiredHandler?.();
    }
    throw new Error(
      payload?.error ? mapApiErrorMessage(payload.error, res.status) : "Не удалось загрузить фото"
    );
  }
  if (!payload.url) throw new Error("Сервер не вернул адрес фото");
  return payload.url;
}

export type ChatUploadedFile = { url: string; mimeType: string; filename: string; size: number };

/** Загрузка файла для чата (изображение, PDF, Office, txt). */
export async function uploadChatAttachment(localUri: string, mimeType: string, fileName: string): Promise<ChatUploadedFile> {
  const post = async () => {
    const form = new FormData();
    form.append("file", { uri: localUri, name: fileName, type: mimeType } as unknown as Blob);
    const headers: Record<string, string> = {};
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let res: Response;
    try {
      res = await fetch(`${appConfig.apiUrl}/api/media/upload-chat-file`, {
        method: "POST",
        headers,
        body: form
      });
    } catch {
      throw new Error("Нет сети или сервер недоступен.");
    }
    const payload = (await res.json().catch(() => ({}))) as ChatUploadedFile & { error?: string };
    return { res, payload };
  };

  let { res, payload } = await post();
  if (res.status === 401) {
    const refreshed = await refreshSessionIfNeeded();
    if (refreshed) ({ res, payload } = await post());
  }
  if (!res.ok) {
    if (res.status === 401) {
      await clearSession();
      authExpiredHandler?.();
    }
    throw new Error(
      payload?.error ? mapApiErrorMessage(payload.error, res.status) : "Не удалось загрузить файл"
    );
  }
  if (!payload.url || !payload.mimeType) throw new Error("Сервер не вернул данные файла");
  return {
    url: payload.url,
    mimeType: payload.mimeType,
    filename: payload.filename || fileName,
    size: typeof payload.size === "number" ? payload.size : 0
  };
}
