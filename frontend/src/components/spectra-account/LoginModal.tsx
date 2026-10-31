// Fenêtre de connexion NOXEL SPECTRA : Google, lien magique, courriel + mot de passe, passkey.
// Un seul compte NOXEL pour NOXEL SEO, NOXEL FORGE et NOXEL SPECTRA.
import { useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, rafraichirCompte } from "./account";

declare global {
  interface Window { google?: { accounts: { id: { initialize: (c: object) => void; renderButton: (el: HTMLElement, c: object) => void } } } }
}

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
type Onglet = "magic" | "password" | "passkey";

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
  const googleRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          } catch (e) { setErreur(e instanceof Error ? e.message : "Connexion Google impossible"); }
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
        const r = await post("/api/auth/magic/request", { email, lang: "fr" });
        if (!r.ok) throw new Error(await lireErreur(r));
        setInfo("Lien envoyé : ouvre ton courriel et clique sur le lien (valide 15 minutes).");
      } else if (onglet === "password") {
        const r = await post(creer ? "/api/auth/register" : "/api/auth/login", { email, password, lang: "fr" });
        if (!r.ok) throw new Error(await lireErreur(r));
        if (creer) setInfo("Ouvre le lien reçu par courriel pour créer ton compte.");
        else { await rafraichirCompte(); onClose(); }
      } else {
        if (creer) {
          const s = await post("/api/auth/passkey/register/start", { email });
          if (!s.ok) throw new Error(await lireErreur(s));
          const { options } = await s.json();
          const credential = await startRegistration({ optionsJSON: options });
          const f = await post("/api/auth/passkey/register/finish", { email, credential, lang: "fr" });
          if (!f.ok) throw new Error(await lireErreur(f));
          const d = await f.json();
          if (d.pending) setInfo(d.message);
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
      const msg = e instanceof Error ? e.message : "Erreur";
      setErreur(/NotAllowedError|aborted|timed out/i.test(msg) ? "Passkey annulée." : msg);
    } finally {
      setBusy(false);
    }
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "magic", label: "Lien par courriel" },
    { id: "password", label: "Mot de passe" },
    { id: "passkey", label: "Passkey" },
  ];

  return (
    <div className="sp-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-login-title" ref={dialogRef}>
        <button type="button" className="sp-modal__close" aria-label="Fermer" onClick={onClose}>✕</button>
        <h2 id="sp-login-title" className="sp-modal__title">Connexion à NOXEL SPECTRA</h2>
        <p className="sp-modal__sub">Un seul compte NOXEL pour NOXEL SEO, NOXEL FORGE et NOXEL SPECTRA. Les outils gratuits restent ouverts sans compte.</p>

        {GOOGLE_CLIENT_ID && <div ref={googleRef} className="sp-google" />}
        {GOOGLE_CLIENT_ID && <div className="sp-sep"><span>ou</span></div>}

        <div className="nx-cycle__track sp-tabs" role="tablist">
          {onglets.map((o) => (
            <button key={o.id} type="button" role="tab" className="nx-cycle__btn" aria-pressed={onglet === o.id} aria-selected={onglet === o.id}
              onClick={() => { setOnglet(o.id); setErreur(null); setInfo(null); }}>{o.label}</button>
          ))}
        </div>

        <form onSubmit={envoyer} className="sp-form">
          {!(onglet === "passkey" && !creer) && (
            <label>Courriel
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {onglet === "password" && (
            <label>Mot de passe
              <input type="password" required minLength={creer ? 8 : 1} autoComplete={creer ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {onglet !== "magic" && (
            <label className="sp-check">
              <input type="checkbox" checked={creer} onChange={(e) => setCreer(e.target.checked)} />
              Je n'ai pas encore de compte NOXEL
            </label>
          )}
          {erreur && <p className="sp-error" role="alert">{erreur}</p>}
          {info && <p className="sp-info" role="status">{info}</p>}
          <HudButton type="submit" action="continue" busy={busy}
            label={onglet === "magic" ? "Recevoir le lien" : onglet === "passkey" ? (creer ? "Créer avec une passkey" : "Utiliser ma passkey") : creer ? "Créer mon compte" : "Se connecter"} />
        </form>
      </div>
    </div>
  );
}
