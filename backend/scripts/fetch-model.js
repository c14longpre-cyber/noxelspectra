// Télécharge le modèle de suppression d'arrière-plan choisi par BG_MODEL
// (isnet par défaut, ou birefnet) s'il est absent.
// Lancé automatiquement par « npm run build » (donc au build sur Railway).
// Les modèles ne sont pas dans le repo : GitHub refuse les fichiers de plus de 100 Mo.
const fs = require("fs");
const path = require("path");

const BASE = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/";
const MODELS = {
  isnet: { file: "isnet-general-use.onnx", minMb: 150 },
  birefnet: { file: "BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx", minMb: 200 },
};

const name = MODELS[process.env.BG_MODEL] ? process.env.BG_MODEL : "isnet";
const { file, minMb } = MODELS[name];
const DEST = path.join(__dirname, "..", "models", file);
const MIN_BYTES = minMb * 1024 * 1024; // plus petit = téléchargement incomplet

(async () => {
  if (fs.existsSync(DEST) && fs.statSync(DEST).size > MIN_BYTES) {
    console.log(`Modèle ${name} déjà présent :`, DEST);
    return;
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  console.log(`Téléchargement du modèle ${name} (${file})...`);
  const res = await fetch(BASE + file, { redirect: "follow" });
  if (!res.ok) throw new Error(`Téléchargement impossible : HTTP ${res.status}`);
  const tmp = DEST + ".part";
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  if (fs.statSync(tmp).size < MIN_BYTES) {
    fs.unlinkSync(tmp);
    throw new Error(`Téléchargement incomplet du modèle ${name}`);
  }
  fs.renameSync(tmp, DEST);
  console.log(`Modèle ${name} prêt :`, DEST);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
