// Fenêtre affichée quand une image chargée contient des métadonnées
// (position GPS, date, appareil…). Le choix s'applique à toutes les images
// du chargement ; Échap = continuer sans supprimer.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HudButton } from "../hud/HudButton";
import type { ImageMetadata } from "../../utils/exifUtils";
import "./exif-notice.css";

export type ExifNoticeItem = { name: string; meta: ImageMetadata };

type Props = {
  items: ExifNoticeItem[];
  /** Nombre d'images du chargement (pour le résumé en lot) */
  total: number;
  busy?: boolean;
  onStrip: () => void;
  onKeep: () => void;
};

/** « 2024:04:30 18:42:07 » → « 30/04/2024 à 18:42 » */
function formatExifDate(value: string): string {
  const m = /^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` à ${m[4]}:${m[5]}` : ""}`;
}

function DetailList({ meta }: { meta: ImageMetadata }) {
  const camera = [meta.make, meta.model]
    .filter(Boolean)
    // Beaucoup d'appareils répètent la marque dans le modèle
    .filter((v, i, all) => !(i === 0 && all[1]?.toLowerCase().startsWith(String(v).toLowerCase())))
    .join(" ");
  const others: string[] = [];
  if (meta.otherExif) others.push("EXIF");
  if (meta.hasXmp) others.push("XMP");
  if (meta.hasIptc) others.push("IPTC");
  if (meta.textKeys.length) others.push(`texte : ${meta.textKeys.slice(0, 4).join(", ")}${meta.textKeys.length > 4 ? "…" : ""}`);
  return (
    <ul className="exif-notice__list">
      {meta.gps && (
        <li>
          <span aria-hidden="true">📍</span> Position GPS : {meta.gps.lat.toFixed(4)}, {meta.gps.lng.toFixed(4)}
        </li>
      )}
      {!meta.gps && meta.gpsUnreadable && (
        <li>
          <span aria-hidden="true">📍</span> Données GPS
        </li>
      )}
      {meta.dateTime && (
        <li>
          <span aria-hidden="true">📅</span> Date de prise de vue : {formatExifDate(meta.dateTime)}
        </li>
      )}
      {camera && (
        <li>
          <span aria-hidden="true">📷</span> Appareil : {camera}
        </li>
      )}
      {meta.software && (
        <li>
          <span aria-hidden="true">💻</span> Logiciel : {meta.software}
        </li>
      )}
      {others.length > 0 && (
        <li>
          <span aria-hidden="true">🗂</span> Autres métadonnées ({others.join(", ")})
        </li>
      )}
    </ul>
  );
}

export function ExifNotice({ items, total, busy = false, onStrip, onKeep }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const keepRef = useRef(onKeep);
  const busyRef = useRef(busy);
  useEffect(() => {
    keepRef.current = onKeep;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    boxRef.current?.querySelector<HTMLButtonElement>("[data-primary] button, button[data-primary]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busyRef.current) keepRef.current();
        return;
      }
      if (e.key !== "Tab" || !boxRef.current) return;
      // Le focus reste dans la fenêtre
      const focusable = Array.from(boxRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  const single = items.length === 1 && total === 1;
  const withGps = items.filter((i) => i.meta.gps || i.meta.gpsUnreadable).length;

  return createPortal(
    <div className="exif-notice__backdrop">
      <div
        ref={boxRef}
        className="exif-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exif-notice-title"
        aria-describedby="exif-notice-desc"
      >
        <h2 id="exif-notice-title" className="exif-notice__title">
          Métadonnées détectées
        </h2>
        {single ? (
          <DetailList meta={items[0].meta} />
        ) : (
          <>
            <p className="exif-notice__summary">
              {items.length === 1 ? "1 image contient" : `${items.length} images contiennent`} des métadonnées
              {withGps > 0 && ` (dont ${withGps} avec position GPS)`}
              {total > items.length && ` sur ${total} chargées`}.
            </p>
            <ul className="exif-notice__files">
              {items.slice(0, 6).map((i, k) => (
                <li key={k}>
                  {i.meta.gps || i.meta.gpsUnreadable ? <span aria-label="avec position GPS">📍 </span> : null}
                  {i.name}
                </li>
              ))}
              {items.length > 6 && <li>… et {items.length - 6} autre{items.length - 6 > 1 ? "s" : ""}</li>}
            </ul>
          </>
        )}
        <p id="exif-notice-desc" className="exif-notice__text">
          Ces informations peuvent révéler où et quand la photo a été prise. Si vous les gardez, elles restent dans le
          fichier d'origine conservé dans votre navigateur (et dans l'export .zip du projet) et sont envoyées à notre
          serveur avec l'image pour le traitement. Les images produites par nos outils ne les contiennent pas.
        </p>
        <p className="exif-notice__hint">
          La suppression se fait dans votre navigateur, sans recompresser l'image : qualité, couleurs et transparence
          sont intactes.
        </p>
        <div className="exif-notice__actions">
          <span data-primary>
            <HudButton
              action="clean-metadata"
              label="Supprimer les métadonnées"
              busy={busy}
              busyLabel="Suppression…"
              onClick={onStrip}
            />
          </span>
          <HudButton action="continue" label="Continuer sans supprimer" disabled={busy} onClick={onKeep} />
        </div>
      </div>
    </div>,
    document.body
  );
}
