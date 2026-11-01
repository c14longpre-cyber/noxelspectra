// Codemod 3 : {x.label} → {tr(x.label)} pour les données définies hors des composants (traduites à l'affichage)
const ts = require(process.argv[2]);
const fs = require("fs");
const PROPS = /^(label|desc|description|note|hint|title|group|summary|caption|short|long|help|blurb|labelLong|tagline|use|usage)$/;
let total = 0;
for (const file of process.argv.slice(3)) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  (function visit(n) {
    if (ts.isJsxExpression(n) && n.expression && ts.isPropertyAccessExpression(n.expression) && PROPS.test(n.expression.name.text)) {
      const ex = n.expression;
      edits.push({ s: ex.getStart(sf), e: ex.end, r: `tr(${ex.getText(sf)})` });
    }
    // label={x.label} / title={x.desc} : mêmes données passées en attribut
    if (ts.isJsxAttribute(n) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isPropertyAccessExpression(n.initializer.expression)
        && ["label", "title", "aria-label", "placeholder", "alt"].includes(n.name.getText(sf)) && PROPS.test(n.initializer.expression.name.text)) {
      const ex = n.initializer.expression;
      edits.push({ s: ex.getStart(sf), e: ex.end, r: `tr(${ex.getText(sf)})` });
      return;
    }
    ts.forEachChild(n, visit);
  })(sf);
  if (edits.length) {
    let out = src;
    for (const e of edits.sort((a, b) => b.s - a.s)) out = out.slice(0, e.s) + e.r + out.slice(e.e);
    const imp = require(process.env.I18N_IMPORT_FOR)(file);
    if (!/import \{ tr \}/.test(out)) { const m = [...out.matchAll(/^import [^;]+;\s*$/gm)].pop(); out = out.slice(0, m.index + m[0].length) + "\n" + imp + out.slice(m.index + m[0].length); }
    fs.writeFileSync(file, out); total += edits.length;
    console.log(edits.length, file.replace(/.*noxelspectra\//, ""));
  }
}
console.log("props", total);
