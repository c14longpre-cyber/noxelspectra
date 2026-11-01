// Liste des textes à traduire : arguments de tr("…") + textes des données hors composants
const ts = require(process.argv[2]); const fs = require("fs");
const keys = new Map();
for (const file of process.argv.slice(3)) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const inFn = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
  (function v(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === "tr" && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) {
      keys.set(n.arguments[0].text, keys.get(n.arguments[0].text) || file);
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !inFn(n) && !ts.isImportDeclaration(n.parent) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) {
      const prop = ts.isPropertyAssignment(n.parent) ? n.parent.name.getText(sf).replace(/^["']|["']$/g, "") : "";
      const t = n.text;
      if (/[A-Za-zÀ-ÿ]{2,}/.test(t) && /^(label|busyLabel|desc|description|note|hint|title|group|summary|name|short|long|help|text|placeholder|use|usage|caption|fr)$/.test(prop) && (/\s|[À-ÿ]/.test(t) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t)) && !/[<>{};]|https?:/.test(t))
        keys.set(t, keys.get(t) || file);
    }
    ts.forEachChild(n, v);
  })(sf);
}
const out = {}; for (const [k, f] of keys) out[k] = f.replace(/.*noxelspectra\//, "");
console.log(JSON.stringify(out, null, 1));
