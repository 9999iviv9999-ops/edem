import { Link } from "react-router-dom";
import { TrainersPage } from "./TrainersPage";

export function SearchPage() {
  return (
    <div className="search-page">
      <div className="search-chips" aria-label="Быстрые фильтры">
        <Link className="search-chip search-chip--link" to="/">
          Лента знакомств
        </Link>
        <span className="search-chip search-chip--hint">Зал и город — в ленте</span>
        <Link className="search-chip search-chip--link" to="/trainers">
          Только тренеры
        </Link>
      </div>
      <p className="search-lede page-sub">
        Поиск <strong>тренеров</strong> по городу и ключевым словам. Анкеты в зале — раздел «Лента».
      </p>
      <TrainersPage />
    </div>
  );
}
