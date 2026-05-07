export type GymOption = { id: string; name: string; city: string; address?: string | null; chainName?: string | null };

type Props = {
  gyms: GymOption[];
  value: string;
  onChange: (gymId: string) => void;
  id?: string;
  placeholder?: string;
};

/**
 * Выбор зала из локального каталога.
 */
export function GymPicker({
  gyms,
  value,
  onChange,
  id,
  placeholder = "Выберите зал"
}: Props) {
  return (
    <div className="gym-picker">
      <label className="field">
        <span className="field-label">Фитнес-центр / зал (каталог ЭДЕМ)</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {gyms.map((g) => {
            const label = [g.chainName?.trim(), g.name, g.address?.trim()].filter(Boolean).join(" · ");
            return (
            <option key={g.id} value={g.id}>
              {label}
            </option>
            );
          })}
        </select>
      </label>
      <p className="gym-picker-meta">
        В твоём городе в каталоге: <strong>{gyms.length}</strong>
      </p>
    </div>
  );
}
