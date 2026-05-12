import { Link } from "react-router-dom";
import { TrainersPage } from "./TrainersPage";

export function SearchPage() {
  return (
    <div className="search-page">
      <div className="search-chips" aria-label="Быстрые подсказки">
        <Link className="search-chip search-chip--link" to="/">
          Лента
        </Link>
        <span className="search-chip search-chip--hint">Зал и город — в ленте</span>
        <span className="search-chip search-chip--hint">Возраст — в анкетах</span>
        <span className="search-chip search-chip--hint">Интересы — в профиле</span>
      </div>
      <p className="search-lede page-sub">
        Ниже — поиск <strong>тренеров</strong> по городу и ключевым словам. Знакомства по залу — на вкладке «Лента».
      </p>
      <TrainersPage />
    </div>
  );
}
