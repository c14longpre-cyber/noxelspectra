// NOXEL Spectra Vidéo — panneaux Convertir, Pivoter & retourner, Vitesse
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { CONTAINERS, canRemux, convertVideo, rotateVideo, speedVideo } from "../lib/transform";
import type { ContainerId, Result, RotateOptions } from "../lib/transform";
import { fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Common = { file: File; info: VideoInfo; range: [number, number]; onContinue: (blob: Blob, ext: string, suffix: string) => void };

/** Exécution + progression + résultat, partagés par les trois outils. */
function useJob() {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(Result & { url: string }) | null>(null);
  const cancel = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  async function start(job: (onP: (p: number) => void, reg: (c: () => Promise<void>) => void) => Promise<Result>) {
    setError(null);
    setProgress(0);
    try {
      const r = await job(setProgress, (c) => (cancel.current = c));
      setResult({ ...r, url: URL.createObjectURL(r.blob) });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? e.message : "Traitement impossible.");
    } finally {
      setProgress(null);
      cancel.current = null;
    }
  }
  return { progress, error, result, start, cancel };
}

function JobFooter({ job, button, file, suffix, note, onContinue }: {
  job: ReturnType<typeof useJob>; button: ReactNode; file: File; suffix: string; note?: string;
  onContinue: Common["onContinue"];
}) {
  const base = file.name.replace(/\.[^.]+$/, "");
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {button}
        {job.progress !== null && <button type="button" className="vx-btn" onClick={() => job.cancel.current?.()}>Annuler</button>}
      </div>
      {job.error && <p className="vx-alert">Traitement impossible : {job.error}</p>}
      {job.result && (
        <div className="vx-result">
          <span>✓ {fmtBytes(job.result.blob.size)} · {job.result.ext.toUpperCase()}{job.result.remuxed ? " · sans réencodage (aucune perte)" : ""}{note ? ` · ${note}` : ""}</span>
          <HudLink action="download-result" compact href={job.result.url} download={`${base}-${suffix}.${job.result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(job.result!.blob, job.result!.ext, suffix)} />
        </div>
      )}
    </>
  );
}

function ContainerSelect({ value, onChange }: { value: ContainerId; onChange: (c: ContainerId) => void }) {
  return (
    <label>Format de sortie
      <select value={value} onChange={(e) => onChange(e.target.value as ContainerId)}>
        {CONTAINERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
  );
}
const busyLabel = (p: number | null, verb: string) => (p !== null ? `${verb}… ${Math.round(p * 100)} %` : undefined);

// ── Convertir ─────────────────────────────────────────────────────────
export function ConvertPanel({ file, info, range, onContinue }: Common) {
  const [target, setTarget] = useState<ContainerId>("mp4");
  const [remux, setRemux] = useState<boolean | null>(null);
  const job = useJob();
  useEffect(() => { setRemux(null); canRemux(file, target).then(setRemux).catch(() => setRemux(false)); }, [file, target]);
  const codecs = `${info.video?.codec.toUpperCase() || "—"}${info.audio ? ` + ${info.audio.codec.toUpperCase()}` : ""}`;
  return (
    <div>
      <p className="vx-muted">Vidéo actuelle : {info.container} ({codecs}).</p>
      <div className="vx-fields"><ContainerSelect value={target} onChange={setTarget} /></div>
      <div className="vx-estimate">
        {remux === null ? <span>Vérification…</span> : remux
          ? <span><b>Conversion instantanée, sans perte</b> : les codecs actuels sont acceptés par ce format, les images sont simplement recopiées.</span>
          : <span>Réencodage nécessaire vers {target === "webm" ? "VP9 + Opus" : "H.264 + AAC"}, au débit de la source.</span>}
      </div>
      <JobFooter job={job} file={file} suffix="converti" onContinue={onContinue}
        button={<HudButton action="convert" label={`Convertir en ${target.toUpperCase()}`} busy={job.progress !== null} busyLabel={busyLabel(job.progress, "Conversion")}
          onClick={() => job.start((p, r) => convertVideo(file, range, target, info.video?.bitrate || 2e6, p, r))} />} />
    </div>
  );
}

// ── Pivoter & retourner ───────────────────────────────────────────────
export function RotatePanel({ file, info, range, onContinue }: Common) {
  const [o, setO] = useState<RotateOptions>({ rotation: 90, flipH: false, flipV: false, bake: false });
  const [target, setTarget] = useState<ContainerId>(info.video && ["vp8", "vp9"].includes(info.video.codec) ? "webm" : "mp4"); // garde le format d'origine : rotation sans réencodage
  const job = useJob();
  const nothing = o.rotation === 0 && !o.flipH && !o.flipV;
  return (
    <div>
      <div className="vx-rot">
        {([0, 90, 180, 270] as const).map((r) => (
          <button key={r} type="button" className={`vx-chip${o.rotation === r ? " is-on" : ""}`} onClick={() => setO({ ...o, rotation: r })}>
            {r === 0 ? "Aucune rotation" : `↻ ${r}°`}
          </button>
        ))}
      </div>
      <div className="vx-fields">
        <label className="vx-check"><input type="checkbox" checked={o.flipH} onChange={(e) => setO({ ...o, flipH: e.target.checked })} /> Miroir horizontal (gauche ↔ droite)</label>
        <label className="vx-check"><input type="checkbox" checked={o.flipV} onChange={(e) => setO({ ...o, flipV: e.target.checked })} /> Miroir vertical (haut ↕ bas)</label>
        <ContainerSelect value={target} onChange={setTarget} />
        <label className="vx-check"><input type="checkbox" checked={o.bake} onChange={(e) => setO({ ...o, bake: e.target.checked })} /> Réencoder les images (pour les rares lecteurs qui ignorent la rotation)</label>
      </div>
      <p className="vx-muted">{o.bake
        ? "Les images sont réellement tournées : compatible partout, plus long."
        : target === "webm"
          ? "Le format WebM ne permet pas d'inscrire la rotation dans le fichier : les images seront réencodées (choisis MP4 pour une rotation instantanée et sans perte)."
          : "La rotation est inscrite dans le fichier : instantané et sans perte, respecté par les navigateurs, téléphones et réseaux."}</p>
      <JobFooter job={job} file={file} suffix="pivote" onContinue={onContinue}
        button={<HudButton action="apply-rotation" disabled={nothing} busy={job.progress !== null} busyLabel={busyLabel(job.progress, "Rotation")}
          onClick={() => job.start((p, r) => rotateVideo(file, range, target, o, info.video?.bitrate || 2e6, p, r))} />} />
    </div>
  );
}

// ── Vitesse ───────────────────────────────────────────────────────────
const SPEEDS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 4];
export function SpeedPanel({ file, info, range, onContinue }: Common) {
  const [speed, setSpeed] = useState(2);
  const [keepAudio, setKeepAudio] = useState(true);
  const [target, setTarget] = useState<ContainerId>("mp4");
  const job = useJob();
  const dur = range[1] - range[0];
  return (
    <div>
      <div className="vx-rot">
        {SPEEDS.map((s) => (
          <button key={s} type="button" className={`vx-chip${speed === s ? " is-on" : ""}`} onClick={() => setSpeed(s)}>
            ×{String(s).replace(".", ",")} {s < 1 ? "ralenti" : "accéléré"}
          </button>
        ))}
      </div>
      <div className="vx-fields"><ContainerSelect value={target} onChange={setTarget} /></div>
      <div className="vx-estimate">
        <span>Durée : {fmtTime(dur)} → <b>{fmtTime(dur / speed)}</b></span>
        {info.audio && (
          <label className="vx-check"><input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
            Garder le son — {speed > 1 ? "la voix devient plus aiguë" : "la voix devient plus grave"} (comme un disque joué {speed > 1 ? "plus vite" : "plus lentement"})</label>
        )}
        {speed < 1 && <span className="vx-muted">Ralenti : chaque image est affichée plus longtemps (pour un ralenti très fluide, filme en 60 ou 120 images/s).</span>}
      </div>
      <JobFooter job={job} file={file} suffix={`x${String(speed).replace(".", ",")}`} onContinue={onContinue}
        button={<HudButton action="speed-video" label={`Appliquer ×${String(speed).replace(".", ",")}`} busy={job.progress !== null} busyLabel={busyLabel(job.progress, "Traitement")}
          onClick={() => job.start((p, r) => speedVideo(file, range, target, speed, info.video?.fps || 30, info.video?.bitrate || 2e6, keepAudio && !!info.audio, p, r))} />} />
    </div>
  );
}
