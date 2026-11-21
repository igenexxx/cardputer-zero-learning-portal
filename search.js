/**
 * Full-Site Live Search Index & Result Filtering Controller
 * Dependency-injected: receives DOM elements, route provider, and markdown fetcher.
 */

import { escapeHtml } from "./markdown.js";

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(plain, queryLower) {
  const idx = plain.toLowerCase().indexOf(queryLower);
  if (idx < 0) return escapeHtml(plain.slice(0, 120)) + (plain.length > 120 ? "..." : "");
  const start = Math.max(0, idx - 45);
  const end = Math.min(plain.length, idx + queryLower.length + 75);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < plain.length ? "..." : "";
  const safeSlice = escapeHtml(plain.slice(start, end));
  const re = new RegExp(`(${queryLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return prefix + safeSlice.replace(re, "<mark>$1</mark>") + suffix;
}

function rankSearchMatches(index, queryLower) {
  return index
    .map((entry) => {
      let score = 0;
      if (entry.titleLower.includes(queryLower)) score += 10;
      if (entry.lower.includes(queryLower)) score += 5;
      return { entry, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function renderSearchResults(resultsEl, matches, query, queryLower) {
  if (matches.length === 0) {
    resultsEl.innerHTML = `<div class="search-empty">No matches for "${escapeHtml(query)}"</div>`;
    return;
  }
  resultsEl.innerHTML = matches
    .map(
      ({ entry }) =>
        `<a class="search-result-item" role="option" href="#/${entry.route.slug}">` +
          `<div class="search-result-top">` +
            `<span>${escapeHtml(entry.route.title)}</span>` +
            `<span class="search-result-section">${escapeHtml(entry.route.sectionTitle)}</span>` +
          `</div>` +
          `<div class="search-result-snippet">${buildSnippet(entry.plain, queryLower)}</div>` +
        `</a>`
    )
    .join("");
}

async function buildSearchIndex(routes, fetchMarkdown) {
  return Promise.all(
    routes.map(async (route) => {
      try {
        const plain = stripMarkdown(await fetchMarkdown(route.file));
        return { route, plain, lower: plain.toLowerCase(), titleLower: route.title.toLowerCase() };
      } catch (_) {
        return { route, plain: "", lower: "", titleLower: route.title.toLowerCase() };
      }
    })
  );
}

export function createSearchController({ inputEl, resultsEl, getRoutes, fetchMarkdown }) {
  let indexed = false;
  let index = [];

  async function ensureIndex() {
    if (indexed) return;
    indexed = true;
    index = await buildSearchIndex(getRoutes(), fetchMarkdown);
  }

  function close() {
    resultsEl.hidden = true;
    inputEl.setAttribute("aria-expanded", "false");
  }

  async function handleInput() {
    const query = inputEl.value.trim();
    if (!query) {
      close();
      return;
    }

    await ensureIndex();
    const qLower = query.toLowerCase();
    const matches = rankSearchMatches(index, qLower);
    renderSearchResults(resultsEl, matches, query, qLower);

    resultsEl.hidden = false;
    inputEl.setAttribute("aria-expanded", "true");
  }

  function bindEvents() {
    inputEl.addEventListener("focus", () => {
      ensureIndex();
      if (inputEl.value.trim()) handleInput();
    });
    inputEl.addEventListener("input", handleInput);
    resultsEl.addEventListener("click", () => {
      close();
      inputEl.value = "";
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".header-search")) close();
    });
  }

  return { ensureIndex, handleInput, close, bindEvents };
}
