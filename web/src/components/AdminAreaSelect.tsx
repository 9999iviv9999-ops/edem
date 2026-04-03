import { CITY_ADMIN_AREAS } from "../data/cityAdminAreas";

type Props = {
  city: string;
  value?: string;
  onChange: (district: string) => void;
};

export function AdminAreaSelect({ city, value = "", onChange }: Props) {
  const options = CITY_ADMIN_AREAS[city] || [];
  if (!options.length) return null;

  return (
    <label className="field">
      <span className="field-label">Район / округ</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Не указывать</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );
}

