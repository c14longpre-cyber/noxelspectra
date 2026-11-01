// Codemod : entoure de t("…") les textes français visibles des composants React.
// node tools/i18n/wrap.cjs <ts-path> [--write] fichiers…   (rapport JSON sur stdout)
const ts = require(process.argv[2]);
const fs = require("fs");
const write = process.argv.includes("--write");
const files = process.argv.slice(3).filter((f) => !f.startsWith("--"));

const ATTRS = new Set(["label", "placeholder", "title", "alt", "aria-label", "busyLabel", "ariaLabel", "description", "aria-valuetext", "caption"]);
const SKIP_ATTRS = new Set(["className", "style", "type", "href", "src", "key", "id", "role", "value", "name", "accept", "download", "rel", "target", "action", "inputMode", "autoComplete", "lang", "htmlFor", "d", "fill", "stroke", "viewBox", "mode", "variant", "tone", "icon", "data-noxel-consent-settings", "pattern", "step", "min", "max", "colorScheme", "translate", "dir", "loading", "decoding", "referrerPolicy", "sandbox", "crossOrigin", "form", "method", "encType", "list", "shape", "position"]);
const SKIP_CALLS = /^(fetch|apiFetch|append|set|get|has|delete|setItem|getItem|removeItem|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|createElement|setAttribute|getAttribute|startsWith|endsWith|includes|indexOf|split|replace|replaceAll|match|test|toFixed|toLocaleString|toBlob|toDataURL|getContext|require|import|log|warn|error|info|debug|t|tr|load|check|matches|closest|dispatchEvent|CustomEvent|localeCompare|padStart|join|font|fillText|measureText|setProperty|getPropertyValue|Blob|File|URL|RegExp|Date|Intl|Number|parseInt|parseFloat|JSON|structuredClone|postMessage|open|assign|go|navigate|track|register)$/;

const hasWord = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s);
function looksLikeText(s) {
  const v = s.trim();
  if (!hasWord(v)) return false;
  if (/^(https?:|mailto:|\/|\.\/|#|data:|blob:)/.test(v)) return false;
  if (/^[a-z0-9_.\-\/]+$/.test(v)) return false;              // identifiants, chemins, formats
  if (/^[A-Z0-9_]+$/.test(v)) return false;                   // CONSTANTES
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(v)) return false;      // camelCase
  if (/[;{}]|^\d|px$|rgba?\(|#[0-9a-f]{3,8}\b/i.test(v) && !/\s[a-zà-ÿ]{3,}\s/i.test(v)) return false; // CSS
  if (/^(image|video|audio|application|text|font)\/[\w.+-]+/.test(v)) return false;   // types MIME
  if (/^-?\d|\b\d+(px|%|em|rem|vh|vw|s|ms)\b|^(translate|rotate|scale|rgba?|hsla?|linear-gradient|radial-gradient|conic-gradient|calc|var|url|cubic-bezier|drop-shadow|blur|inset)\(|\b(solid|dashed|dotted|none|auto|inherit|transparent|bold|italic|ease|infinite|sans-serif|monospace)\b/.test(v) && !/[À-ÿ]/.test(v) && !/\b(le|la|les|un|une|des|de|du|ton|ta|tes|pour|avec)\b/.test(v)) return false; // CSS
  if (/^(Arial|Inter|Helvetica|Georgia|Roboto|Segoe|system-ui)/.test(v)) return false;
  return /\s/.test(v) || /[À-ÿ]/.test(v) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(v);
}

const report = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const insideFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
  const q = (s) => JSON.stringify(s);

  function visit(n) {
    if (ts.isJsxText(n)) {
      const raw = n.getText(sf);
      const core = raw.replace(/\s+/g, " ").trim();
      if (core && hasWord(core) && !/^[\W\d]*(px|ko|mo|go|%|x|×)?[\W\d]*$/i.test(core)) {
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        const keepLead = /\n/.test(lead) ? lead : (lead ? "{\" \"}" : "");
        const keepTrail = /\n/.test(trail) ? trail : (trail ? "{\" \"}" : "");
        edits.push({ s: n.getStart(sf, false), e: n.end, r: keepLead + `{tr(${q(core)})}` + keepTrail, text: core, kind: "jsx" });
      }
      return;
    }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const name = n.name.getText(sf);
      if (ATTRS.has(name) && looksLikeText(n.initializer.text)) {
        edits.push({ s: n.initializer.getStart(sf), e: n.initializer.end, r: `{tr(${q(n.initializer.text)})}`, text: n.initializer.text, kind: "attr:" + name });
      }
      return;
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && insideFunction(n)) {
      const p = n.parent;
      const skip =
        ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) ||
        (ts.isPropertyAssignment(p) && p.name === n) || ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p) ||
        ts.isCaseClause(p) || ts.isLiteralTypeNode(p) || ts.isJsxAttribute(p) ||
        (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) ||
        ((ts.isCallExpression(p) || ts.isNewExpression(p)) && (() => {
          const ex = p.expression; const nm = ts.isPropertyAccessExpression(ex) ? ex.name.getText(sf) : ex.getText(sf);
          return SKIP_CALLS.test(nm) && !/^set[A-Z]/.test(nm);
        })());
      if (!skip && looksLikeText(n.text)) {
        // attribut JSX skippé plus haut ; ici chaînes dans le code (messages d'erreur, libellés calculés)
        edits.push({ s: n.getStart(sf), e: n.end, r: `tr(${q(n.text)})`, text: n.text, kind: "code" });
      }
      return;
    }
    if (ts.isTemplateExpression(n) && insideFunction(n)) {
      const txt = n.getText(sf);
      if (/[À-ÿ]|\b(le|la|les|des|du|de|une?|est|sont|pour|avec|sans|ton|ta|tes)\b/i.test(txt.replace(/\$\{[^}]*\}/g, "")))
        report.push({ file, kind: "template", text: txt.slice(0, 140), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  for (const e of edits) report.push({ file, kind: e.kind, text: e.text, line: sf.getLineAndCharacterOfPosition(e.s).line + 1 });
  if (write && edits.length) {
    let out = src;
    for (const e of edits.sort((a, b) => b.s - a.s)) out = out.slice(0, e.s) + e.r + out.slice(e.e);
    const imp = process.env.I18N_IMPORT_FOR ? require(process.env.I18N_IMPORT_FOR)(file) : null;
    if (imp && !out.includes(imp)) {
      const m = [...out.matchAll(/^import [^;]+;\s*$/gm)].pop();
      out = m ? out.slice(0, m.index + m[0].length) + "\n" + imp + out.slice(m.index + m[0].length) : imp + "\n" + out;
    }
    fs.writeFileSync(file, out);
  }
}
console.log(JSON.stringify(report, null, 0));
