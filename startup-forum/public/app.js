const SECTIONS = [
  { id: "startup-idea", label: "Стартап в виде идеи" },
  { id: "startup-release", label: "Релиз стартапов" },
  { id: "crowdfunding", label: "Краудфандинг" },
  { id: "startup-sale", label: "Продажа стартапов" }
];

const NEXT_STATUS = {
  open: "in-progress",
  "in-progress": "resolved",
  resolved: "closed",
  closed: "open"
};

const STATUS_LABEL = {
  open: "Открыт",
  "in-progress": "В процессе",
  resolved: "Успешно",
  closed: "Закрыт"
};
const SECTION_ICON = {
  "startup-idea": "💡",
  "startup-release": "🚀",
  crowdfunding: "💸",
  "startup-sale": "🤝"
};

const board = document.getElementById("board");
const template = document.getElementById("post-template");
const createDialog = document.getElementById("create-dialog");
const createBtn = document.getElementById("create-post-btn");
const cancelBtn = document.getElementById("cancel-btn");
const createForm = document.getElementById("create-form");
const filterSection = document.getElementById("filter-section");
const filterStatus = document.getElementById("filter-status");
const filterQuery = document.getElementById("filter-query");
const statTotal = document.getElementById("stat-total");
const statOpen = document.getElementById("stat-open");
const statClosed = document.getElementById("stat-closed");
const featuredTitle = document.getElementById("featured-title");
const featuredSummary = document.getElementById("featured-summary");
const featuredSection = document.getElementById("featured-section");
const featuredGoal = document.getElementById("featured-goal");
let allPosts = [];

function askSection(currentSectionId) {
  const choices = SECTIONS.map((item) => `${item.id}: ${item.label}`).join("\n");
  const value = window.prompt(
    `Выберите раздел (введите id):\n${choices}`,
    currentSectionId
  );
  if (!value) return null;
  const trimmed = value.trim();
  return SECTIONS.some((item) => item.id === trimmed) ? trimmed : null;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function sectionLabel(sectionId) {
  return SECTIONS.find((item) => item.id === sectionId)?.label || sectionId;
}

function sectionLabelWithIcon(sectionId) {
  const icon = SECTION_ICON[sectionId] || "•";
  return `${icon} ${sectionLabel(sectionId)}`;
}

function applyFilters(posts) {
  const sectionValue = filterSection.value;
  const statusValue = filterStatus.value;
  const query = filterQuery.value.trim().toLowerCase();

  return posts.filter((item) => {
    const sectionOk = sectionValue === "all" ? true : item.section === sectionValue;
    const statusOk = statusValue === "all" ? true : item.status === statusValue;
    const queryOk = query
      ? `${item.title} ${item.summary} ${item.author} ${item.goal}`.toLowerCase().includes(query)
      : true;
    return sectionOk && statusOk && queryOk;
  });
}

function updateStats(posts) {
  statTotal.textContent = String(posts.length);
  statOpen.textContent = String(posts.filter((item) => item.status !== "closed").length);
  statClosed.textContent = String(posts.filter((item) => item.status === "closed").length);
}

function updateFeatured(posts) {
  const featured = posts
    .filter((item) => item.status !== "closed")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

  if (!featured) {
    featuredTitle.textContent = "Пока нет объявлений";
    featuredSummary.textContent = "Создай первое объявление, чтобы оно появилось в витрине.";
    featuredSection.textContent = "-";
    featuredGoal.textContent = "-";
    return;
  }

  featuredTitle.textContent = featured.title;
  featuredSummary.textContent = featured.summary;
  featuredSection.textContent = sectionLabelWithIcon(featured.section);
  featuredGoal.textContent = `Цель: ${featured.goal}`;
}

function renderCards(posts) {
  board.innerHTML = "";

  if (!posts.length) {
    board.innerHTML =
      '<article class="empty-state">Ничего не найдено. Измени фильтры или создай новое объявление.</article>';
    return;
  }

  posts.forEach((post) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.section = post.section;
    node.querySelector(".section-badge").textContent = sectionLabelWithIcon(post.section);
    node.querySelector(".post-title").textContent = post.title;
    node.querySelector(".post-summary").textContent = post.summary;
    node.querySelector(".post-author").textContent = `Автор: ${post.author}`;
    node.querySelector(".post-goal").textContent = `Цель: ${post.goal}`;
    const statusNode = node.querySelector(".status");
    statusNode.textContent = STATUS_LABEL[post.status] || post.status;
    statusNode.dataset.status = post.status;

    const moveBtn = node.querySelector('[data-action="section"]');
    const statusBtn = node.querySelector('[data-action="status"]');

    moveBtn.addEventListener("click", async () => {
      const selectedSection = askSection(post.section);
      if (!selectedSection || selectedSection === post.section) {
        return;
      }
      await updatePost(post.id, { section: selectedSection });
    });

    statusBtn.addEventListener("click", async () => {
      await updatePost(post.id, { status: NEXT_STATUS[post.status] || "open" });
    });

    board.appendChild(node);
  });
}

async function refreshBoard() {
  const data = await request("/api/posts");
  allPosts = data.items || [];
  updateStats(allPosts);
  updateFeatured(allPosts);
  renderCards(applyFilters(allPosts));
}

async function updatePost(id, payload) {
  await request(`/api/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  await refreshBoard();
}

createBtn.addEventListener("click", () => createDialog.showModal());
cancelBtn.addEventListener("click", () => createDialog.close());
filterSection.addEventListener("change", () => renderCards(applyFilters(allPosts)));
filterStatus.addEventListener("change", () => renderCards(applyFilters(allPosts)));
filterQuery.addEventListener("input", () => renderCards(applyFilters(allPosts)));

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createForm);
  const payload = Object.fromEntries(formData.entries());

  await request("/api/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  createForm.reset();
  createDialog.close();
  await refreshBoard();
});

refreshBoard().catch((error) => {
  board.innerHTML = `<p>Ошибка загрузки форума: ${error.message}</p>`;
});
