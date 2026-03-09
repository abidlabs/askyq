#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================
const SITE_URL = "https://abidlabs.github.io/askyq";
const SITE_NAME = "AskYQ";
const SITE_DESC =
  "Search fatwas and Islamic rulings derived from Yasir Qadhi's lectures and Q&A sessions.";
const ROOT = path.resolve(__dirname, "..");

// ============================================================
// UTILITIES
// ============================================================
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJsonLd(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toRfc2822(iso) {
  return new Date(iso).toUTCString();
}

// ============================================================
// MARKDOWN → HTML (ported from assets/js/fatwa.js)
// ============================================================
function markdownToHtml(md) {
  let html = md;

  // blockquotes
  html = html.replace(/^>\s*(.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "\n");

  // headings
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

  // hr
  html = html.replace(/^---$/gm, "<hr>");

  // bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  // unordered lists
  html = html.replace(/^(\s*)-\s+(.+)$/gm, (_, _indent, content) => {
    return `<li>${content}</li>`;
  });
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");

  // ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // paragraphs
  const lines = html.split("\n");
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    if (
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("</") ||
      trimmed.startsWith("<hr") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("<p")
    ) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.join("\n");
}

// ============================================================
// DATA LOADING
// ============================================================
function loadAllFatwas() {
  // Load summary-only list
  const listPath = path.join(ROOT, "data", "fatwas.json");
  const summaryMap = {};
  JSON.parse(fs.readFileSync(listPath, "utf-8")).forEach((f) => {
    summaryMap[f.id] = f.summary;
  });

  // Load full fatwa files
  const dir = path.join(ROOT, "api", "fatwas");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const fatwas = files.map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
    data.summary = summaryMap[data.id] || data.stanceSummary || "";
    return data;
  });

  // Sort by date descending
  fatwas.sort((a, b) => new Date(b.datePublished) - new Date(a.datePublished));
  return fatwas;
}

// ============================================================
// RELATED FATWAS
// ============================================================
function getRelatedFatwas(fatwa, allFatwas, maxCount = 4) {
  const candidates = allFatwas.filter((f) => f.id !== fatwa.id);
  const fatwaTagSet = new Set(fatwa.tags.map((t) => t.toLowerCase()));

  const scored = candidates.map((c) => {
    let score = 0;
    if (c.category === fatwa.category) score += 3;
    c.tags.forEach((t) => {
      if (fatwaTagSet.has(t.toLowerCase())) score += 1;
    });
    return { fatwa: c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((s) => s.fatwa);
}

// ============================================================
// FATWA CARD HTML (reused across pages)
// ============================================================
function fatwaCardHtml(fatwa, basePath) {
  const href = `${basePath}fatwa/${fatwa.id}/`;
  const dateStr = formatDate(fatwa.datePublished);
  return `<a class="fatwa-card" href="${href}">
  <span class="fatwa-card-category">${escapeHtml(fatwa.category)}</span>
  <p class="fatwa-card-title">${escapeHtml(fatwa.title)}</p>
  <p class="fatwa-card-summary">${escapeHtml(fatwa.summary)}</p>
  <div class="fatwa-card-footer">
    <span class="fatwa-card-scholar">${escapeHtml(fatwa.scholar)}</span>
    <span class="fatwa-card-date">&bull; ${dateStr}</span>
  </div>
</a>`;
}

// ============================================================
// INDIVIDUAL FATWA PAGE
// ============================================================
function buildFatwaPage(fatwa, allFatwas) {
  const catSlug = slugify(fatwa.category);
  const canonicalUrl = `${SITE_URL}/fatwa/${fatwa.id}/`;
  const desc = fatwa.stanceSummary || fatwa.summary;
  const dateStr = formatDate(fatwa.datePublished);
  const tagsHtml = (fatwa.tags || [])
    .map((t) => `<span class="fatwa-tag">${escapeHtml(t)}</span>`)
    .join("");
  // Strip the "Summary of Yasir Qadhi's Position" section — Quick Answer covers it
  let transcript = fatwa.transcript || "";
  const fullTranscriptMarker = "## Full Lecture Transcript";
  const ftIdx = transcript.indexOf(fullTranscriptMarker);
  if (ftIdx > 0) {
    transcript = transcript.substring(ftIdx);
  }
  const bodyHtml = markdownToHtml(transcript);
  const related = getRelatedFatwas(fatwa, allFatwas);
  const relatedHtml = related.length
    ? `<section class="related-section">
        <h2 class="related-heading">Related Rulings</h2>
        <div class="recent-grid">${related.map((r) => fatwaCardHtml(r, "../../")).join("\n")}</div>
      </section>`
    : "";

  const articleJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: fatwa.title,
      description: desc,
      datePublished: fatwa.datePublished,
      author: { "@type": "Person", name: fatwa.scholar },
      publisher: { "@type": "Organization", name: SITE_NAME },
      mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
      video: {
        "@type": "VideoObject",
        name: fatwa.title,
        url: fatwa.videoUrl,
        embedUrl: `https://www.youtube.com/embed/${fatwa.videoId}`,
      },
    },
    null,
    2
  );

  const faqJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: fatwa.title,
          acceptedAnswer: {
            "@type": "Answer",
            text: desc,
          },
        },
      ],
    },
    null,
    2
  );

  const breadcrumbJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: fatwa.category,
          item: `${SITE_URL}/category/${catSlug}/`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: fatwa.title,
        },
      ],
    },
    null,
    2
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(fatwa.title)} | Yasir Qadhi - AskYQ</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(fatwa.title)} | Yasir Qadhi - AskYQ" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="AskYQ" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(fatwa.title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <link rel="alternate" type="application/rss+xml" title="AskYQ RSS Feed" href="${SITE_URL}/feed.xml" />
    <script type="application/ld+json">${articleJsonLd}</script>
    <script type="application/ld+json">${faqJsonLd}</script>
    <script type="application/ld+json">${breadcrumbJsonLd}</script>
    <link rel="stylesheet" href="../../assets/css/main.css" />
  </head>
  <body>
    <div class="pattern-bg" aria-hidden="true"></div>

    <main class="page">
      <nav class="top-nav">
        <a href="../../" class="nav-link">Home</a>
        <a href="../../api/index.html" class="nav-link">API docs</a>
        <a href="../../feed.xml" class="nav-link">RSS</a>
      </nav>

      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="../../">Home</a>
        <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <a href="../../category/${catSlug}/">${escapeHtml(fatwa.category)}</a>
        <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span>${escapeHtml(fatwa.title)}</span>
      </nav>

      <div class="fatwa-header">
        <p class="fatwa-header-category">${escapeHtml(fatwa.category)}</p>
        <h1 class="fatwa-header-title">${escapeHtml(fatwa.title)}</h1>
        <div class="fatwa-header-meta">
          <span>${escapeHtml(fatwa.scholar)}</span>
          <span style="opacity:0.4">&#8226;</span>
          <span>${dateStr}</span>
          <span style="opacity:0.4">&#8226;</span>
          <a href="${fatwa.videoUrl}" target="_blank" rel="noopener">Watch on YouTube</a>
        </div>
        <div class="fatwa-tags">${tagsHtml}</div>
      </div>

      <div class="quick-answer">
        <p class="quick-answer-heading">Quick Answer</p>
        <p>${escapeHtml(desc)}</p>
      </div>

      <article class="fatwa-body">
        ${bodyHtml}
      </article>

      ${relatedHtml}

      <footer class="site-footer page-footer">
        <div class="footer-stat">
          <span class="stat-value">AskYQ</span>
          <span class="stat-subvalue">Islamic rulings from Yasir Qadhi</span>
        </div>
        <div class="footer-disclaimer">
          <p>Transcripts are AI-cleaned and AI-summarized, and may contain errors. <a href="https://github.com/abidlabs/askyq/compare" target="_blank" rel="noreferrer noopener">Open a PR to fix.</a></p>
          <p>It is always best to consult with a trusted, local scholar for your questions.</p>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}

// ============================================================
// CATEGORY PAGE
// ============================================================
function buildCategoryPage(category, catFatwas, allCategories) {
  const slug = slugify(category);
  const canonicalUrl = `${SITE_URL}/category/${slug}/`;
  const desc = `Islamic rulings on ${category.toLowerCase()} from Yasir Qadhi's lectures — ${catFatwas.length} fatwa${catFatwas.length !== 1 ? "s" : ""}.`;

  const cardsHtml = catFatwas
    .map((f) => fatwaCardHtml(f, "../../"))
    .join("\n");

  const otherCats = allCategories
    .filter((c) => c !== category)
    .map((c) => {
      const s = slugify(c);
      return `<a class="category-link" href="../${s}/">${escapeHtml(c)}</a>`;
    })
    .join("\n");

  const breadcrumbJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: category,
        },
      ],
    },
    null,
    2
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(category)} | Islamic Rulings - AskYQ</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(category)} | AskYQ" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="AskYQ" />
    <meta name="twitter:card" content="summary" />
    <link rel="alternate" type="application/rss+xml" title="AskYQ RSS Feed" href="${SITE_URL}/feed.xml" />
    <script type="application/ld+json">${breadcrumbJsonLd}</script>
    <link rel="stylesheet" href="../../assets/css/main.css" />
  </head>
  <body>
    <div class="pattern-bg" aria-hidden="true"></div>

    <main class="page page-wide">
      <nav class="top-nav">
        <a href="../../" class="nav-link">Home</a>
        <a href="../../api/index.html" class="nav-link">API docs</a>
        <a href="../../feed.xml" class="nav-link">RSS</a>
      </nav>

      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="../../">Home</a>
        <span class="breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span>${escapeHtml(category)}</span>
      </nav>

      <header class="category-header">
        <p class="eyebrow">Category</p>
        <h1 class="category-title">${escapeHtml(category)}</h1>
        <p class="category-count">${catFatwas.length} ruling${catFatwas.length !== 1 ? "s" : ""}</p>
      </header>

      <div class="recent-grid category-grid">
        ${cardsHtml}
      </div>

      <section class="other-categories">
        <h2 class="other-categories-heading">Browse Other Categories</h2>
        <div class="category-links">
          ${otherCats}
        </div>
      </section>

      <footer class="site-footer page-footer">
        <div class="footer-stat">
          <span class="stat-value">AskYQ</span>
          <span class="stat-subvalue">Islamic rulings from Yasir Qadhi</span>
        </div>
        <div class="footer-disclaimer">
          <p>Transcripts are AI-cleaned and AI-summarized, and may contain errors. <a href="https://github.com/abidlabs/askyq/compare" target="_blank" rel="noreferrer noopener">Open a PR to fix.</a></p>
          <p>It is always best to consult with a trusted, local scholar for your questions.</p>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}

// ============================================================
// HOMEPAGE
// ============================================================
function buildHomepage(fatwas, categories) {
  const canonicalUrl = `${SITE_URL}/`;
  const categoryNames = categories.map((c) => c.toLowerCase()).join(", ");
  const metaDesc = `Search ${fatwas.length} Islamic rulings and fatwas by Yasir Qadhi on topics like ${categoryNames}. AI-cleaned transcripts from YouTube Q&A sessions.`;

  // Recent cards (top 6)
  const recentCardsHtml = fatwas
    .slice(0, 6)
    .map((f) => fatwaCardHtml(f, "./"))
    .join("\n");

  // Category nav chips (link to category pages)
  const catChips = categories
    .map((cat) => {
      const catSlug = slugify(cat);
      const count = fatwas.filter((f) => f.category === cat).length;
      return `<a href="./category/${catSlug}/" class="category-chip">${escapeHtml(cat)} <span class="chip-count">${count}</span></a>`;
    })
    .join("\n");

  const websiteJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESC,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    null,
    2
  );

  // Build a comprehensive FAQPage from all fatwas for the homepage
  const faqJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: fatwas.map((f) => ({
        "@type": "Question",
        name: f.title,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.summary || f.stanceSummary || "",
        },
      })),
    },
    null,
    2
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AskYQ - Islamic Rulings &amp; Fatwas by Yasir Qadhi</title>
    <meta name="description" content="${escapeHtml(metaDesc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="AskYQ - Islamic Rulings &amp; Fatwas by Yasir Qadhi" />
    <meta property="og:description" content="${escapeHtml(SITE_DESC)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="AskYQ" />
    <meta name="twitter:card" content="summary" />
    <link rel="alternate" type="application/rss+xml" title="AskYQ RSS Feed" href="${SITE_URL}/feed.xml" />
    <script type="application/ld+json">${websiteJsonLd}</script>
    <script type="application/ld+json">${faqJsonLd}</script>
    <link rel="stylesheet" href="./assets/css/main.css" />
  </head>
  <body>
    <div class="pattern-bg" aria-hidden="true" id="patternBg"></div>

    <main class="landing">
      <nav class="top-nav">
        <a href="./" class="nav-link">Home</a>
        <a href="./api/index.html" class="nav-link">API docs</a>
        <a href="./feed.xml" class="nav-link">RSS</a>
      </nav>

      <section class="hero">
        <div class="bismillah" aria-hidden="true">&#1576;&#1587;&#1605; &#1575;&#1604;&#1604;&#1607; &#1575;&#1604;&#1585;&#1581;&#1605;&#1606; &#1575;&#1604;&#1585;&#1581;&#1610;&#1605;</div>
        <p class="eyebrow">Islamic rulings database</p>
        <h1 class="site-title">Ask<em>YQ</em></h1>
        <p class="site-tagline">
          Search fatwas and Islamic rulings derived from Yasir Qadhi's lectures and Q&A sessions.
        </p>

        <div class="search-wrap">
          <div class="search-box">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="9" cy="9" r="5.5"/>
              <path d="M14 14L17.5 17.5"/>
            </svg>
            <label for="fatwaSearch" class="sr-only">Search fatwas</label>
            <input
              id="fatwaSearch"
              type="text"
              placeholder="Search a topic, e.g. insurance, mortgage, music..."
              autocomplete="off"
              spellcheck="false"
              aria-controls="searchResults"
              aria-expanded="false"
            />
          </div>
          <div id="searchResults" class="results" role="listbox"></div>
        </div>
      </section>

      <section class="recent-section" id="recentSection">
        <p class="ornament" aria-hidden="true">&#10022; &#10022; &#10022;</p>
        <p class="recent-label">Recently added</p>
        <div class="marquee-wrap">
          <div class="marquee-track" id="recentGrid">
            ${recentCardsHtml}
            ${recentCardsHtml}
          </div>
        </div>
      </section>

      <section class="browse-section" id="browseSection">
        <p class="ornament" aria-hidden="true">&#10022; &#10022; &#10022;</p>
        <p class="recent-label">Browse all rulings by category</p>
        <div class="category-chips">
          ${catChips}
        </div>
      </section>

      <footer class="site-footer">
        <div class="footer-stat">
          <span class="stat-value" id="fatwaCount">${fatwas.length} fatwas in database</span>
          <span class="stat-subvalue">Transcripts cleaned and organized from video lectures</span>
        </div>
        <div class="footer-disclaimer">
          <p>Transcripts are AI-cleaned and AI-summarized, and may contain errors. <a href="https://github.com/abidlabs/askyq/compare" target="_blank" rel="noreferrer noopener">Open a PR to fix.</a></p>
          <p>It is always best to consult with a trusted, local scholar for your questions.</p>
        </div>
      </footer>
    </main>

    <script type="module" src="./assets/js/search.js"></script>
  </body>
</html>`;
}

// ============================================================
// SITEMAP
// ============================================================
function buildSitemap(fatwas, categories) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
  </url>`;

  for (const fatwa of fatwas) {
    xml += `
  <url>
    <loc>${SITE_URL}/fatwa/${fatwa.id}/</loc>
    <lastmod>${fatwa.datePublished}</lastmod>
    <priority>0.8</priority>
  </url>`;
  }

  for (const cat of categories) {
    xml += `
  <url>
    <loc>${SITE_URL}/category/${slugify(cat)}/</loc>
    <priority>0.6</priority>
    <changefreq>weekly</changefreq>
  </url>`;
  }

  xml += `
  <url>
    <loc>${SITE_URL}/api/index.html</loc>
    <priority>0.3</priority>
  </url>
</urlset>
`;
  return xml;
}

// ============================================================
// ROBOTS.TXT
// ============================================================
function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ============================================================
// RSS FEED
// ============================================================
function buildFeed(fatwas) {
  const items = fatwas
    .slice(0, 50)
    .map(
      (f) => `    <item>
      <title>${escapeHtml(f.title)}</title>
      <link>${SITE_URL}/fatwa/${f.id}/</link>
      <guid isPermaLink="true">${SITE_URL}/fatwa/${f.id}/</guid>
      <description>${escapeHtml(f.stanceSummary || f.summary)}</description>
      <pubDate>${toRfc2822(f.datePublished)}</pubDate>
      <category>${escapeHtml(f.category)}</category>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AskYQ - Islamic Rulings from Yasir Qadhi</title>
    <link>${SITE_URL}/</link>
    <description>${escapeHtml(SITE_DESC)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

// ============================================================
// MAIN
// ============================================================
function main() {
  const fatwas = loadAllFatwas();
  const categories = [...new Set(fatwas.map((f) => f.category))].sort();

  // 1. Individual fatwa pages
  let fatwaCount = 0;
  for (const fatwa of fatwas) {
    const dir = path.join(ROOT, "fatwa", fatwa.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      buildFatwaPage(fatwa, fatwas)
    );
    fatwaCount++;
  }
  console.log(`  ${fatwaCount} fatwa pages`);

  // 2. Category pages
  let catCount = 0;
  for (const cat of categories) {
    const slug = slugify(cat);
    const dir = path.join(ROOT, "category", slug);
    fs.mkdirSync(dir, { recursive: true });
    const catFatwas = fatwas.filter((f) => f.category === cat);
    fs.writeFileSync(
      path.join(dir, "index.html"),
      buildCategoryPage(cat, catFatwas, categories)
    );
    catCount++;
  }
  console.log(`  ${catCount} category pages`);

  // 3. Homepage
  fs.writeFileSync(path.join(ROOT, "index.html"), buildHomepage(fatwas, categories));
  console.log("  index.html");

  // 4. Sitemap
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), buildSitemap(fatwas, categories));
  console.log("  sitemap.xml");

  // 5. Robots
  fs.writeFileSync(path.join(ROOT, "robots.txt"), buildRobots());
  console.log("  robots.txt");

  // 6. RSS feed
  fs.writeFileSync(path.join(ROOT, "feed.xml"), buildFeed(fatwas));
  console.log("  feed.xml");

  console.log("\nDone.");
}

main();
