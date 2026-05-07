export function registerPwaWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // Disable stale PWA cache behavior for now; unregister existing workers
    // so users always receive the latest auth/frontend bundle.
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
    });
  });
}
