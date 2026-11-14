// Fenêtre de connexion NOXEL SPECTRA : Google, GitHub, LinkedIn, Microsoft, lien magique, courriel + mot de passe, passkey.
// GitHub, LinkedIn et Microsoft n'apparaissent que si le serveur les a configurés (GET /api/auth/providers).
// Un seul compte NOXEL pour NOXEL SEO, NOXEL FORGE et NOXEL SPECTRA.
import { useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, rafraichirCompte } from "./account";

import { tr, shownLang } from "../../i18n";
import { trServeur } from "../../i18n/serveur";
declare global {
  interface Window { google?: { accounts: { id: { initialize: (c: object) => void; renderButton: (el: HTMLElement, c: object) => void } } } }
}

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
type Onglet = "magic" | "password" | "passkey";
type Fournisseur = "github" | "linkedin" | "microsoft";
const FOURNISSEURS: { id: Fournisseur; nom: string; logo: JSX.Element }[] = [
  { id: "github", nom: "GitHub", logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg> },
  { id: "linkedin", nom: "LinkedIn", logo: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { id: "microsoft", nom: "Microsoft", logo: <svg width="20" height="20" viewBox="0 0 24 24"><rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/><rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/><rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/></svg> },
];

async function post(path: string, body: object) {
  return apiFetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function LoginModal({ onClose }: { onClose: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creer, setCreer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [actifs, setActifs] = useState<Fournisseur[]>([]);
  const googleRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Boutons GitHub / LinkedIn / Microsoft : seulement ceux que le serveur a configurés
  useEffect(() => {
    let vivant = true;
    fetch(`${API_URL}/api/auth/providers`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (vivant && d?.providers) setActifs(d.providers.filter((p: string): p is Fournisseur => FOURNISSEURS.some((f) => f.id === p)));
    }).catch(() => {});
    return () => { vivant = false; };
  }, []);

  // Bouton Google : le script de Google n'est chargé qu'à l'ouverture de cette fenêtre
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return;
    const rendre = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (r: { credential: string }) => {
          setBusy(true); setErreur(null);
          try {
            const res = await post("/api/auth/google", { token: r.credential });
            if (!res.ok) throw new Error(await lireErreur(res));
            await rafraichirCompte();
            onClose();
          } catch (e) { setErreur(e instanceof Error ? e.message : tr("Connexion Google impossible")); }
          finally { setBusy(false); }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, { theme: "filled_black", size: "large", width: 320, text: "continue_with", locale: "fr" });
    };
    if (window.google) { rendre(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = rendre;
    document.head.appendChild(s);
  }, [onClose]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErreur(null); setInfo(null);
    try {
      if (onglet === "magic") {
        const r = await post("/api/auth/magic/request", { email, lang: shownLang() });
        if (!r.ok) throw new Error(await lireErreur(r));
        setInfo(tr("Lien envoyé : ouvre ton courriel et clique sur le lien (valide 15 minutes)."));
      } else if (onglet === "password") {
        const r = await post(creer ? "/api/auth/register" : "/api/auth/login", { email, password, lang: shownLang() });
        if (!r.ok) throw new Error(await lireErreur(r));
        if (creer) setInfo(tr("Ouvre le lien reçu par courriel pour créer ton compte."));
        else { await rafraichirCompte(); onClose(); }
      } else {
        if (creer) {
          const s = await post("/api/auth/passkey/register/start", { email });
          if (!s.ok) throw new Error(await lireErreur(s));
          const { options } = await s.json();
          const credential = await startRegistration({ optionsJSON: options });
          const f = await post("/api/auth/passkey/register/finish", { email, credential, lang: shownLang() });
          if (!f.ok) throw new Error(await lireErreur(f));
          const d = await f.json();
          if (d.pending) setInfo(trServeur(d.message));
          else { await rafraichirCompte(); onClose(); }
        } else {
          const s = await post("/api/auth/passkey/login/start", {});
          if (!s.ok) throw new Error(await lireErreur(s));
          const { options } = await s.json();
          const credential = await startAuthentication({ optionsJSON: options });
          const f = await post("/api/auth/passkey/login/finish", { credential });
          if (!f.ok) throw new Error(await lireErreur(f));
          await rafraichirCompte();
          onClose();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("Erreur");
      setErreur(/NotAllowedError|aborted|timed out/i.test(msg) ? tr("Passkey annulée.") : msg);
    } finally {
      setBusy(false);
    }
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "magic", label: tr("Lien par courriel") },
    { id: "password", label: tr("Mot de passe") },
    { id: "passkey", label: tr("Passkey") },
  ];

  return (
    <div className="sp-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-login-title" ref={dialogRef}>
        <button type="button" className="sp-modal__close" aria-label={tr("Fermer")} onClick={onClose}>✕</button>
        <h2 id="sp-login-title" className="sp-modal__title">{tr("Connexion à NOXEL SPECTRA")}</h2>
        <p className="sp-modal__sub">{tr("Un seul compte NOXEL pour NOXEL SEO, NOXEL FORGE et NOXEL SPECTRA. Les outils gratuits restent ouverts sans compte.")}</p>

        {GOOGLE_CLIENT_ID && <div ref={googleRef} className="sp-google" />}
        {actifs.length > 0 && (
          <div className="sp-providers">
            {FOURNISSEURS.filter((f) => actifs.includes(f.id)).map((f) => (
              <a key={f.id} className="sp-provider" href={`${API_URL}/api/auth/${f.id}/start`}>
                <span className="sp-provider__logo" aria-hidden="true">{f.logo}</span>
                {tr("Continuer avec {nom}", { nom: f.nom })}
              </a>
            ))}
          </div>
        )}
        {(GOOGLE_CLIENT_ID || actifs.length > 0) && <div className="sp-sep"><span>{tr("ou")}</span></div>}

        <div className="nx-cycle__track sp-tabs" role="tablist">
          {onglets.map((o) => (
            <button key={o.id} type="button" role="tab" className="nx-cycle__btn" aria-pressed={onglet === o.id} aria-selected={onglet === o.id}
              onClick={() => { setOnglet(o.id); setErreur(null); setInfo(null); }}>{tr(o.label)}</button>
          ))}
        </div>

        <form onSubmit={envoyer} className="sp-form">
          {!(onglet === "passkey" && !creer) && (
            <label>{tr("Courriel")}
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {onglet === "password" && (
            <label>{tr("Mot de passe")}
              <input type="password" required minLength={creer ? 8 : 1} autoComplete={creer ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {onglet !== "magic" && (
            <label className="sp-check">
              <input type="checkbox" checked={creer} onChange={(e) => setCreer(e.target.checked)} />
              {tr("Je n'ai pas encore de compte NOXEL")}
            </label>
          )}
          {erreur && <p className="sp-error" role="alert">{erreur}</p>}
          {info && <p className="sp-info" role="status">{info}</p>}
          <HudButton type="submit" action="continue" busy={busy}
            label={onglet === "magic" ? tr("Recevoir le lien") : onglet === "passkey" ? (creer ? tr("Créer avec une passkey") : tr("Utiliser ma passkey")) : creer ? tr("Créer mon compte") : tr("Se connecter")} />
        </form>
      </div>
    </div>
  );
}
