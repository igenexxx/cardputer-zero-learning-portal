/**
 * Pure Markdown-to-HTML Parser & Renderer
 * Supports ATX headings + unique slugger, GitHub-style callouts, GFM tables,
 * fenced code blocks + interactive:* widget placeholders, inline formatting,
 * lightweight LaTeX math tokens, nested lists, and semantic image figures.
 * Zero DOM, router, or widget-registry coupling.
 */

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`[^`]*`/g, (m) => m.slice(1, -1))
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}

function formatMathToken(tex) {
  return escapeHtml(tex)
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ")
    .replace(/\\delta/g, "δ").replace(/\\Delta/g, "Δ").replace(/\\sigma/g, "σ")
    .replace(/\\mu/g, "μ").replace(/\\pi/g, "π")
    .replace(/\\ge/g, "≥").replace(/\\le/g, "≤").replace(/\\neq/g, "≠").replace(/\\approx/g, "≈")
    .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\pm/g, "±").replace(/\\rightarrow/g, "→")
    .replace(/_\{([^}]+)\}/g, "<sub>$1</sub>").replace(/_([a-zA-Z0-9])/g, "<sub>$1</sub>")
    .replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>").replace(/\^([a-zA-Z0-9])/g, "<sup>$1</sup>");
}

function stashInlineTokens(raw, stash) {
  let text = raw.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/\$([^$\n]+)\$/g, (_, expr) => stash(`<span class="math-inline">${formatMathToken(expr)}</span>`));
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
    const cls = src.includes("assets/") ? ' class="lcd-shot"' : "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return stash(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${cls}${titleAttr} loading="lazy">`);
  });
  return text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, href, title) => {
    const attrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return stash(`<a href="${escapeHtml(href)}"${attrs}${titleAttr}>${parseInline(label)}</a>`);
  });
}

export function parseInline(raw) {
  const placeholders = [];
  const stash = (html) => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `\u0000${idx}\u0000`;
  };

  let text = escapeHtml(stashInlineTokens(raw, stash));
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "<em>$1</em>");

  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)]);
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cur = "";
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      cur += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line) ||
    (/^\s*\|?\s*:?-{3,}:?\s*\|?\s*$/.test(line) && line.includes("|"));
}

function createSlugger() {
  const counts = new Map();
  return (text) => {
    const base = slugify(text);
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function parseFencedBlock(lines, start, fenceMatch, ctx) {
  const fence = fenceMatch[1];
  const info = (fenceMatch[2] || "").trim();
  const bodyLines = [];
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith(fence)) {
    bodyLines.push(lines[i]);
    i++;
  }
  if (i < lines.length) i++;

  if (ctx.isWidget(info)) {
    const wid = `widget-${ctx.widgetCounter++}`;
    return { html: `<div class="widget-mount" id="${wid}" data-widget="${escapeHtml(info)}"></div>`, next: i };
  }
  const langLabel = info ? escapeHtml(info) : "text";
  const codeText = escapeHtml(bodyLines.join("\n"));
  const html =
    `<div class="code-block">` +
      `<div class="code-block-header"><span>${langLabel}</span><button type="button" class="code-copy-btn">Copy</button></div>` +
      `<pre><code class="language-${langLabel}">${codeText}</code></pre>` +
    `</div>`;
  return { html, next: i };
}

function parseHeading(headingMatch, ctx) {
  const level = headingMatch[1].length;
  const rawTitle = headingMatch[2].trim();
  const id = ctx.uniqueSlug(rawTitle);
  if (level === 2 || level === 3) {
    ctx.headings.push({
      level,
      id,
      text: rawTitle.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1"),
    });
  }
  const anchor = level >= 2
    ? `<a class="heading-anchor" href="javascript:void(0)" data-scroll-to="${id}" aria-label="Link to ${escapeHtml(rawTitle)}">#</a>`
    : "";
  return `<h${level} id="${id}">${parseInline(rawTitle)}${anchor}</h${level}>`;
}

function parseBlockquote(lines, start, options) {
  const quoteLines = [];
  let i = start;
  while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
    quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
    i++;
  }

  const firstLine = quoteLines[0]?.trim() || "";
  const calloutMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
  if (calloutMatch) {
    const type = calloutMatch[1].toLowerCase();
    const label = calloutMatch[1].toUpperCase();
    const innerHtml = parseMarkdown(quoteLines.slice(1).join("\n"), options).html;
    return {
      html: `<div class="callout callout-${type}"><div class="callout-title">${label}</div><div class="callout-body">${innerHtml}</div></div>`,
      next: i,
    };
  }
  return { html: `<blockquote>${parseMarkdown(quoteLines.join("\n"), options).html}</blockquote>`, next: i };
}

function parseTable(lines, start) {
  const headers = splitTableRow(lines[start]);
  const alignments = splitTableRow(lines[start + 1]).map((cell) => {
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    if (cell.endsWith(":")) return "right";
    return "left";
  });
  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
    rows.push(splitTableRow(lines[i]));
    i++;
  }
  const thead = headers
    .map((h, idx) => `<th style="text-align:${alignments[idx] || "left"}">${parseInline(h)}</th>`)
    .join("");
  const tbody = rows
    .map(
      (r) =>
        "<tr>" +
        headers
          .map((_, idx) => `<td style="text-align:${alignments[idx] || "left"}">${parseInline(r[idx] || "")}</td>`)
          .join("") +
        "</tr>"
    )
    .join("");
  return { html: `<div class="table-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`, next: i };
}

function parseList(lines, start, listStart, options) {
  const ordered = /^\d+\./.test(listStart[2]);
  const baseIndent = listStart[1].length;
  const tag = ordered ? "ol" : "ul";
  const items = [];
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!m) break;
    const indent = m[1].length;
    const curOrdered = /^\d+\./.test(m[2]);

    if (indent > baseIndent && items.length > 0) {
      const subLines = [];
      while (i < lines.length) {
        const subM = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!subM || subM[1].length <= baseIndent) break;
        subLines.push(lines[i].slice(indent));
        i++;
      }
      items[items.length - 1] += parseMarkdown(subLines.join("\n"), options).html;
      continue;
    }

    if (indent < baseIndent || curOrdered !== ordered) break;
    items.push(parseInline(m[3]));
    i++;
  }
  return { html: `<${tag}>${items.map((it) => `<li>${it}</li>`).join("")}</${tag}>`, next: i };
}

function parseStandaloneImage(imgOnly) {
  const alt = escapeHtml(imgOnly[1]);
  const src = escapeHtml(imgOnly[2]);
  const caption = escapeHtml(imgOnly[3] || imgOnly[1]);
  const cls = src.includes("assets/") ? ' class="lcd-shot"' : "";
  return (
    `<figure class="md-figure">` +
      `<img src="${src}" alt="${alt}"${cls} loading="lazy">` +
      (caption ? `<figcaption>${caption}</figcaption>` : "") +
    `</figure>`
  );
}

function isBlockStart(lines, idx) {
  const line = lines[idx];
  return (
    /^\s*$/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^(`{3,}|~{3,})/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line) ||
    /^(\s*)([-*+]|\d+\.)\s+/.test(line) ||
    (line.includes("|") && idx + 1 < lines.length && isTableSeparator(lines[idx + 1]))
  );
}

function parseParagraph(lines, start) {
  const paraLines = [];
  let i = start;
  while (i < lines.length && !isBlockStart(lines, i)) {
    paraLines.push(lines[i].trim());
    i++;
  }
  return { html: paraLines.length > 0 ? `<p>${parseInline(paraLines.join(" "))}</p>` : "", next: i };
}

const defaultIsWidget = (info) => info.startsWith("interactive:");

export function parseMarkdown(markdown, options = {}) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const ctx = {
    isWidget: typeof options.isWidget === "function" ? options.isWidget : defaultIsWidget,
    headings: [],
    uniqueSlug: createSlugger(),
    widgetCounter: 0,
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*([^\s`]*)\s*$/);
    if (fenceMatch) { const r = parseFencedBlock(lines, i, fenceMatch, ctx); out.push(r.html); i = r.next; continue; }

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (headingMatch) { out.push(parseHeading(headingMatch, ctx)); i++; continue; }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*>\s?/.test(line)) { const r = parseBlockquote(lines, i, options); out.push(r.html); i = r.next; continue; }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const r = parseTable(lines, i);
      out.push(r.html);
      i = r.next;
      continue;
    }

    const listStart = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listStart) { const r = parseList(lines, i, listStart, options); out.push(r.html); i = r.next; continue; }

    const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (imgOnly) { out.push(parseStandaloneImage(imgOnly)); i++; continue; }

    const para = parseParagraph(lines, i);
    if (para.html) out.push(para.html);
    i = para.next;
  }

  return { html: out.join("\n"), headings: ctx.headings };
}
