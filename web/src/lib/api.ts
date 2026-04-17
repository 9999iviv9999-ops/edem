import axios from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

// Пустой baseURL = запросы на тот же origin (/api/...).
// Локально: Vite proxy (vite.config.ts).
// Если задан VITE_API_URL — используем его (прямой вызов API).
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";

export const api = axios.create({
  baseURL: API_BASE_URL
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
      const refreshUrl = API_BASE_URL
        ? `${API_BASE_URL}/api/auth/refresh`
        : "/api/auth/refresh";
      const { data } = await axios.post(refreshUrl, {
        refreshToken
      });
      setTokens(data.accessToken, data.refreshToken);
      pending.forEach((cb) => cb(data.accessToken));
      pending = [];
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      clearTokens();
      pending.forEach((cb) => cb(null));
      pending = [];
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
