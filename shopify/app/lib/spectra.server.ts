// Appel à l'API NOXEL SPECTRA (api.noxelspectra.com) pour le détourage, avec le jeton de service partagé
// (SPECTRA_SERVICE_TOKEN, même valeur dans Railway pour l'API SPECTRA) : l'app Shopify applique ses propres quotas.
const API = process.env.SPECTRA_API_URL || "https://api.noxelspectra.com";

export async function detourer(image: Buffer, nom: string, fond = "#ffffff"): Promise<Buffer> {
  const jeton = process.env.SPECTRA_SERVICE_TOKEN || "";
  if (!jeton) throw new Error("SPECTRA_SERVICE_TOKEN manquant");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(image)]), nom);
  form.append("background", fond);
  form.append("format", "png");
  const r = await fetch(`${API}/api/remove-background`, { method: "POST", body: form, headers: { "x-spectra-service": jeton }, signal: AbortSignal.timeout(120_000) });
  if (r.status === 503) throw new Error("busy");
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || `SPECTRA ${r.status}`);
  }
  return Buffer.from(await r.arrayBuffer());
}
