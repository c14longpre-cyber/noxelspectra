// Tests sans Shopify ni base de données : forfaits et traitements d'image (sharp).
// node --test --experimental-strip-types test/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { FORFAITS, debutDuMois, forfaitDuNom } from "../app/lib/forfaits.ts";
import { COTE_MAX, alleger, carre, formatDuMime, versFormat } from "../app/lib/image.server.ts";

test("forfait trouvé par son nom Shopify, Free par défaut", () => {
  assert.equal(forfaitDuNom("Pro").cle, "pro");
  assert.equal(forfaitDuNom(" starter ").imagesParMois, 500);
  assert.equal(forfaitDuNom(undefined).cle, "free");
  assert.equal(forfaitDuNom("Inconnu").cle, "free");
  assert.ok(FORFAITS.every((f, i) => i === 0 || f.imagesParMois > FORFAITS[i - 1].imagesParMois));
  assert.equal(debutDuMois(new Date("2026-11-30T23:59:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
});

test("format gardé : JPEG, PNG, WebP seulement", () => {
  assert.equal(formatDuMime("image/jpeg"), "jpeg");
  assert.equal(formatDuMime("image/png"), "png");
  assert.equal(formatDuMime("image/gif"), null);
});

const photo = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 60, b: 40 } } })
  .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#3ddc84"/></svg>`) }])
  .jpeg({ quality: 100 }).toBuffer();

test("carré : image entière centrée, fond blanc, côté plafonné", async () => {
  const sortie = await carre(await photo(3000, 1500), "jpeg");
  const m = await sharp(sortie).metadata();
  assert.equal(m.width, COTE_MAX); assert.equal(m.height, COTE_MAX); assert.equal(m.format, "jpeg");
  const coin = await sharp(sortie).extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer();
  assert.ok(coin.every((v) => v > 245), "coin blanc");
});

test("alléger : réduit à 2048 px, et rien si ce n'est pas plus léger", async () => {
  const lourde = await photo(4000, 3000);
  const sortie = await alleger(lourde, "jpeg");
  assert.ok(sortie && sortie.length < lourde.length);
  assert.equal((await sharp(sortie!).metadata()).width, COTE_MAX);
  const deja = await sharp(await photo(400, 300)).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
  assert.equal(await alleger(deja, "jpeg"), null);
});

test("PNG détouré remis en JPEG sur fond blanc", async () => {
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const jpg = await versFormat(png, "jpeg");
  const m = await sharp(jpg).metadata();
  assert.equal(m.format, "jpeg");
  const px = await sharp(jpg).raw().toBuffer();
  assert.ok(px[0] > 245 && px[1] > 245 && px[2] > 245);
});
