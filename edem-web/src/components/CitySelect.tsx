import russianCities from "../data/russianCities.json";

const FALLBACK_CITIES = russianCities as string[];

type Props = {
  value: string;
  onChange: (city: string) => void;
  id?: string;
  options?: string[];
  showLabel?: boolean;
};

/**
 * Все города РФ (официальный статус «город») + поиск по первым буквам.
 */
export function CitySelect({ value, onChange, id, options, showLabel = true }: Props) {
  const list = options?.length ? options : FALLBACK_CITIES;
  const uniqueList = value && !list.includes(value) ? [value, ...list] : list;
  return (
    <div className="city-select">
      <label className="field">
        {showLabel ? <span className="field-label">Город</span> : null}
        <select id={id} required value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Выберите город</option>
          {uniqueList.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      {uniqueList.length === 0 && <p className="city-select-empty">Нет доступных городов</p>}
    </div>
  );
}
