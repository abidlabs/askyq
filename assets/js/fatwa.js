const headerEl = document.getElementById("fatwaHeader");
const categoryEl = document.getElementById("fatwaCategory");
const titleEl = document.getElementById("fatwaTitle");
const metaEl = document.getElementById("fatwaMeta");
const tagsEl = document.getElementById("fatwaTags");
const bodyEl = document.getElementById("fatwaBody");

function markdownToHtml(md) {
  let html = md;

  // blockquotes (must come before paragraph handling)
  html = html.replace(/^>\s*(.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  // merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "\n");

  // headings
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

  // hr
  html = html.replace(/^---$/gm, "<hr>");

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // unordered lists
  html = html.replace(/^(\s*)-\s+(.+)$/gm, (_, indent, content) => {
    return `<li>${content}</li>`;
  });
  // wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");

  // ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // wrap consecutive ordered <li> in <ol> - simplified
  // (this is fine for our use case since we convert unordered first)

  // paragraphs: wrap lines that aren't already HTML
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

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    bodyEl.innerHTML = "<p>No fatwa ID specified.</p>";
    return;
  }

  try {
    const res = await fetch(`../api/fatwas/${encodeURIComponent(id)}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fatwa = await res.json();

    document.title = `${fatwa.title} - AskQadi`;

    categoryEl.textContent = fatwa.category;
    titleEl.textContent = fatwa.title;

    const dateStr = new Date(fatwa.datePublished).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    metaEl.innerHTML = `
      <span>${fatwa.scholar}</span>
      <span style="opacity:0.4">\u2022</span>
      <span>${dateStr}</span>
      <span style="opacity:0.4">\u2022</span>
      <a href="${fatwa.videoUrl}">Watch on YouTube</a>
    `;

    if (fatwa.tags && fatwa.tags.length) {
      tagsEl.innerHTML = fatwa.tags
        .map((t) => `<span class="fatwa-tag">${t}</span>`)
        .join("");
    }

    bodyEl.innerHTML = markdownToHtml(fatwa.transcript);
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = `<p>Failed to load fatwa. <a href="../index.html">Return to search.</a></p>`;
  }
}

init();
