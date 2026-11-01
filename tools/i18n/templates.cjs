// Codemod 2 : `Projet « ${p.name} » restauré.` → tr("Projet « {a} » restauré.", { a: p.name })
const ts = require(process.argv[2]);
const fs = require("fs");
const files = process.argv.slice(3);
const NOMS = "abcdefgh";
const fr = /[À-ÿ]|\b(le|la|les|des|du|de|une?|est|sont|pour|avec|sans|ton|ta|tes|sur|dont|en|par|à|Projet|Recette|Couleur|Retirer|Emplacement|Opacité|Dessiner|Acheter|Paquet|Taille|Largeur|Créer|Tout|Utiliser|Étape|Préparation|Aperçu|Cadrage|Dégradé|Appliquer|Découpe|Estimation|Résultat|Traitement|Réduction|Augmentation|Supprimer|Redimensionner|qualité|maximum|images?|champs?|éléments?|autres|reste|crédits?)\b/i;
let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const inFn = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
  (function visit(n) {
    if (ts.isTemplateExpression(n) && inFn(n)) {
      const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)];
      const statique = parts.join(" ");
      const p = n.parent;
      const tagged = ts.isTaggedTemplateExpression(p);
      const isKey = ts.isJsxAttribute(p?.parent) && ["key", "className", "href", "src", "download", "id"].includes(p.parent.name.getText(sf));
      if (!tagged && !isKey && /[A-Za-zÀ-ÿ]{2,}/.test(statique) && fr.test(statique) && n.templateSpans.length <= NOMS.length) {
        let key = n.head.text; const vars = [];
        n.templateSpans.forEach((s, i) => { key += `{${NOMS[i]}}` + s.literal.text; vars.push(`${NOMS[i]}: ${s.expression.getText(sf)}`); });
        edits.push({ s: n.getStart(sf), e: n.end, r: `tr(${JSON.stringify(key)}, { ${vars.join(", ")} })` });
        return; // pas de remplacement imbriqué
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
  if (edits.length) {
    let out = src;
    for (const e of edits.sort((a, b) => b.s - a.s)) out = out.slice(0, e.s) + e.r + out.slice(e.e);
    fs.writeFileSync(file, out); total += edits.length;
    if (!/import \{ tr \}/.test(out)) console.error("IMPORT MANQUANT", file);
  }
}
console.log("templates", total);
