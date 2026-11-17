// Codes d'accès SPECTRA : logique commune (même fichier que NOXEL FORGE) et liste des admins
import { test } from "node:test";
import assert from "node:assert/strict";
import { joursAcces, tierEffectif, verifierCode, nouveauCode } from "../src/account/codesAcces";
import { estAdminSpectra } from "../src/account/codes.routes";

test("durée et fin d'offre", () => {
  assert.equal(joursAcces("1month"), 30);
  assert.equal(joursAcces("lifetime"), null);
  const t = new Date("2026-12-20T00:00:00Z");
  assert.equal(tierEffectif({ tier: "diamond", tier_expires_at: "2026-12-17T00:00:00Z", tier_after_expiry: "bronze" }, t), "bronze");
  assert.equal(tierEffectif({ tier: "diamond", tier_expires_at: "2027-01-17T00:00:00Z", tier_after_expiry: "bronze" }, t), "diamond");
});

test("un code SEO ou FORGE ne s'échange pas sur SPECTRA, un code ne baisse jamais un forfait", () => {
  const ok = { product: "spectra", tier: "diamond", is_used: false, expires_at: null };
  assert.equal(verifierCode(ok, "spectra", "bronze"), null);
  assert.equal(verifierCode({ ...ok, product: "forge" }, "spectra", "bronze"), "invalide");
  assert.equal(verifierCode(ok, "spectra", "diamond"), "deja_ce_forfait");
  assert.match(nouveauCode("NXS"), /^NXS-[0-9A-F]{6}-[0-9A-F]{6}$/);
});

test("admins : SPECTRA_ADMIN_EMAILS, sans tenir compte de la casse", () => {
  const env = { SPECTRA_ADMIN_EMAILS: " Admin@Exemple.com , autre@x.ca" };
  assert.equal(estAdminSpectra("admin@exemple.com", env), true);
  assert.equal(estAdminSpectra("intrus@x.ca", env), false);
  assert.equal(estAdminSpectra("admin@exemple.com", {}), false);
});
