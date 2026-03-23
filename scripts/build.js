#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================
const SITE_URL = (process.env.SITE_URL || "https://askqadi.org").replace(
  /\/$/,
  ""
);
const SITE_NAME = "AskQadi";
const SITE_LOGO_MARKUP = "Ask<em>Qadi</em>";
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
// FOOTER HTML (reused across pages)
// ============================================================
function footerHtml(statValue, statSubvalue, cssExtra) {
  const cls = cssExtra ? `site-footer ${cssExtra}` : "site-footer";
  return `<footer class="${cls}" id="siteFooter">
        <button class="footer-close" id="footerClose" aria-label="Dismiss">&times;</button>
        <div class="footer-stat">
          <span class="stat-value" id="fatwaCount">${statValue}</span>
          <span class="stat-subvalue">${statSubvalue}</span>
        </div>
        <div class="footer-disclaimer">
          <p>Transcripts are AI-cleaned and AI-summarized, and may contain errors. <a href="https://github.com/abidlabs/askyq/compare" target="_blank" rel="noreferrer noopener">Open a PR to fix.</a></p>
          <p>It is always best to consult with a trusted, local scholar for your questions.</p>
        </div>
      </footer>
      <button class="footer-toggle" id="footerToggle" aria-label="Show footer">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 9.5L7 5.5L11 9.5"/></svg>
      </button>
      <script>
      (function(){
        var f=document.getElementById('siteFooter');
        var t=document.getElementById('footerToggle');
        var btn=document.getElementById('footerClose');
        if(!f||!t) return;
        function hide(){f.hidden=true;t.classList.add('visible');localStorage.setItem('footerDismissed','1');}
        function show(){f.hidden=false;t.classList.remove('visible');localStorage.removeItem('footerDismissed');}
        if(localStorage.getItem('footerDismissed')==='1') hide();
        if(btn) btn.addEventListener('click',hide);
        t.addEventListener('click',show);
      })();
      </script>`;
}

function fatwaVideoFooterHtml(fatwa) {
  const vid = escapeHtml(fatwa.videoId);
  const vurl = escapeHtml(fatwa.videoUrl);
  const thumb = `https://img.youtube.com/vi/${fatwa.videoId}/hqdefault.jpg`;
  return `<footer class="fatwa-video-dock" id="fatwaVideoDock" data-video-id="${vid}" data-video-url="${vurl}">
      <button type="button" class="footer-close" id="fatwaFooterClose" aria-label="Dismiss">&times;</button>
      <div class="fatwa-video-dock__inner">
        <a class="fatwa-video-thumb" href="${vurl}" target="_blank" rel="noopener noreferrer" aria-label="Open video on YouTube">
          <img src="${thumb}" alt="" width="120" height="68" loading="lazy" decoding="async" />
        </a>
        <div class="fatwa-video-dock__center">
          <div class="fatwa-video-scrub" aria-hidden="true">
            <div class="fatwa-video-scrub__track">
              <div class="fatwa-video-scrub__fill" id="fatwaVideoScrubFill"></div>
            </div>
          </div>
          <div class="fatwa-video-meta">
            <span class="fatwa-video-times" aria-live="polite">
              <span id="fatwaTimeCurrent">0:00</span><span class="fatwa-video-times__sep"> / </span><span id="fatwaTimeDuration">--:--</span>
            </span>
            <div class="fatwa-video-speed" role="group" aria-label="Playback speed">
              <button type="button" class="fatwa-video-speed__btn" data-rate="0.5">0.5×</button>
              <button type="button" class="fatwa-video-speed__btn is-active" data-rate="1">1×</button>
              <button type="button" class="fatwa-video-speed__btn" data-rate="2">2×</button>
            </div>
            <p class="fatwa-video-disclaimer">Transcripts are AI-cleaned and may contain errors. Listen to the original video to verify.</p>
          </div>
        </div>
        <button type="button" class="fatwa-video-playbtn" id="fatwaPlayBtn" aria-label="Play or pause video">
          <svg class="fatwa-video-playbtn__icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          <svg class="fatwa-video-playbtn__icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
      </div>
      <div class="fatwa-yt-host" id="fatwaYtPlayerHost" aria-hidden="true"></div>
    </footer>
    <button type="button" class="footer-toggle" id="fatwaFooterToggle" aria-label="Show video bar">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 9.5L7 5.5L11 9.5"/></svg>
      </button>
    <script>
      (function(){
        var f=document.getElementById("fatwaVideoDock");
        var t=document.getElementById("fatwaFooterToggle");
        var btn=document.getElementById("fatwaFooterClose");
        if(!f||!t) return;
        var key="fatwaVideoDockDismissed";
        function hide(){f.hidden=true;t.classList.add("visible");try{localStorage.setItem(key,"1");}catch(e){}}
        function show(){f.hidden=false;t.classList.remove("visible");try{localStorage.removeItem(key);}catch(e){}}
        try{if(localStorage.getItem(key)==="1") hide();}catch(e){}
        if(btn) btn.addEventListener("click",hide);
        t.addEventListener("click",show);
      })();
    </script>
    <script type="module" src="../../assets/js/fatwa-player.js"></script>`;
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
    .slice(0, 5)
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

  const altQuestions = fatwa.alternateQuestions || [];

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

  // Include alternate questions in FAQPage schema — all point to the same answer
  const faqEntries = [
    {
      "@type": "Question",
      name: fatwa.title,
      acceptedAnswer: { "@type": "Answer", text: desc },
    },
    ...altQuestions.map((q) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: desc },
    })),
  ];

  const faqJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqEntries,
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
    <title>${escapeHtml(fatwa.title)} | Yasir Qadhi - ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(fatwa.title)} | Yasir Qadhi - ${SITE_NAME}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${SITE_URL}/assets/images/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE_URL}/assets/images/og-image.png" />
    <meta name="twitter:title" content="${escapeHtml(fatwa.title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} RSS Feed" href="${SITE_URL}/feed.xml" />
    <script type="application/ld+json">${articleJsonLd}</script>
    <script type="application/ld+json">${faqJsonLd}</script>
    <script type="application/ld+json">${breadcrumbJsonLd}</script>
    <link rel="stylesheet" href="../../assets/css/main.css" />
  </head>
  <body class="has-fatwa-video">
    <div class="pattern-bg" aria-hidden="true"></div>

    <main class="page page-fatwa">
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

      ${fatwaVideoFooterHtml(fatwa)}
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
    <title>${escapeHtml(category)} | Islamic Rulings - ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(category)} | ${SITE_NAME}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${SITE_URL}/assets/images/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE_URL}/assets/images/og-image.png" />
    <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} RSS Feed" href="${SITE_URL}/feed.xml" />
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

      ${footerHtml(SITE_NAME, "Islamic rulings from Yasir Qadhi", "page-footer")}
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
    <title>${SITE_NAME} - Islamic Rulings &amp; Fatwas by Yasir Qadhi</title>
    <meta name="description" content="${escapeHtml(metaDesc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${SITE_NAME} - Islamic Rulings &amp; Fatwas by Yasir Qadhi" />
    <meta property="og:description" content="${escapeHtml(SITE_DESC)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${SITE_URL}/assets/images/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE_URL}/assets/images/og-image.png" />
    <link rel="alternate" type="application/rss+xml" title="${SITE_NAME} RSS Feed" href="${SITE_URL}/feed.xml" />
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
        <h1 class="site-title">${SITE_LOGO_MARKUP}</h1>
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

      ${footerHtml(`${fatwas.length} fatwas in database`, "Transcripts cleaned and organized from video lectures")}
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
    <title>${SITE_NAME} - Islamic Rulings from Yasir Qadhi</title>
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

  const cnameHost =
    process.env.CNAME_HOST || new URL(`${SITE_URL}/`).hostname;
  fs.writeFileSync(path.join(ROOT, "CNAME"), `${cnameHost}\n`);
  console.log("  CNAME");

  // 7. OG image (update fatwa count)
  generateOgImage(fatwas.length);

  console.log("\nDone.");
}

function generateOgImage(count) {
  const { execSync } = require("child_process");
  const templatePath = path.join(ROOT, "scripts", "og-image.html");
  const imgDir = path.join(ROOT, "assets", "images");
  const imgPath = path.join(imgDir, "og-image.png");

  // Read template and inject count
  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace("FATWA_COUNT", String(count));

  // Write temp file with updated count
  const tmpPath = path.join(ROOT, "tmp", "og-image-tmp.html");
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
  fs.writeFileSync(tmpPath, html);
  fs.mkdirSync(imgDir, { recursive: true });

  // Try to generate with Chrome
  const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
  ];
  for (const chrome of chromePaths) {
    try {
      execSync(
        `"${chrome}" --headless --disable-gpu --screenshot="${imgPath}" --window-size=1200,630 --hide-scrollbars "${tmpPath}"`,
        { stdio: "ignore" }
      );
      fs.unlinkSync(tmpPath);
      console.log("  og-image.png");
      return;
    } catch (_) {
      // try next
    }
  }
  fs.unlinkSync(tmpPath);
  console.log("  og-image.png (skipped — Chrome not found)");
}

main();
