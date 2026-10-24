// Bibliothèque de polices de l'éditeur de calques.
// Toutes les familles Google Fonts (sous-ensemble latin, graisses 400 et 700) sont
// auto-hébergées dans /fonts : aucune requête vers Google (pas de transfert d'IP).
// Rien n'est téléchargé d'avance : chaque police se charge à son premier usage,
// et le menu n'affiche qu'un mini-fichier par nom (preview.woff2, quelques Ko).
// Généré par tools/fonts-gen (catalogue.json + fichiers).

export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
export interface FontEntry { id: string; family: string; category: FontCategory; bold: boolean; accents: boolean }

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  "sans-serif": "Sans empattement",
  serif: "Avec empattement",
  display: "Fantaisie",
  handwriting: "Manuscrite",
  monospace: "Chasse fixe",
};
const CODES: Record<string, FontCategory> = { s: "sans-serif", e: "serif", d: "display", h: "handwriting", m: "monospace" };

// Polices déjà fournies par @fontsource (src/fonts.ts) : disponibles sans passer par /fonts.
const BUNDLED = new Set(["Inter", "Manrope", "Space Grotesk", "Anton", "Bebas Neue", "Oswald", "Playfair Display", "Lora",
  "Merriweather", "JetBrains Mono", "Space Mono", "Fira Code", "Caveat", "Pacifico", "Dancing Script", "Fredoka", "Quicksand", "Baloo 2"]);

let catalogue: FontEntry[] | null = null;
let cataloguePromise: Promise<FontEntry[]> | null = null;
const byFamily = new Map<string, FontEntry>();

export function loadCatalogue(): Promise<FontEntry[]> {
  if (catalogue) return Promise.resolve(catalogue);
  cataloguePromise ??= fetch("/fonts/catalogue.json")
    .then((r) => {
      if (!r.ok) throw new Error(`catalogue ${r.status}`);
      return r.json() as Promise<[string, string, string, number, number][]>;
    })
    .then((rows) => {
      catalogue = rows.map(([id, family, c, b, a]) => ({ id, family, category: CODES[c] ?? "display", bold: b === 1, accents: a === 1 }));
      for (const f of catalogue) byFamily.set(f.family, f);
      return catalogue;
    })
    .catch((err) => {
      cataloguePromise = null; // nouvel essai au prochain appel
      throw err;
    });
  return cataloguePromise;
}

const loading = new Map<string, Promise<void>>();

/** Vrai si la police est utilisable tout de suite sur le canevas. */
export function isFontReady(family: string): boolean {
  if (BUNDLED.has(family)) return true;
  const p = loading.get(family);
  return !!p && (p as Promise<void> & { done?: boolean }).done === true;
}

/** Charge la police (400 et, si elle existe, 700) depuis /fonts. Sans effet pour une police inconnue. */
export function ensureFont(family: string): Promise<void> {
  if (BUNDLED.has(family)) return document.fonts.load(`16px "${family}"`).then(() => undefined);
  let p = loading.get(family);
  if (p) return p;
  p = loadCatalogue().then(async () => {
    const entry = byFamily.get(family);
    if (!entry) return;
    const faces = [new FontFace(family, `url(/fonts/${entry.id}/400.woff2) format("woff2")`, { weight: "400", display: "swap" })];
    if (entry.bold) faces.push(new FontFace(family, `url(/fonts/${entry.id}/700.woff2) format("woff2")`, { weight: "700", display: "swap" }));
    await Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))));
  });
  const tracked = p.then(
    () => { (tracked as Promise<void> & { done?: boolean }).done = true; },
    (err) => { loading.delete(family); throw err; },
  );
  loading.set(family, tracked);
  return tracked;
}

// ── Aperçus du menu ─────────────────────────────────────────────────────
const previews = new Set<string>();
function loadPreview(entry: FontEntry): void {
  if (previews.has(entry.id)) return;
  previews.add(entry.id);
  const face = new FontFace(`nxp-${entry.id}`, `url(/fonts/${entry.id}/preview.woff2) format("woff2")`);
  face.load().then((f) => document.fonts.add(f)).catch(() => previews.delete(entry.id));
}
// Guillemets échappés : la valeur est placée dans un attribut style="…"
const previewFamily = (e: FontEntry) => (BUNDLED.has(e.family) ? `&quot;${esc(e.family)}&quot;` : `&quot;nxp-${e.id}&quot;`);

// ── Sélecteur ───────────────────────────────────────────────────────────
const RECENT_KEY = "spectra.fonts.recent";
function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x: unknown) => typeof x === "string").slice(0, 8); }
  catch { return []; }
}
function pushRecent(family: string): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([family, ...readRecent().filter((f) => f !== family)].slice(0, 8))); }
  catch { /* stockage indisponible : on s'en passe */ }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Bouton qui remplace l'ancien <select> ; le nom s'affiche dans sa propre police. */
export function fontPickerHtml(current: string): string {
  return `<button type="button" class="sp-font-btn" data-font-picker aria-haspopup="listbox" aria-expanded="false" title="${esc(current)}">
    <span class="sp-font-btn-name" style="font-family:&quot;${esc(current)}&quot;, system-ui">${esc(current)}</span><span class="sp-font-caret" aria-hidden="true">▾</span></button>`;
}

let openPanel: { close: () => void } | null = null;

export function bindFontPicker(host: HTMLElement, current: () => string, onPick: (family: string) => void): void {
  const btn = host.querySelector<HTMLButtonElement>("[data-font-picker]");
  if (!btn) return;
  ensureFont(current()).then(() => btn.querySelector<HTMLElement>(".sp-font-btn-name")?.style.setProperty("opacity", "1")).catch(() => {});
  btn.addEventListener("click", () => {
    if (openPanel) { openPanel.close(); return; }
    openPicker(btn, current(), onPick);
  });
}

function openPicker(anchor: HTMLButtonElement, current: string, onPick: (family: string) => void): void {
  const panel = document.createElement("div");
  panel.className = "sp-font-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Choisir une police");
  panel.innerHTML = `<input type="search" class="sp-font-search" placeholder="Rechercher une police…" aria-label="Rechercher une police" autocomplete="off" spellcheck="false">
    <div class="sp-font-cats" role="group" aria-label="Style">${[["", "Toutes"], ...Object.entries(CATEGORY_LABELS)]
      .map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="${k === "" ? "true" : "false"}">${l}</button>`).join("")}</div>
    <div class="sp-font-list" role="listbox" aria-label="Polices" tabindex="-1"><p class="sp-font-msg">Chargement des polices…</p></div>
    <p class="sp-font-count" aria-live="polite"></p>`;
  document.body.appendChild(panel);
  anchor.setAttribute("aria-expanded", "true");

  const place = () => {
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const down = below >= Math.min(320, above);
    panel.style.width = `${w}px`;
    panel.style.left = `${left}px`;
    panel.style.maxHeight = `${Math.max(200, Math.min(460, down ? below : above))}px`;
    if (down) { panel.style.top = `${r.bottom + 4}px`; panel.style.bottom = ""; }
    else { panel.style.bottom = `${window.innerHeight - r.top + 4}px`; panel.style.top = ""; }
  };
  place();

  const search = panel.querySelector<HTMLInputElement>(".sp-font-search")!;
  const list = panel.querySelector<HTMLElement>(".sp-font-list")!;
  const count = panel.querySelector<HTMLElement>(".sp-font-count")!;
  let category = "";
  let rows: HTMLElement[] = [];
  let active = -1;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      const entry = byFamily.get(el.dataset.family!);
      if (entry) loadPreview(entry);
      io.unobserve(el);
    }
  }, { root: list, rootMargin: "200px 0px" });

  const option = (f: FontEntry, idSuffix: string) =>
    `<div role="option" id="spf-${f.id}${idSuffix}" class="sp-font-opt" data-family="${esc(f.family)}" aria-selected="${f.family === current}">
      <span class="sp-font-preview" style="font-family:${previewFamily(f)}, system-ui">${esc(f.family)}</span>
      <span class="sp-font-label">${esc(f.family)} · ${CATEGORY_LABELS[f.category]}${f.accents ? "" : " · sans accents"}</span></div>`;

  const render = () => {
    if (!catalogue) return;
    const q = fold(search.value.trim());
    const match = catalogue.filter((f) => (!category || f.category === category) && (!q || fold(f.family).includes(q)));
    let html = "";
    const recent = !q && !category ? readRecent().map((n) => byFamily.get(n)).filter((f): f is FontEntry => !!f) : [];
    if (recent.length) html += `<p class="sp-font-head">Récentes</p>${recent.map((f) => option(f, "-r")).join("")}<p class="sp-font-head">Toutes les polices</p>`;
    html += match.map((f) => option(f, "")).join("") || `<p class="sp-font-msg">Aucune police ne correspond à « ${esc(search.value)} ».</p>`;
    list.innerHTML = html;
    rows = [...list.querySelectorAll<HTMLElement>("[role=option]")];
    rows.forEach((r) => io.observe(r));
    count.textContent = `${match.length} police${match.length > 1 ? "s" : ""}`;
    active = rows.findIndex((r) => r.dataset.family === current);
    if (active >= 0 && !q) { rows[active].classList.add("is-active"); rows[active].scrollIntoView({ block: "center" }); }
    else active = -1;
    search.setAttribute("aria-activedescendant", active >= 0 ? rows[active].id : "");
  };

  const setActive = (i: number) => {
    if (!rows.length) return;
    rows[active]?.classList.remove("is-active");
    active = Math.max(0, Math.min(rows.length - 1, i));
    rows[active].classList.add("is-active");
    rows[active].scrollIntoView({ block: "nearest" });
    search.setAttribute("aria-activedescendant", rows[active].id);
  };

  const pick = (family: string) => {
    pushRecent(family);
    close();
    onPick(family);
  };

  const onDocDown = (e: PointerEvent) => { if (!panel.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); anchor.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "PageDown") { e.preventDefault(); setActive(active + 10); }
    else if (e.key === "PageUp") { e.preventDefault(); setActive(active - 10); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(rows[active].dataset.family!); }
  };
  const onScroll = (e: Event) => { if (!panel.contains(e.target as Node)) place(); };

  function close() {
    io.disconnect();
    panel.remove();
    anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDocDown, true);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", onScroll, true);
    openPanel = null;
  }
  openPanel = { close };

  list.addEventListener("click", (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLElement>("[role=option]");
    if (opt) pick(opt.dataset.family!);
  });
  panel.querySelector(".sp-font-cats")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cat]");
    if (!b) return;
    category = b.dataset.cat!;
    panel.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  });
  let t = 0;
  search.addEventListener("input", () => { clearTimeout(t); t = window.setTimeout(render, 80); });
  panel.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onDocDown, true);
  window.addEventListener("resize", place);
  window.addEventListener("scroll", onScroll, true);
  search.focus();

  loadCatalogue().then(render).catch(() => {
    list.innerHTML = `<p class="sp-font-msg">La liste des polices n'a pas pu être chargée. Vérifiez votre connexion, puis rouvrez le menu.</p>`;
  });
}
