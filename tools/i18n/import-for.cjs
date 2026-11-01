// Ligne d'import de tr selon l'emplacement du fichier
const path = require("path");
module.exports = (file) => {
  const abs = path.resolve(file);
  const root = path.resolve(__dirname, "../..");
  const video = abs.startsWith(path.join(root, "video"));
  const target = video ? path.join(root, "video/src/i18n") : path.join(root, "frontend/src/i18n");
  let rel = path.relative(path.dirname(abs), target).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `import { tr } from "${rel}";`;
};
