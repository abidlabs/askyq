const searchInput = document.getElementById("fatwaSearch");
const resultsRoot = document.getElementById("searchResults");
const recentGrid = document.getElementById("recentGrid");
const fatwaCountEl = document.getElementById("fatwaCount");

let fatwas = [];
let visibleResults = [];
let activeIndex = -1;

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function resultRowTemplate(fatwa, isActive) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `result-row${isActive ? " active" : ""}`;
  button.setAttribute("role", "option");
  button.dataset.id = fatwa.id;

  const icon = document.createElement("div");
  icon.className = "result-icon";
  icon.textContent = "\u{1F4D6}";

  const copy = document.createElement("div");
  copy.className = "result-copy";

  const name = document.createElement("p");
  name.className = "result-name";
  name.textContent = fatwa.title;

  const meta = document.createElement("p");
  meta.className = "result-meta";
  meta.textContent = `${fatwa.scholar} \u2022 ${fatwa.category}`;

  copy.appendChild(name);
  copy.appendChild(meta);

  const badge = document.createElement("span");
  badge.className = "result-badge";
  badge.textContent = fatwa.category;

  button.appendChild(icon);
  button.appendChild(copy);
  button.appendChild(badge);
  button.addEventListener("click", () => goToFatwa(fatwa.id));
  return button;
}

function openResults() {
  resultsRoot.classList.add("open");
  searchInput.setAttribute("aria-expanded", "true");
}

function closeResults() {
  resultsRoot.classList.remove("open");
  searchInput.setAttribute("aria-expanded", "false");
  activeIndex = -1;
}

function renderResults() {
  resultsRoot.innerHTML = "";
  if (!visibleResults.length) {
    closeResults();
    return;
  }
  visibleResults.forEach((fatwa, i) => {
    resultsRoot.appendChild(resultRowTemplate(fatwa, i === activeIndex));
  });
  openResults();
}

function runSearch(query) {
  const q = normalize(query);
  if (!q) {
    closeResults();
    return;
  }
  visibleResults = fatwas.filter((f) => {
    const haystack = normalize(
      `${f.title} ${f.summary} ${f.tags.join(" ")} ${f.category} ${f.scholar}`
    );
    return q.split(/\s+/).every((word) => haystack.includes(word));
  }).slice(0, 12);
  activeIndex = -1;
  renderResults();
}

function goToFatwa(id) {
  window.location.href = `./fatwa/${encodeURIComponent(id)}/`;
}

function renderRecentCards(list) {
  if (!recentGrid) return;
  recentGrid.innerHTML = "";
  list.forEach((fatwa) => {
    const card = document.createElement("a");
    card.className = "fatwa-card";
    card.href = `./fatwa/${encodeURIComponent(fatwa.id)}/`;

    const cat = document.createElement("span");
    cat.className = "fatwa-card-category";
    cat.textContent = fatwa.category;

    const title = document.createElement("p");
    title.className = "fatwa-card-title";
    title.textContent = fatwa.title;

    const summary = document.createElement("p");
    summary.className = "fatwa-card-summary";
    summary.textContent = fatwa.summary;

    const footer = document.createElement("div");
    footer.className = "fatwa-card-footer";

    const scholar = document.createElement("span");
    scholar.className = "fatwa-card-scholar";
    scholar.textContent = fatwa.scholar;

    const date = document.createElement("span");
    date.className = "fatwa-card-date";
    date.textContent = `\u2022 ${new Date(fatwa.datePublished).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;

    footer.appendChild(scholar);
    footer.appendChild(date);

    card.appendChild(cat);
    card.appendChild(title);
    card.appendChild(summary);
    card.appendChild(footer);
    recentGrid.appendChild(card);
  });
}

function spawnStars() {
  const container = document.getElementById("patternBg");
  if (!container) return;
  const glyphs = ["\u2726", "\u2727", "\u00B7", "\u2726", "\u00B7"];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement("span");
    s.className = "star";
    s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    s.style.left = `${(Math.random() * 96 + 2).toFixed(1)}%`;
    s.style.top = `${(Math.random() * 96 + 2).toFixed(1)}%`;
    s.style.opacity = `${(0.06 + Math.random() * 0.12).toFixed(2)}`;
    s.style.fontSize = `${10 + Math.floor(Math.random() * 10)}px`;
    container.appendChild(s);
  }
}

spawnStars();

searchInput.addEventListener("input", (e) => runSearch(e.target.value));

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (visibleResults.length) {
      activeIndex = Math.min(activeIndex + 1, visibleResults.length - 1);
      renderResults();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (visibleResults.length) {
      activeIndex = Math.max(activeIndex - 1, 0);
      renderResults();
    }
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    goToFatwa(visibleResults[activeIndex].id);
  } else if (e.key === "Escape") {
    closeResults();
  }
});

document.addEventListener("click", (e) => {
  if (!resultsRoot.contains(e.target) && e.target !== searchInput) {
    closeResults();
  }
});

async function init() {
  try {
    const res = await fetch("./data/fatwas.json");
    fatwas = await res.json();
    if (fatwaCountEl) {
      fatwaCountEl.textContent = `${fatwas.length} fatwa${fatwas.length !== 1 ? "s" : ""} in database`;
    }
    renderRecentCards(fatwas.slice(0, 6));
  } catch (err) {
    console.error("Failed to load fatwas:", err);
    if (fatwaCountEl) fatwaCountEl.textContent = "Failed to load.";
  }
}

init();
