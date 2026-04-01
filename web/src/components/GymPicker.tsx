import { useMemo, useState } from "react";

export type GymOption = { id: string; name: string; city: string; chainName?: string | null };

type Props = {
  gyms: GymOption[];
  value: string;
  onChange: (gymId: string) => void;
  id?: string;
  placeholder?: string;
};

/**
 * Выбор зала с поиском по названию и сети — удобно при длинном списке.
 */
export function GymPicker({ gyms, value, onChange, id, placeholder = "Начните вводить название зала или сети" }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return gyms;
    return gyms.filter((g) => {
      const name = g.name.toLowerCase();
      const chain = (g.chainName || "").toLowerCase();
      return name.includes(s) || chain.includes(s);
    });
  }, [gyms, q]);

  const selected = gyms.find((g) => g.id === value);

  return (
    <div className="gym-picker">
      <div className="field">
        <span className="field-label">Поиск зала</span>
        <input
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <label className="field">
        <span className="field-label">Фитнес-центр / зал</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Выберите зал</option>
          {value && selected && !filtered.some((g) => g.id === value) && (
            <option value={value}>{selected.name}</option>
          )}
          {filtered.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p className="gym-picker-meta">
        В твоём городе в каталоге: <strong>{gyms.length}</strong>
        {q.trim() ? (
          <>
            {" "}
            · по запросу показано: <strong>{filtered.length}</strong>
          </>
        ) : null}
      </p>
      {selected && !filtered.some((g) => g.id === value) && (
        <p className="gym-picker-hint">
          Текущий зал «{selected.name}» скрыт фильтром — очистите поиск, чтобы увидеть его в списке.
        </p>
      )}
      {q.trim() && filtered.length === 0 && (
        <p className="city-select-empty">Ничего не найдено — измените запрос или сбросьте поиск</p>
      )}
    </div>
  );
}
