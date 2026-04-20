import { Link } from "react-router-dom";
import { VprokLogo } from "../components/VprokLogo";

const benefits = [
  "Фиксация цены и защита от сезонного роста",
  "Предоплата и прозрачные условия хранения/выдачи",
  "Единая платформа для партнёров и покупателей"
];

const steps = [
  "Выбираешь ритейлера и товар",
  "Фиксируешь цену и оплачиваешь онлайн",
  "Забираешь позже в согласованный срок"
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-hero card">
        <div className="landing-hero-top">
          <VprokLogo size={54} labeled wordmark />
          <div className="landing-actions">
            <Link to="/login" className="ghost-btn">
              Войти
            </Link>
            <Link to="/vprok-preview" className="primary-btn">
              Открыть демо
            </Link>
          </div>
        </div>
        <h1 className="landing-title">Покупай заранее. Забирай позже.</h1>
        <p className="landing-sub">
          Vprok помогает покупателям фиксировать цену заранее, а ритейлерам — получать
          предсказуемый спрос и предоплату.
        </p>
        <div className="landing-cta-row">
          <Link to="/register" className="primary-btn">
            Начать сейчас
          </Link>
          <a className="ghost-btn" href="mailto:partners@vprok.club?subject=Vprok%20partnership">
            Стать ритейл-партнёром
          </a>
        </div>
      </header>

      <section className="card landing-section">
        <h2 className="page-title page-title--sm">Что получает рынок</h2>
        <div className="landing-grid">
          {benefits.map((item) => (
            <article key={item} className="landing-tile">
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card landing-section">
        <h2 className="page-title page-title--sm">Как это работает</h2>
        <ol className="landing-steps">
          {steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <div className="landing-footer-cta">
          <Link to="/vprok-preview" className="primary-btn">
            Посмотреть sandbox
          </Link>
        </div>
      </section>
    </div>
  );
}
