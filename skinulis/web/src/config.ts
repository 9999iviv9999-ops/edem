const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function resolveFallbackApiUrl() {
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? "http://localhost:4010" : "https://skinulis-api.vercel.app";
}

export const apiUrl = envApiUrl && envApiUrl.length > 0 ? envApiUrl : resolveFallbackApiUrl();

