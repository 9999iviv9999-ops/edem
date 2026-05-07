import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { setTokens } from "./auth";

/**
 * VK OAuth completes with ?oauth_exchange=... (one-time code); tokens are not in the URL.
 */
export function useOAuthExchangeFromUrl(afterPath: string) {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [oauthError, setOauthError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("oauth_exchange");
    if (!code) return;

    let cancelled = false;
    setOauthError("");

    (async () => {
      try {
        const { data } = await api.post<{ accessToken: string; refreshToken: string }>(
          "/api/auth/oauth/exchange",
          { code }
        );
        if (cancelled) return;
        setTokens(data.accessToken, data.refreshToken);
        setSearchParams({}, { replace: true });
        navigate(afterPath, { replace: true });
      } catch {
        if (!cancelled) {
          setOauthError("Не удалось завершить вход через ВКонтакте. Попробуй ещё раз.");
          setSearchParams({}, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, setSearchParams, navigate, afterPath]);

  return oauthError;
}
