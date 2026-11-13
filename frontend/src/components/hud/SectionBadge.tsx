// Repère de section sous le logo NOXEL SPECTRA : un symbole (image ou vidéo) pour que le visiteur
// voie sans lire dans quelle partie il se trouve. Partagé par l'app image et l'outil vidéo (@hud).
import "./section-badge.css";

type Props = { kind: "image" | "video"; label: string; badge?: string };

function ImageIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="3.5" y="6.5" width="25" height="19" rx="3" fill="none" stroke="url(#nx-sb-grad)" strokeWidth="2.2" />
      <circle cx="11" cy="13" r="2.6" fill="#3ddc84" />
      <path d="M5 23.5l7.2-7.4 4.8 4.6 3.6-3.4 6.4 6.2" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2.5" y="8" width="19" height="16" rx="3" fill="none" stroke="url(#nx-sb-grad)" strokeWidth="2.2" />
      <path d="M21.5 14l7-4v12l-7-4z" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M9.5 12.5v7l5.5-3.5z" fill="#3ddc84" />
    </svg>
  );
}

export function SectionBadge({ kind, label, badge }: Props) {
  return (
    <div className={`nx-section-badge nx-section-badge--${kind}`}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="nx-sb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3ddc84" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="nx-section-badge-icon">{kind === "image" ? <ImageIcon /> : <VideoIcon />}</span>
      <span className="nx-section-badge-label">{label}</span>
      {badge && <span className="nx-section-badge-tag">{badge}</span>}
    </div>
  );
}
