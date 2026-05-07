/**
 * Staging: VITE_APP_ENV=staging или сборка с base /stg/ (docker-compose.staging.vps.yml).
 */
export function EnvRibbon() {
  const base = import.meta.env.BASE_URL || "/";
  const isStaging =
    import.meta.env.VITE_APP_ENV === "staging" || (base !== "/" && base !== "");
  if (!isStaging) return null;
  return (
    <div className="env-ribbon env-ribbon--staging" role="status" aria-live="polite">
      Тестовый стенд (staging): отдельная БД и файлы, не продакшен.
    </div>
  );
}
