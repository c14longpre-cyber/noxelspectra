// NOXEL Spectra Vidéo — analyse d'une vidéo, entièrement dans le navigateur.
// Mediabunny lit seulement les en-têtes des paquets (pas les images) : même une
// grosse vidéo s'analyse vite, sans téléversement. Le débit est mesuré sur toute la durée.

export type VideoInfo = {
  container: string;
  mimeType: string;
  duration: number; // secondes
  size: number; // octets
  video: null | {
    codec: string;
    width: number;
    height: number;
    rotation: number;
    fps: number;
    bitrate: number; // bits/s
    hdr: boolean;
    decodable: boolean;
  };
  audio: null | {
    codec: string;
    channels: number;
    sampleRate: number;
    bitrate: number;
    decodable: boolean;
  };
  // Estimation : débit vidéo raisonnable pour cette résolution (H.264, web)
  recommendedBitrate: number;
  estimatedSize: number;
  potential: "fort" | "moyen" | "faible";
};

// Débits de référence pour une vidéo web de bonne qualité (H.264), selon la hauteur
export function referenceBitrate(width: number, height: number, fps: number): number {
  const lines = Math.min(width, height); // vertical ou horizontal : on prend le petit côté
  const base = lines >= 2160 ? 16e6 : lines >= 1440 ? 9e6 : lines >= 1080 ? 5e6 : lines >= 720 ? 2.8e6 : lines >= 480 ? 1.4e6 : 0.8e6;
  return fps > 40 ? base * 1.5 : base;
}

/** Un morceau de l'application n'a pas pu être téléchargé : seul un rechargement de la page le répare. */
export class LoadError extends Error {}

async function loadEngine() {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    return { ALL_FORMATS, BlobSource, Input };
  } catch {
    throw new LoadError("le moteur vidéo n'a pas pu être téléchargé. Vérifie ta connexion, puis recharge la page (il faudra choisir ta vidéo de nouveau).");
  }
}

export async function analyzeVideo(file: File): Promise<VideoInfo> {
  // Chargé à la demande : la page s'affiche sans attendre le moteur vidéo
  const { ALL_FORMATS, BlobSource, Input } = await loadEngine();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    // Fichier illisible : message en français plutôt que celui du moteur
    const format = await input.getFormat().catch(() => {
      throw new Error("ce fichier n'est pas une vidéo lisible, ou son format n'est pas pris en charge.");
    });
    const duration = await input.computeDuration();
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();

    let video: VideoInfo["video"] = null;
    if (vt) {
      const stats = await vt.computePacketStats();
      video = {
        codec: (await vt.getCodec()) || "inconnu",
        width: await vt.getDisplayWidth(),
        height: await vt.getDisplayHeight(),
        rotation: await vt.getRotation(),
        fps: Math.round(stats.averagePacketRate * 100) / 100,
        bitrate: stats.averageBitrate,
        hdr: await vt.hasHighDynamicRange(),
        decodable: await vt.canDecode(),
      };
    }
    let audio: VideoInfo["audio"] = null;
    if (at) {
      const stats = await at.computePacketStats();
      audio = {
        codec: (await at.getCodec()) || "inconnu",
        channels: await at.getNumberOfChannels(),
        sampleRate: await at.getSampleRate(),
        bitrate: stats.averageBitrate,
        decodable: await at.canDecode(),
      };
    }

    const rec = video ? referenceBitrate(video.width, video.height, video.fps) : 0;
    const audioRec = audio ? 128e3 : 0;
    const estimatedSize = Math.round(((rec + audioRec) * duration) / 8);
    const ratio = estimatedSize > 0 ? file.size / estimatedSize : 1;
    return {
      container: format.name,
      mimeType: await format.mimeType,
      duration,
      size: file.size,
      video,
      audio,
      recommendedBitrate: rec,
      estimatedSize: Math.min(estimatedSize, file.size),
      potential: ratio > 2 ? "fort" : ratio > 1.25 ? "moyen" : "faible",
    };
  } finally {
    input.dispose();
  }
}

// Ce que le navigateur sait encoder (déterminera les formats d'export proposés)
export async function encoderSupport(): Promise<{ webcodecs: boolean; h264: boolean; vp9: boolean; av1: boolean }> {
  const webcodecs = typeof window !== "undefined" && "VideoEncoder" in window;
  if (!webcodecs) return { webcodecs, h264: false, vp9: false, av1: false };
  const test = async (codec: string) => {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: 1280, height: 720, bitrate: 2e6, framerate: 30 });
      return !!r.supported;
    } catch {
      return false;
    }
  };
  const [h264, vp9, av1] = await Promise.all([test("avc1.42001f"), test("vp09.00.10.08"), test("av01.0.04M.08")]);
  return { webcodecs, h264, vp9, av1 };
}

// Unités décimales, comme les plateformes les comptent : 1 Mo = 1 000 000 octets
export const fmtBytes = (b: number) =>
  b < 1000 ? `${Math.round(b)} o` : b < 1e6 ? `${(b / 1e3).toFixed(1)} Ko` : b < 1e9 ? `${(b / 1e6).toFixed(1)} Mo` : `${(b / 1e9).toFixed(2)} Go`;
export const fmtBitrate = (bps: number) => (bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mb/s` : `${Math.round(bps / 1e3)} kb/s`);
export function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}
