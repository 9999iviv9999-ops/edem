import cityDivisions from "../data/cityDivisions.json";

type DivSpec = { okrugs: { name: string; rayons: string[] }[] };

function specFor(city: string): DivSpec | null {
  const s = (cityDivisions as Record<string, DivSpec | undefined>)[city];
  return s?.okrugs?.length ? s : null;
}

/** Города с одним условным округом (субъект РФ): в API не передаём okrug, чтобы не сужать старые записи без поля okrug. */
export function isSingleOkrugCity(city: string): boolean {
  const s = specFor(city);
  return Boolean(s && s.okrugs.length === 1);
}

type Props = {
  city: string;
  okrug: string;
  district: string;
  onOkrugChange: (okrug: string) => void;
  onDistrictChange: (district: string) => void;
};

export function AdminAreaSelect({
  city,
  okrug,
  district,
  onOkrugChange,
  onDistrictChange
}: Props) {
  const spec = specFor(city);
  if (!spec) return null;

  const singleOkrug = spec.okrugs.length === 1;
  const activeOkrug = singleOkrug ? spec.okrugs[0].name : okrug;
  const rayons =
    !singleOkrug && !okrug
      ? []
      : (spec.okrugs.find((o) => o.name === activeOkrug)?.rayons ?? []);

  return (
    <>
      {!singleOkrug && (
        <label className="field">
          <span className="field-label">Административный округ</span>
          <select
            value={okrug}
            onChange={(e) => {
              const v = e.target.value;
              onOkrugChange(v);
              onDistrictChange("");
            }}
          >
            <option value="">Не указывать</option>
            {spec.okrugs.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field-label">{singleOkrug ? "Район / зона" : "Район города"}</span>
        <select
          value={district}
          onChange={(e) => onDistrictChange(e.target.value)}
          disabled={!singleOkrug && !okrug}
        >
          <option value="">Не указывать</option>
          {rayons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
