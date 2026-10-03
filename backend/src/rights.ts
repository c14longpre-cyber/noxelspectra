// NOXEL Spectra — auteur, droits et licence (métadonnées XMP IPTC / PLUS)
//
// Les métadonnées DÉCLARENT des droits : elles ne bloquent pas la copie et ne
// prouvent pas la propriété à elles seules. Seuls les champs remplis sont écrits.
// Les données privées de l'original (GPS, appareil…) ne sont jamais recopiées.

export type RightsStatus = "copyrighted" | "public-domain" | "unknown";

export type Rights = {
  // Champs principaux
  creator?: string;
  copyrightOwner?: string;
  copyrightNotice?: string;
  credit?: string;
  usageTerms?: string;
  webStatement?: string;
  contactEmail?: string;
  contactUrl?: string;
  contactPhone?: string;
  licensorName?: string;
  licensorUrl?: string;
  status?: RightsStatus;
  // Options avancées
  licenseId?: string;
  licensee?: string;
  licenseStart?: string;
  licenseEnd?: string;
  regionConstraints?: string;
  mediaConstraints?: string;
  alterationConstraints?: string;
  otherConstraints?: string;
  modelReleaseStatus?: string;
  modelReleaseId?: string;
  propertyReleaseStatus?: string;
  propertyReleaseId?: string;
  termsText?: string;
  termsUrl?: string;
  dataMining?: string;
  // Origine de l'image
  title?: string;
  description?: string;
  dateCreated?: string;
  identifier?: string;
  sourceType?: string;
  aiSystem?: string;
  aiSystemVersion?: string;
  aiPromptWriter?: string;
  aiPrompt?: string;
};

const PLUS_VOCAB = "http://ns.useplus.org/ldf/vocab/";
const IPTC_SOURCE = "http://cv.iptc.org/newscodes/digitalsourcetype/";

export const SOURCE_TYPES = [
  "digitalCapture",
  "digitalCreation",
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "composite",
];
export const MODEL_RELEASE = ["MR-NON", "MR-NAP", "MR-UMR", "MR-LMR"];
export const PROPERTY_RELEASE = ["PR-NON", "PR-NAP", "PR-UPR", "PR-LPR"];
export const DATA_MINING = [
  "DMI-UNSPECIFIED",
  "DMI-ALLOWED",
  "DMI-PROHIBITED-AIMLTRAINING",
  "DMI-PROHIBITED-GENAIMLTRAINING",
  "DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING",
  "DMI-PROHIBITED",
];

// ── Validation ────────────────────────────────────────────────────────
const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : undefined;
};
const url = (v: unknown) => {
  const s = text(v, 500);
  return s && /^https?:\/\/[^\s<>"]+$/i.test(s) ? s : undefined;
};
const email = (v: unknown) => {
  const s = text(v, 200);
  return s && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) ? s : undefined;
};
const date = (v: unknown) => {
  const s = text(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};
const oneOf = (v: unknown, list: string[]) => (typeof v === "string" && list.includes(v) ? v : undefined);

export function parseRights(raw: unknown): Rights {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw);
    } catch {
      throw new Error("Données de droits invalides (JSON mal formé)");
    }
  } else if (raw && typeof raw === "object") {
    o = raw as Record<string, unknown>;
  }
  const r: Rights = {
    creator: text(o.creator, 200),
    copyrightOwner: text(o.copyrightOwner, 200),
    copyrightNotice: text(o.copyrightNotice, 300),
    credit: text(o.credit, 300),
    usageTerms: text(o.usageTerms, 2000),
    webStatement: url(o.webStatement),
    contactEmail: email(o.contactEmail),
    contactUrl: url(o.contactUrl),
    contactPhone: text(o.contactPhone, 50),
    licensorName: text(o.licensorName, 200),
    licensorUrl: url(o.licensorUrl),
    status: oneOf(o.status, ["copyrighted", "public-domain", "unknown"]) as RightsStatus | undefined,
    licenseId: text(o.licenseId, 200),
    licensee: text(o.licensee, 200),
    licenseStart: date(o.licenseStart),
    licenseEnd: date(o.licenseEnd),
    regionConstraints: text(o.regionConstraints, 500),
    mediaConstraints: text(o.mediaConstraints, 500),
    alterationConstraints: text(o.alterationConstraints, 500),
    otherConstraints: text(o.otherConstraints, 1000),
    modelReleaseStatus: oneOf(o.modelReleaseStatus, MODEL_RELEASE),
    modelReleaseId: text(o.modelReleaseId, 200),
    propertyReleaseStatus: oneOf(o.propertyReleaseStatus, PROPERTY_RELEASE),
    propertyReleaseId: text(o.propertyReleaseId, 200),
    termsText: text(o.termsText, 2000),
    termsUrl: url(o.termsUrl),
    dataMining: oneOf(o.dataMining, DATA_MINING),
    title: text(o.title, 300),
    description: text(o.description, 2000),
    dateCreated: date(o.dateCreated),
    identifier: text(o.identifier, 200),
    sourceType: oneOf(o.sourceType, SOURCE_TYPES),
    aiSystem: text(o.aiSystem, 200),
    aiSystemVersion: text(o.aiSystemVersion, 100),
    aiPromptWriter: text(o.aiPromptWriter, 200),
    aiPrompt: text(o.aiPrompt, 4000),
  };
  for (const k of Object.keys(r) as (keyof Rights)[]) if (r[k] === undefined) delete r[k];
  return r;
}

export function hasRights(r: Rights | undefined): boolean {
  return !!r && Object.keys(r).length > 0;
}

// ── Construction du paquet XMP ────────────────────────────────────────
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const alt = (tag: string, v: string) =>
  `<${tag}><rdf:Alt><rdf:li xml:lang="x-default">${esc(v)}</rdf:li></rdf:Alt></${tag}>`;
const seq = (tag: string, v: string) => `<${tag}><rdf:Seq><rdf:li>${esc(v)}</rdf:li></rdf:Seq></${tag}>`;
const bag = (tag: string, v: string) => `<${tag}><rdf:Bag><rdf:li>${esc(v)}</rdf:li></rdf:Bag></${tag}>`;
const simple = (tag: string, v: string) => `<${tag}>${esc(v)}</${tag}>`;
const resource = (tag: string, v: string) => `<${tag} rdf:resource="${esc(v)}"/>`;
const struct = (tag: string, fields: [string, string | undefined][], inSeq: boolean) => {
  const inner = fields.filter(([, v]) => v).map(([t, v]) => simple(t, v as string)).join("");
  if (!inner) return "";
  return inSeq
    ? `<${tag}><rdf:Seq><rdf:li rdf:parseType="Resource">${inner}</rdf:li></rdf:Seq></${tag}>`
    : `<${tag} rdf:parseType="Resource">${inner}</${tag}>`;
};

export function buildXmp(r: Rights): string {
  const p: string[] = [];
  // Principaux
  if (r.creator) p.push(seq("dc:creator", r.creator));
  if (r.copyrightNotice) p.push(alt("dc:rights", r.copyrightNotice));
  if (r.title) p.push(alt("dc:title", r.title));
  if (r.description) p.push(alt("dc:description", r.description));
  if (r.identifier) p.push(simple("dc:identifier", r.identifier));
  if (r.credit) p.push(simple("photoshop:Credit", r.credit));
  if (r.dateCreated) p.push(simple("photoshop:DateCreated", r.dateCreated));
  if (r.usageTerms) p.push(alt("xmpRights:UsageTerms", r.usageTerms));
  if (r.webStatement) p.push(simple("xmpRights:WebStatement", r.webStatement));
  if (r.status === "copyrighted") p.push(simple("xmpRights:Marked", "True"));
  if (r.status === "public-domain") p.push(simple("xmpRights:Marked", "False"));
  p.push(
    struct(
      "Iptc4xmpCore:CreatorContactInfo",
      [
        ["Iptc4xmpCore:CiEmailWork", r.contactEmail],
        ["Iptc4xmpCore:CiUrlWork", r.contactUrl],
        ["Iptc4xmpCore:CiTelWork", r.contactPhone],
      ],
      false
    )
  );
  p.push(struct("plus:CopyrightOwner", [["plus:CopyrightOwnerName", r.copyrightOwner]], true));
  p.push(
    struct(
      "plus:Licensor",
      [
        ["plus:LicensorName", r.licensorName],
        ["plus:LicensorURL", r.licensorUrl],
      ],
      true
    )
  );
  // Avancés
  if (r.licenseId) p.push(simple("plus:LicenseID", r.licenseId));
  p.push(struct("plus:Licensee", [["plus:LicenseeName", r.licensee]], true));
  if (r.licenseStart) p.push(simple("plus:LicenseStartDate", r.licenseStart));
  if (r.licenseEnd) p.push(simple("plus:LicenseEndDate", r.licenseEnd));
  if (r.regionConstraints) p.push(alt("plus:RegionConstraints", r.regionConstraints));
  if (r.mediaConstraints) p.push(alt("plus:MediaConstraints", r.mediaConstraints));
  // Les restrictions de modification sont écrites en texte dans OtherConstraints :
  // le vocabulaire PLUS dédié est codifié et on ne veut pas l'encoder approximativement.
  const other = [r.alterationConstraints ? `Modifications : ${r.alterationConstraints}` : "", r.otherConstraints || ""]
    .filter(Boolean)
    .join(" — ");
  if (other) p.push(alt("plus:OtherConstraints", other));
  if (r.modelReleaseStatus) p.push(resource("plus:ModelReleaseStatus", PLUS_VOCAB + r.modelReleaseStatus));
  if (r.modelReleaseId) p.push(bag("plus:ModelReleaseID", r.modelReleaseId));
  if (r.propertyReleaseStatus) p.push(resource("plus:PropertyReleaseStatus", PLUS_VOCAB + r.propertyReleaseStatus));
  if (r.propertyReleaseId) p.push(bag("plus:PropertyReleaseID", r.propertyReleaseId));
  if (r.termsText) p.push(alt("plus:TermsAndConditionsText", r.termsText));
  if (r.termsUrl) p.push(simple("plus:TermsAndConditionsURL", r.termsUrl));
  if (r.dataMining) p.push(resource("plus:DataMining", PLUS_VOCAB + r.dataMining));
  // Origine / IA
  if (r.sourceType) p.push(resource("Iptc4xmpExt:DigitalSourceType", IPTC_SOURCE + r.sourceType));
  if (r.aiSystem) p.push(simple("Iptc4xmpExt:AISystemUsed", r.aiSystem));
  if (r.aiSystemVersion) p.push(simple("Iptc4xmpExt:AISystemVersionUsed", r.aiSystemVersion));
  if (r.aiPromptWriter) p.push(simple("Iptc4xmpExt:AIPromptWriterName", r.aiPromptWriter));
  if (r.aiPrompt) p.push(simple("Iptc4xmpExt:AIPromptInformation", r.aiPrompt));

  return (
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about=""' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"' +
    ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
    ' xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"' +
    ' xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"' +
    ' xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">' +
    p.filter(Boolean).join("") +
    "</rdf:Description></rdf:RDF></x:xmpmeta>" +
    '<?xpacket end="w"?>'
  );
}

// ── Relecture (préremplissage + vérification de l'export) ─────────────
const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function readTag(xmp: string, tag: string): string | undefined {
  const t = tag.replace(":", "\\:");
  // Forme attribut : tag="valeur" ou rdf:resource
  const res = new RegExp(`<${t}\\s+rdf:resource="([^"]*)"`).exec(xmp);
  if (res) return unesc(res[1]);
  const el = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`).exec(xmp);
  if (el) {
    const li = /<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/.exec(el[1]);
    const v = (li ? li[1] : el[1]).replace(/<[^>]+>/g, "").trim();
    return v ? unesc(v) : undefined;
  }
  const attr = new RegExp(`\\s${t}="([^"]*)"`).exec(xmp);
  return attr ? unesc(attr[1]) : undefined;
}

const READ_MAP: [keyof Rights, string][] = [
  ["creator", "dc:creator"],
  ["copyrightNotice", "dc:rights"],
  ["title", "dc:title"],
  ["description", "dc:description"],
  ["identifier", "dc:identifier"],
  ["credit", "photoshop:Credit"],
  ["dateCreated", "photoshop:DateCreated"],
  ["usageTerms", "xmpRights:UsageTerms"],
  ["webStatement", "xmpRights:WebStatement"],
  ["contactEmail", "Iptc4xmpCore:CiEmailWork"],
  ["contactUrl", "Iptc4xmpCore:CiUrlWork"],
  ["contactPhone", "Iptc4xmpCore:CiTelWork"],
  ["copyrightOwner", "plus:CopyrightOwnerName"],
  ["licensorName", "plus:LicensorName"],
  ["licensorUrl", "plus:LicensorURL"],
  ["licenseId", "plus:LicenseID"],
  ["licensee", "plus:LicenseeName"],
  ["licenseStart", "plus:LicenseStartDate"],
  ["licenseEnd", "plus:LicenseEndDate"],
  ["regionConstraints", "plus:RegionConstraints"],
  ["mediaConstraints", "plus:MediaConstraints"],
  ["otherConstraints", "plus:OtherConstraints"],
  ["modelReleaseStatus", "plus:ModelReleaseStatus"],
  ["modelReleaseId", "plus:ModelReleaseID"],
  ["propertyReleaseStatus", "plus:PropertyReleaseStatus"],
  ["propertyReleaseId", "plus:PropertyReleaseID"],
  ["termsText", "plus:TermsAndConditionsText"],
  ["termsUrl", "plus:TermsAndConditionsURL"],
  ["dataMining", "plus:DataMining"],
  ["sourceType", "Iptc4xmpExt:DigitalSourceType"],
  ["aiSystem", "Iptc4xmpExt:AISystemUsed"],
  ["aiSystemVersion", "Iptc4xmpExt:AISystemVersionUsed"],
  ["aiPromptWriter", "Iptc4xmpExt:AIPromptWriterName"],
  ["aiPrompt", "Iptc4xmpExt:AIPromptInformation"],
];

export function readRights(xmp: string | undefined): Rights {
  const r: Record<string, string> = {};
  if (!xmp) return r;
  for (const [key, tag] of READ_MAP) {
    let v = readTag(xmp, tag);
    if (!v) continue;
    // URI de vocabulaire → code court (MR-NON, digitalCapture…)
    if (v.startsWith(PLUS_VOCAB)) v = v.slice(PLUS_VOCAB.length);
    if (v.startsWith(IPTC_SOURCE)) v = v.slice(IPTC_SOURCE.length);
    r[key] = v;
  }
  const marked = readTag(xmp, "xmpRights:Marked");
  if (marked) r.status = /^true$/i.test(marked) ? "copyrighted" : "public-domain";
  if (r.otherConstraints?.startsWith("Modifications : ")) {
    const [mods, ...rest] = r.otherConstraints.slice("Modifications : ".length).split(" — ");
    r.alterationConstraints = mods;
    if (rest.length) r.otherConstraints = rest.join(" — ");
    else delete r.otherConstraints;
  }
  return r as Rights;
}

// Champs demandés absents du fichier relu (vérification après export)
export function missingAfterExport(asked: Rights, readBack: Rights): (keyof Rights)[] {
  return (Object.keys(asked) as (keyof Rights)[]).filter((k) => {
    if (k === "status" && asked.status === "unknown") return false;
    return !readBack[k];
  });
}

// ── Écriture dans un pipeline Sharp ───────────────────────────────────
// withXmp() existe depuis Sharp 0.34.3 : on vérifie sa présence plutôt que de
// supposer la version installée. L'EXIF (Artist / Copyright) sert de secours
// pour les logiciels qui ne lisent pas le XMP. Rien de l'original n'est recopié.
type MetaCapable<T> = {
  withXmp?: (xmp: string) => T;
  withExif?: (exif: Record<string, Record<string, string>>) => T;
};

export function applyRights<T>(pipeline: T, r: Rights): { pipeline: T; xmp: boolean } {
  let out = pipeline;
  let xmp = false;
  const m = out as unknown as MetaCapable<T>;
  if (typeof m.withXmp === "function") {
    out = m.withXmp.call(out, buildXmp(r));
    xmp = true;
  }
  const ifd0: Record<string, string> = {};
  if (r.creator) ifd0.Artist = r.creator;
  if (r.copyrightNotice) ifd0.Copyright = r.copyrightNotice;
  const m2 = out as unknown as MetaCapable<T>;
  if (Object.keys(ifd0).length && typeof m2.withExif === "function") {
    out = m2.withExif.call(out, { IFD0: ifd0 });
  }
  return { pipeline: out, xmp };
}
