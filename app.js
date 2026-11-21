/**
 * CardputerZero RF & NFC Learning Portal — Static SPA Shell
 * Manifest loader, hash-based router, sidebar navigation, TOC scroll-spy,
 * mobile drawer, and interactive widget registry mounter.
 */

import {
  mountSmartSquelch,
  mountOokDecoder,
  mountNfcInspector,
  mountSignalClassifier,
  mountFoxhuntRadar,
  mountIrLab,
} from "./widgets.js";
import { escapeHtml, parseMarkdown } from "./markdown.js";
import { createSearchController } from "./search.js";

const WIDGET_REGISTRY = {
  "interactive:smart-squelch": mountSmartSquelch,
  "interactive:ook-decoder": mountOokDecoder,
  "interactive:nfc-inspector": mountNfcInspector,
  "interactive:signal-classifier": mountSignalClassifier,
  "interactive:foxhunt-radar": mountFoxhuntRadar,
  "interactive:ir-protocol-lab": mountIrLab,
  "interactive:ir-lab": mountIrLab,
};

const appState = {
  manifest: null,
  flatRoutes: [],
  routeMap: new Map(),
  markdownCache: new Map(),
  activeCleanups: [],
  tocObserver: null,
};

const dom = {
  portalTitle: document.getElementById("portal-title"),
  navTree: document.getElementById("nav-tree"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  articleContent: document.getElementById("article-content"),
  pagerNav: document.getElementById("pager-nav"),
  tocList: document.getElementById("toc-list"),
  sidebar: document.getElementById("sidebar-nav"),
  menuToggle: document.getElementById("menu-toggle"),
  menuClose: document.getElementById("menu-close"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  searchInput: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results"),
};

function openMobileDrawer() {
  dom.sidebar.classList.add("is-open");
  dom.drawerBackdrop.hidden = false;
  dom.menuToggle.setAttribute("aria-expanded", "true");
}

function closeMobileDrawer() {
  dom.sidebar.classList.remove("is-open");
  dom.drawerBackdrop.hidden = true;
  dom.menuToggle.setAttribute("aria-expanded", "false");
}

function createNavItemElement(item) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "nav-link";
  a.href = `#/${item.slug}`;
  a.dataset.slug = item.slug;

  const labelSpan = document.createElement("span");
  labelSpan.textContent = item.title;
  a.appendChild(labelSpan);

  if (item.badge) {
    const badge = document.createElement("span");
    badge.className = "nav-badge";
    badge.textContent = item.badge;
    a.appendChild(badge);
  }

  a.addEventListener("click", closeMobileDrawer);
  li.appendChild(a);
  return li;
}

function createNavSectionElement(sec) {
  const sectionEl = document.createElement("div");
  sectionEl.className = "nav-section";

  const titleEl = document.createElement("h2");
  titleEl.className = "nav-section-title";
  titleEl.textContent = sec.title;
  sectionEl.appendChild(titleEl);

  const ul = document.createElement("ul");
  ul.className = "nav-list";
  sec.items.forEach((item) => ul.appendChild(createNavItemElement(item)));
  sectionEl.appendChild(ul);
  return sectionEl;
}

function buildSidebar() {
  const frag = document.createDocumentFragment();
  appState.manifest.sections.forEach((sec) => frag.appendChild(createNavSectionElement(sec)));
  dom.navTree.innerHTML = "";
  dom.navTree.appendChild(frag);
}

function updateActiveNav(slug) {
  dom.navTree.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.slug === slug;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function renderBreadcrumbs(route) {
  dom.breadcrumbs.innerHTML =
    `<a href="#/${appState.manifest.defaultRoute}">Portal</a>` +
    `<span class="sep">/</span>` +
    `<span>${escapeHtml(route.sectionTitle)}</span>` +
    `<span class="sep">/</span>` +
    `<span class="crumb-current">${escapeHtml(route.title)}</span>`;
}

function renderPager(slug) {
  const idx = appState.flatRoutes.findIndex((r) => r.slug === slug);
  const prev = idx > 0 ? appState.flatRoutes[idx - 1] : null;
  const next = idx >= 0 && idx < appState.flatRoutes.length - 1 ? appState.flatRoutes[idx + 1] : null;

  const link = (cls, label, r) =>
    `<a class="pager-card ${cls}" href="#/${r.slug}"><span class="pager-label">${label}</span><span class="pager-title">${escapeHtml(r.title)}</span></a>`;
  const parts = [];
  if (prev) parts.push(link("pager-prev", "&larr; Previous", prev));
  if (next) parts.push(link("pager-next", "Next &rarr;", next));
  dom.pagerNav.innerHTML = parts.join("");
}

function observeTocHeadings(headings) {
  const headingEls = headings.map((h) => document.getElementById(h.id)).filter(Boolean);
  if (!("IntersectionObserver" in window) || headingEls.length === 0) return;

  appState.tocObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((e) => e.isIntersecting);
      if (!visible) return;
      const activeId = visible.target.id;
      dom.tocList.querySelectorAll(".toc-link").forEach((l) => {
        l.classList.toggle("is-active", l.dataset.tocId === activeId);
      });
    },
    { rootMargin: "-70px 0px -70% 0px", threshold: 0.1 }
  );
  headingEls.forEach((el) => appState.tocObserver.observe(el));
}

function renderToc(headings) {
  if (appState.tocObserver) {
    appState.tocObserver.disconnect();
    appState.tocObserver = null;
  }
  if (!headings.length) {
    dom.tocList.innerHTML = `<span class="toc-empty">No subsections</span>`;
    return;
  }

  dom.tocList.innerHTML = headings
    .map(
      (h) =>
        `<a class="toc-link toc-h${h.level}" href="javascript:void(0)" data-toc-id="${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`
    )
    .join("");

  dom.tocList.querySelectorAll(".toc-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.tocId);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  observeTocHeadings(headings);
}

function cleanupWidgets() {
  appState.activeCleanups.forEach((fn) => {
    try { fn(); } catch (_) {}
  });
  appState.activeCleanups = [];
}

function mountWidgetsInArticle() {
  dom.articleContent.querySelectorAll(".widget-mount[data-widget]").forEach((container) => {
    const mounter = WIDGET_REGISTRY[container.dataset.widget];
    if (typeof mounter === "function") {
      const cleanup = mounter(container);
      if (typeof cleanup === "function") {
        appState.activeCleanups.push(cleanup);
      }
    }
  });
}

function bindArticleInteractions() {
  dom.articleContent.querySelectorAll(".code-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.closest(".code-block")?.querySelector("pre code")?.textContent || "";
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 1200);
      }).catch(() => {});
    });
  });

  dom.articleContent.querySelectorAll("[data-scroll-to]").forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(anchor.dataset.scrollTo);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function fetchMarkdownFile(filePath) {
  if (appState.markdownCache.has(filePath)) {
    return appState.markdownCache.get(filePath);
  }
  const resp = await fetch(filePath);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} while loading ${filePath}`);
  }
  const text = await resp.text();
  appState.markdownCache.set(filePath, text);
  return text;
}

function parseHashRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { slug: appState.manifest.defaultRoute, anchor: "" };
  const [slugPart, anchorPart = ""] = raw.split("#");
  const slug = slugPart.replace(/\/+$/, "") || appState.manifest.defaultRoute;
  return { slug, anchor: anchorPart };
}

function renderErrorState(title, message, hintHtml = "") {
  dom.articleContent.innerHTML =
    `<div class="error-state">` +
      `<h2>${escapeHtml(title)}</h2>` +
      `<p>${escapeHtml(message)}</p>` +
      hintHtml +
    `</div>`;
}

async function loadRoute() {
  const { slug, anchor } = parseHashRoute();
  const route = appState.routeMap.get(slug) || appState.routeMap.get(appState.manifest.defaultRoute);
  if (!route) return;

  cleanupWidgets();
  updateActiveNav(route.slug);
  renderBreadcrumbs(route);
  renderPager(route.slug);
  document.title = `${route.title} · ${appState.manifest.title}`;

  dom.articleContent.innerHTML =
    `<div class="loading-state"><div class="spinner" aria-hidden="true"></div><p>Loading ${escapeHtml(route.title)}...</p></div>`;

  try {
    const md = await fetchMarkdownFile(route.file);
    const { html, headings } = parseMarkdown(md, { isWidget: (info) => Boolean(WIDGET_REGISTRY[info]) });
    dom.articleContent.innerHTML = html;
    renderToc(headings);
    bindArticleInteractions();
    mountWidgetsInArticle();

    if (anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  } catch (err) {
    renderErrorState(
      "Unable to load module",
      err.message,
      `<p>Ensure you are serving <code>learning-portal/</code> over HTTP (e.g. <code>python3 -m http.server</code> or GitHub Pages).</p>`
    );
    renderToc([]);
  }
}

function indexManifestRoutes(manifest) {
  manifest.sections.forEach((sec) => {
    sec.items.forEach((item) => {
      const enriched = { ...item, sectionId: sec.id, sectionTitle: sec.title };
      appState.flatRoutes.push(enriched);
      appState.routeMap.set(item.slug, enriched);
    });
  });
}

function bindGlobalShortcuts(search) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMobileDrawer();
      search.close();
    } else if (
      e.key === "/" &&
      document.activeElement !== dom.searchInput &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    ) {
      e.preventDefault();
      dom.searchInput.focus();
    }
  });
}

async function init() {
  const search = createSearchController({
    inputEl: dom.searchInput,
    resultsEl: dom.searchResults,
    getRoutes: () => appState.flatRoutes,
    fetchMarkdown: fetchMarkdownFile,
  });

  dom.menuToggle.addEventListener("click", openMobileDrawer);
  dom.menuClose.addEventListener("click", closeMobileDrawer);
  dom.drawerBackdrop.addEventListener("click", closeMobileDrawer);
  search.bindEvents();
  bindGlobalShortcuts(search);

  try {
    const resp = await fetch("manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} loading manifest.json`);
    appState.manifest = await resp.json();
    dom.portalTitle.textContent = appState.manifest.title;

    indexManifestRoutes(appState.manifest);
    buildSidebar();
    window.addEventListener("hashchange", loadRoute);
    await loadRoute();
  } catch (err) {
    renderErrorState("Portal Initialization Error", err.message);
  }
}

init();
