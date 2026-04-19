import { useMemo, useState } from "react";
import russianCities from "../data/russianCities.json";

const CITIES = russianCities as string[];

type Props = {
  value: string;
  onChange: (city: string) => void;
  id?: string;
};

/**
 * Все города РФ (официальный статус «город») + поиск по первым буквам.
 */
export function CitySelect({ value, onChange, id }: Props) {
  const [filter, setFilter] = useState("");

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = !q ? CITIES : CITIES.filter((c) => c.toLowerCase().includes(q));
    if (value && !list.includes(value)) {
      return [value, ...list];
    }
    return list;
  }, [filter, value]);

  return (
    <div className="city-select">
      <div className="field">
        <span className="field-label">Поиск по названию</span>
        <input
          type="search"
          autoComplete="off"
          placeholder="Начните вводить город"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <label className="field">
        <span className="field-label">Город</span>
        <select id={id} required value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Выберите город</option>
          {options.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      {options.length === 0 && <p className="city-select-empty">Город не найден — измените запрос</p>}
      {!filter.trim() && (
        <p className="city-select-hint">
          В списке {CITIES.length} городов России. Введите часть названия, чтобы быстрее найти нужный.
        </p>
      )}
    </div>
  );
}
