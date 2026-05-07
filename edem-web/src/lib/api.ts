import axios from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

// Пустой baseURL = запросы на тот же origin (/api/...).
// Локально: Vite proxy (vite.config.ts). На Vercel: vercel.json rewrites -> api.edem.press.
// Если задан VITE_API_URL — используем его (прямой вызов API).
// При base=/stg/ префиксуем пути /api → /stg/api (см. nginx на edem.press).
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";
const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  if (!API_BASE_URL && APP_BASE && config.url?.startsWith("/api/")) {
    config.url = `${APP_BASE}${config.url}`;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pending: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pending.push((token) => {
          if (!token) return reject(error);
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token");
      const refreshPath = APP_BASE ? `${APP_BASE}/api/auth/refresh` : "/api/auth/refresh";
      const refreshUrl = API_BASE_URL ? `${API_BASE_URL}/api/auth/refresh` : refreshPath;
      const { data } = await axios.post(refreshUrl, {
        refreshToken
      });
      setTokens(data.accessToken, data.refreshToken);
      pending.forEach((cb) => cb(data.accessToken));
      pending = [];
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError: unknown) {
      const status = (refreshError as { response?: { status?: number } })?.response?.status;
      // Keep tokens on transient network/server errors.
      // Clear only when refresh token is truly invalid/expired.
      if (status === 401 || status === 403) {
        clearTokens();
      }
      pending.forEach((cb) => cb(null));
      pending = [];
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
