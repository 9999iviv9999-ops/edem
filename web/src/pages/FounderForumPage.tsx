import { useMemo, useState } from "react";

type Stage = "idea" | "mvp" | "sales" | "growth" | "fundraise" | "exit";
type Proof = "hypothesis" | "tested" | "verified";

type Post = {
  id: string;
  title: string;
  stage: Stage;
  proof: Proof;
  author: string;
  asks: string[];
  metrics: string;
};

const STAGES: Array<{ key: Stage; label: string }> = [
  { key: "idea", label: "Идея" },
  { key: "mvp", label: "MVP" },
  { key: "sales", label: "Первые продажи" },
  { key: "growth", label: "Рост" },
  { key: "fundraise", label: "Фандрайзинг" },
  { key: "exit", label: "Экзит" }
];

const SEED_POSTS: Post[] = [
  {
    id: "p1",
    title: "B2B SaaS для фитнес-клубов: проверка боли по удержанию клиентов",
    stage: "mvp",
    proof: "tested",
    author: "FitRetention",
    asks: ["Фидбек UX", "Интро к сетям"],
    metrics: "19 интервью, 4 LOI"
  },
  {
    id: "p2",
    title: "Маркетплейс бытовых услуг в малых городах",
    stage: "sales",
    proof: "verified",
    author: "LocalPro",
    asks: ["Партнеры по привлечению", "Совет по CAC"],
    metrics: "MRR 420k, CAC 1 150"
  },
  {
    id: "p3",
    title: "AI-помощник для e-com карточек товара",
    stage: "growth",
    proof: "tested",
    author: "CardPilot",
    asks: ["Разбор pricing", "Аналитика каналов"],
    metrics: "300 WAU, 11 платящих"
  }
];

function proofLabel(proof: Proof) {
  if (proof === "verified") return "Verified";
  if (proof === "tested") return "Tested";
  return "Hypothesis";
}

export function FounderForumPage() {
  const [activeStage, setActiveStage] = useState<Stage>("mvp");
  const [posts] = useState(SEED_POSTS);

  const filtered = useMemo(
    () => posts.filter((post) => post.stage === activeStage),
    [posts, activeStage]
  );

  return (
    <div className="forum-page">
      <section className="card forum-hero">
        <h1 className="forum-title">Forum-as-Workflow</h1>
        <p className="forum-sub">
          Прототип форума для фаундеров: обсуждения структурированы по этапам роста, а не
          только по темам.
        </p>
      </section>

      <section className="card forum-stage-strip">
        {STAGES.map((stage) => (
          <button
            key={stage.key}
            className={`forum-stage-btn ${activeStage === stage.key ? "forum-stage-btn--active" : ""}`}
            onClick={() => setActiveStage(stage.key)}
            type="button"
          >
            {stage.label}
          </button>
        ))}
      </section>

      <section className="forum-grid">
        <article className="card forum-column">
          <h2 className="page-title page-title--sm">Карточки решений</h2>
          <div className="forum-list">
            {filtered.map((post) => (
              <div key={post.id} className="forum-post">
                <div className="forum-post-top">
                  <strong>{post.title}</strong>
                  <span className={`forum-proof forum-proof--${post.proof}`}>{proofLabel(post.proof)}</span>
                </div>
                <p className="forum-meta">Автор: {post.author}</p>
                <p className="forum-meta">Метрики: {post.metrics}</p>
                <div className="chips">
                  {post.asks.map((ask) => (
                    <span key={ask} className="chip">
                      {ask}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!filtered.length && <p className="page-sub">В этом этапе пока нет карточек.</p>}
          </div>
        </article>

        <article className="card forum-column">
          <h2 className="page-title page-title--sm">Быстрые действия</h2>
          <div className="forum-actions">
            <button type="button" className="primary-btn">
              Создать карточку решения
            </button>
            <button type="button" className="ghost-btn">
              Запросить фидбек комьюнити
            </button>
            <button type="button" className="ghost-btn">
              Открыть крауд-кампанию
            </button>
            <button type="button" className="ghost-btn">
              Выставить стартап на продажу
            </button>
          </div>
          <p className="page-sub">
            Дальше можно связать эти действия с отдельными модулями: launches, crowdfunding
            и M&A marketplace.
          </p>
        </article>
      </section>
    </div>
  );
}
