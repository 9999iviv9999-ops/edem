import { useEffect } from "react";

const VPROK_PREVIEW_URL = "https://vprok.club/vprok-preview";

/** Старые ссылки на app.edem.press/vprok-preview ведут на отдельный хост Vprok. */
export function VprokPreviewRedirectPage() {
  useEffect(() => {
    window.location.replace(VPROK_PREVIEW_URL);
  }, []);

  return (
    <div className="auth-wrap">
      <p className="auth-lede" style={{ textAlign: "center" }}>
        Переход на Vprok… Если не открылось, открой{" "}
        <a href={VPROK_PREVIEW_URL}>{VPROK_PREVIEW_URL}</a>
      </p>
    </div>
  );
}
