// NOXEL Spectra — sauvegarde de projets dans le navigateur (IndexedDB)
//
// Les projets restent dans le navigateur de l'utilisateur : rien n'est
// envoyé sur nos serveurs. Un projet peut être exporté en fichier
// .spectra (un zip : project.json + une image par étape) pour le garder
// ou l'ouvrir sur un autre ordinateur.

export type StoredEntry = {
  file: File;
  label: string;
  lossy: boolean;
  part?: unknown;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  historyIndex: number;
  entries: StoredEntry[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  stepCount: number;
  totalBytes: number;
  thumb: File;
};

const DB_NAME = "noxel-spectra";
const DB_VERSION = 1;
const STORE = "projects";
const LAST_PROJECT_KEY = "noxel-spectra-last-project";
const FILE_FORMAT = "noxel-spectra-project";

// Forme réellement écrite dans IndexedDB : l'image brute + son nom et son
// type à part. Certains navigateurs (et anciennes versions de Safari)
// perdent le nom d'un File stocké tel quel — on le reconstruit à la lecture.
type DbEntry = { data: Blob; fileName: string; type: string; label: string; lossy: boolean; part?: unknown };
type DbProject = Omit<Project, "entries"> & { entries: DbEntry[] };

function toDb(p: Project): DbProject {
  return {
    ...p,
    entries: p.entries.map((e) => ({
      data: e.file,
      fileName: e.file.name,
      type: e.file.type,
      label: e.label,
      lossy: e.lossy,
      part: e.part,
    })),
  };
}

function fromDb(p: DbProject): Project {
  return {
    ...p,
    entries: p.entries.map((e) => ({
      file: new File([e.data], e.fileName || "image", { type: e.type || e.data.type }),
      label: e.label,
      lossy: e.lossy,
      part: e.part,
    })),
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    let result: T;
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || req.error);
  });
}

export function newProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveProject(p: Project): Promise<void> {
  await run("readwrite", (s) => s.put(toDb(p)));
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const raw = await run<DbProject | undefined>("readonly", (s) => s.get(id) as IDBRequest<DbProject | undefined>);
  return raw ? fromDb(raw) : undefined;
}

export async function deleteProject(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const raw = await run<DbProject[]>("readonly", (s) => s.getAll() as IDBRequest<DbProject[]>);
  return raw
    .map(fromDb)
    .filter((p) => p.entries && p.entries.length > 0)
    .map((p) => {
      const idx = Math.min(Math.max(p.historyIndex, 0), p.entries.length - 1);
      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        stepCount: p.entries.length,
        totalBytes: p.entries.reduce((sum, e) => sum + (e.file?.size || 0), 0),
        thumb: p.entries[idx].file,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
}

// ── Dernier projet ouvert (pour le restaurer après un rechargement) ──
export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    // stockage désactivé : la restauration automatique ne fonctionnera pas
  }
}

// ── Espace de stockage ────────────────────────────────────────────────
export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { used: usage || 0, quota: quota || 0 };
  } catch {
    return null;
  }
}

// Demande au navigateur de ne pas effacer nos données quand l'espace manque
export function requestPersistence(): void {
  try {
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // non supporté : sans conséquence
  }
}

// ── Fichier .spectra ──────────────────────────────────────────────────
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "projet";
}

export function projectFileName(name: string): string {
  return `${safeName(name)}.spectra`;
}

export async function exportProject(p: Project): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const entries = p.entries.map((e, i) => {
    const path = `etapes/${String(i).padStart(2, "0")}-${safeName(e.file.name)}`;
    zip.file(path, e.file);
    return { label: e.label, lossy: e.lossy, part: e.part ?? null, fileName: e.file.name, type: e.file.type, path };
  });
  zip.file(
    "project.json",
    JSON.stringify(
      { format: FILE_FORMAT, version: 1, name: p.name, createdAt: p.createdAt, historyIndex: p.historyIndex, entries },
      null,
      2
    )
  );
  // Images déjà compressées : STORE évite de les recompresser pour rien
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export async function importProject(source: File): Promise<Project> {
  const JSZip = (await import("jszip")).default;
  let zip;
  try {
    zip = await JSZip.loadAsync(source);
  } catch {
    throw new Error("Ce fichier n'est pas un projet NOXEL Spectra valide.");
  }
  const manifestFile = zip.file("project.json");
  if (!manifestFile) throw new Error("Projet invalide : project.json introuvable.");

  let manifest: any;
  try {
    manifest = JSON.parse(await manifestFile.async("string"));
  } catch {
    throw new Error("Projet invalide : project.json illisible.");
  }
  if (manifest?.format !== FILE_FORMAT || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new Error("Ce fichier n'est pas un projet NOXEL Spectra valide.");
  }

  const entries: StoredEntry[] = [];
  for (const e of manifest.entries) {
    const f = zip.file(String(e.path));
    if (!f) throw new Error(`Projet incomplet : image manquante (${e.path}).`);
    const blob = await f.async("blob");
    entries.push({
      file: new File([blob], String(e.fileName || "image"), { type: String(e.type || blob.type) }),
      label: String(e.label || "Étape"),
      lossy: e.lossy === true,
      part: e.part ?? undefined,
    });
  }

  const now = Date.now();
  return {
    id: newProjectId(),
    name: String(manifest.name || source.name.replace(/\.spectra$/i, "")).slice(0, 80),
    createdAt: Number(manifest.createdAt) || now,
    updatedAt: now,
    historyIndex: Math.min(Math.max(Number(manifest.historyIndex) || 0, 0), entries.length - 1),
    entries,
  };
}
