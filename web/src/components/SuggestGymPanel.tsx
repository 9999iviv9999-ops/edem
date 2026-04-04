import { FormEvent, useState } from "react";
import { api } from "../lib/api";

type Props = {
  city: string;
  okrug: string;
  district: string;
};

/**
 * Заявка на добавление зала в каталог (сохраняется в БД для ручной обработки).
 */
export function SuggestGymPanel({ city, okrug, district }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setOkMsg("");
    setErrMsg("");
    if (!city.trim()) {
      setErrMsg("Сначала выберите город");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/gyms/suggestions", {
        city: city.trim(),
        okrug: okrug.trim() || undefined,
        district: district.trim() || undefined,
        name: name.trim(),
        address: address.trim(),
        details: details.trim() || undefined
      });
      setName("");
      setAddress("");
      setDetails("");
      setOkMsg("Спасибо! Мы добавим зал в каталог после проверки.");
      setOpen(false);
    } catch {
      setErrMsg("Не удалось отправить. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="suggest-gym">
      <button
        type="button"
        className="suggest-gym-toggle"
        onClick={() => {
          setOpen((o) => !o);
          setOkMsg("");
          setErrMsg("");
        }}
        aria-expanded={open}
      >
        {open ? "▼" : "▶"} Нет моего зала в списке?
      </button>
      {okMsg && !open && <p className="success suggest-gym-inline-msg">{okMsg}</p>}
      {open && (
        <form className="suggest-gym-form" onSubmit={(e) => void onSubmit(e)}>
          <p className="suggest-gym-lede">
            Укажи название и адрес — мы проверим и добавим в каталог Edem. Город в заявке:{" "}
            <strong>{city || "—"}</strong>
            {okrug ? (
              <>
                , округ: <strong>{okrug}</strong>
              </>
            ) : null}
            {district ? (
              <>
                , район: <strong>{district}</strong>
              </>
            ) : null}
            .
          </p>
          <label className="field">
            <span className="field-label">Название зала / клуба</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, World Class Арбат"
              required
              maxLength={200}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field-label">Адрес</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Улица, дом"
              required
              maxLength={500}
              autoComplete="street-address"
            />
          </label>
          <label className="field">
            <span className="field-label">Комментарий (необязательно)</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Этаж, корпус, как добраться…"
              maxLength={1000}
              rows={2}
            />
          </label>
          {errMsg && <p className="error">{errMsg}</p>}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Отправка…" : "Отправить заявку"}
          </button>
        </form>
      )}
    </div>
  );
}
