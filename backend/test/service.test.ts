// Jeton de service de l'app Shopify : accepté seulement s'il est long et identique au caractère près.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { estServiceSpectra } from "../src/account/middleware";

const req = (v?: string) => ({ get: (h: string) => (h.toLowerCase() === "x-spectra-service" ? v : undefined) }) as unknown as Request;

test("jeton de service SPECTRA", () => {
  const jeton = "a".repeat(40);
  process.env.SPECTRA_SERVICE_TOKEN = jeton;
  assert.equal(estServiceSpectra(req(jeton)), true);
  assert.equal(estServiceSpectra(req(jeton.slice(1) + "b")), false);
  assert.equal(estServiceSpectra(req("court")), false);
  assert.equal(estServiceSpectra(req(undefined)), false);
  process.env.SPECTRA_SERVICE_TOKEN = "trop-court";
  assert.equal(estServiceSpectra(req("trop-court")), false);  // jeton serveur trop court : toujours refusé
  delete process.env.SPECTRA_SERVICE_TOKEN;
  assert.equal(estServiceSpectra(req("")), false);
});
