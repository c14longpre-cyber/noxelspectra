// Fenêtre de connexion NOXEL SPECTRA (look commun NOXEL Login 1.0, src/noxel-login.css) :
// Google, passkey, lien magique, courriel + mot de passe. Un seul compte NOXEL pour SEO, FORGE et SPECTRA.
import { useEffect, useRef, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, rafraichirCompte } from "./account";
import { tr, shownLang } from "../../i18n";
import { trServeur } from "../../i18n/serveur";
import "../../noxel-login.css";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (c: object) => void;
      renderButton: (el: HTMLElement, c: object) => void;
      prompt: () => void;
    } } };
  }
}

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
type Ecran = "grid" | "magic" | "email" | "passkey";

async function post(path: string, body: object) {
  return apiFetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const LOGO_GOOGLE = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
);

export function LoginModal({ onClose }: { onClose: () => void }) {
  const [ecran, setEcran] = useState<Ecran>("grid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creer, setCreer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lienEnvoye, setLienEnvoye] = useState(false);
  const [googleSecours, setGoogleSecours] = useState(false);  // bouton officiel si la fenêtre Google ne s'ouvre pas
  const googleRef = useRef<HTMLDivElement>(null);
  const googlePret = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { cardRef.current?.querySelector<HTMLElement>("input, .nxl-provider, .nxl-wide")?.focus(); }, [ecran]);

  function changerEcran(e: Ecran) { setEcran(e); setErreur(null); setInfo(null); setLienEnvoye(false); setCreer(false); }

  // Google : script chargé seulement à l'ouverture de la fenêtre
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google || googlePret.current) return;
      googlePret.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (r: { credential: string }) => {
          setBusy(true); setErreur(null);
          try {
            const res = await post("/api/auth/google", { token: r.credential });
            if (!res.ok) throw new Error(await lireErreur(res));
            await rafraichirCompte();
            onCloseRef.current();
          } catch (e) { setErreur(e instanceof Error ? e.message : tr("Connexion Google impossible")); }
          finally { setBusy(false); }
        },
      });
    };
    if (window.google) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  // Bouton officiel de Google en secours (fenêtre Google bloquée ou déjà refusée récemment)
  useEffect(() => {
    if (googleSecours && googleRef.current && window.google) {
      window.google.accounts.id.renderButton(googleRef.current, { theme: "filled_black", size: "large", width: 300, text: "continue_with", locale: shownLang() });
    }
  }, [googleSecours]);

  function connexionGoogle() {
    if (!window.google) { setErreur(tr("Connexion Google impossible")); return; }
    window.google.accounts.id.prompt();
    // La fenêtre « One Tap » peut être bloquée (navigateur, refus récent) : le bouton officiel apparaît en secours
    setGoogleSecours(true);
  }

  async function passkeyConnexion() {
    setBusy(true); setErreur(null); setInfo(null);
    try {
      const s = await post("/api/auth/passkey/login/start", {});
      if (!s.ok) throw new Error(await lireErreur(s));
      const { options } = await s.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const f = await post("/api/auth/passkey/login/finish", { credential });
      if (!f.ok) throw new Error(await lireErreur(f));
      await rafraichirCompte();
      onClose();
    } catch (e) { montrerErreur(e); }
    finally { setBusy(false); }
  }

  function montrerErreur(e: unknown) {
    const msg = e instanceof Error ? e.message : tr("Erreur");
    setErreur(/NotAllowedError|aborted|timed out/i.test(msg) ? tr("Passkey annulée.") : msg);
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErreur(null); setInfo(null);
    try {
      if (ecran === "magic") {
        const r = await post("/api/auth/magic/request", { email, lang: shownLang() });
        if (!r.ok) throw new Error(await lireErreur(r));
        setLienEnvoye(true);
      } else if (ecran === "email") {
        const r = await post(creer ? "/api/auth/register" : "/api/auth/login", { email, password, lang: shownLang() });
        if (!r.ok) throw new Error(await lireErreur(r));
        if (creer) setInfo(tr("Ouvre le lien reçu par courriel pour créer ton compte."));
        else { await rafraichirCompte(); onClose(); }
      } else if (ecran === "passkey") {
        const s = await post("/api/auth/passkey/register/start", { email });
        if (!s.ok) throw new Error(await lireErreur(s));
        const { options } = await s.json();
        const credential = await startRegistration({ optionsJSON: options });
        const f = await post("/api/auth/passkey/register/finish", { email, credential, lang: shownLang() });
        if (!f.ok) throw new Error(await lireErreur(f));
        const d = await f.json();
        if (d.pending) setInfo(trServeur(d.message));
        else { await rafraichirCompte(); onClose(); }
      }
    } catch (err) { montrerErreur(err); }
    finally { setBusy(false); }
  }

  const retour = <button type="button" className="nxl-back" onClick={() => changerEcran("grid")}>← {tr("Retour")}</button>;
  const messages = (
    <>
      {erreur && <p className="nxl-msg nxl-msg--error" role="alert">{erreur}</p>}
      {info && <p className="nxl-msg nxl-msg--ok" role="status">{info}</p>}
    </>
  );

  return (
    <div className="nxl-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nxl-card" role="dialog" aria-modal="true" aria-labelledby="nxl-title" ref={cardRef}>
        <button type="button" className="nxl-close" aria-label={tr("Fermer")} onClick={onClose}>✕</button>

        {ecran === "grid" && (
          <>
            <div className="nxl-head">
              <h2 id="nxl-title" className="nxl-title">{tr("Accéder à NOXEL SPECTRA")}</h2>
              <p className="nxl-sub">{tr("Un seul compte NOXEL pour NOXEL SEO, NOXEL FORGE et NOXEL SPECTRA. Les outils gratuits restent ouverts sans compte.")}</p>
            </div>

            {GOOGLE_CLIENT_ID && (
              <div className="nxl-providers">
                <button type="button" className="nxl-provider" onClick={connexionGoogle} disabled={busy}>
                  {LOGO_GOOGLE}<span className="nxl-provider__name">Google</span>
                </button>
              </div>
            )}
            {googleSecours && (
              <div className="nxl-google-fallback">
                <p className="nxl-sub" style={{ margin: "0 0 8px", textAlign: "center" }}>{tr("La fenêtre de Google ne s'ouvre pas ? Utilise ce bouton :")}</p>
                <div ref={googleRef} style={{ display: "flex", justifyContent: "center" }} />
              </div>
            )}

            <div className="nxl-passkey">
              <HudButton action="continue" compact busy={busy} label={tr("Se connecter avec une passkey")} onClick={passkeyConnexion} />
              <button type="button" className="nxl-link nxl-link--violet" onClick={() => changerEcran("passkey")}>{tr("Créer une nouvelle passkey →")}</button>
            </div>
            {messages}

            <button type="button" className="nxl-wide nxl-wide--magic" onClick={() => changerEcran("magic")}>{tr("Se connecter par lien magique (sans mot de passe)")}</button>
            <button type="button" className="nxl-wide" onClick={() => changerEcran("email")}>{tr("Se connecter par courriel / mot de passe")}</button>
          </>
        )}

        {ecran === "magic" && (
          <>
            {retour}
            <h2 id="nxl-title" className="nxl-h2">{tr("Lien magique")}</h2>
            <p className="nxl-lead">{tr("Entre ton courriel : on t'envoie un lien de connexion sécurisé, sans mot de passe.")}</p>
            {lienEnvoye ? (
              <div className="nxl-sent" role="status">
                <div className="nxl-sent__title">{tr("Regarde tes courriels !")}</div>
                <div className="nxl-sent__text">{tr("Lien envoyé à {a}. Il est valide 15 minutes.", { a: email })}</div>
              </div>
            ) : (
              <form className="nxl-form" onSubmit={envoyer}>
                <input className="nxl-input" type="email" required autoComplete="email" placeholder={tr("ton@courriel.com")} value={email} onChange={(e) => setEmail(e.target.value)} />
                {messages}
                <HudButton type="submit" action="continue" compact busy={busy} label={tr("Recevoir le lien")} />
              </form>
            )}
          </>
        )}

        {ecran === "email" && (
          <>
            {retour}
            <h2 id="nxl-title" className="nxl-h2" style={{ marginBottom: 18 }}>{tr("Connexion par courriel")}</h2>
            <div className="nxl-tabs" role="tablist">
              <button type="button" role="tab" className="nxl-tab" aria-selected={!creer} onClick={() => { setCreer(false); setErreur(null); setInfo(null); }}>{tr("Se connecter")}</button>
              <button type="button" role="tab" className="nxl-tab" aria-selected={creer} onClick={() => { setCreer(true); setErreur(null); setInfo(null); }}>{tr("Créer un compte")}</button>
            </div>
            <form className="nxl-form" onSubmit={envoyer}>
              <input className="nxl-input" type="email" required autoComplete="email" placeholder={tr("ton@courriel.com")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="nxl-input" type="password" required minLength={creer ? 8 : 1} autoComplete={creer ? "new-password" : "current-password"}
                placeholder={creer ? tr("Mot de passe (8 caractères au moins)") : tr("Mot de passe")} value={password} onChange={(e) => setPassword(e.target.value)} />
              {messages}
              <HudButton type="submit" action="continue" compact busy={busy} label={creer ? tr("Créer mon compte") : tr("Se connecter")} />
              <button type="button" className="nxl-link nxl-link--green" onClick={() => changerEcran("magic")}>{tr("Mot de passe oublié ? Utilise plutôt le lien magique →")}</button>
            </form>
          </>
        )}

        {ecran === "passkey" && (
          <>
            {retour}
            <h2 id="nxl-title" className="nxl-h2">{tr("Créer une passkey")}</h2>
            <p className="nxl-lead">{tr("Ton appareil (empreinte, visage ou code) remplace le mot de passe. Entre ton courriel pour créer ton compte NOXEL avec une passkey.")}</p>
            <form className="nxl-form" onSubmit={envoyer}>
              <input className="nxl-input" type="email" required autoComplete="email" placeholder={tr("ton@courriel.com")} value={email} onChange={(e) => setEmail(e.target.value)} />
              {messages}
              <HudButton type="submit" action="continue" compact busy={busy} label={tr("Créer avec une passkey")} />
            </form>
          </>
        )}

        <p className="nxl-legal">{tr("En te connectant, tu acceptes nos conditions. Nous ne vendons jamais tes données.")}</p>
      </div>
    </div>
  );
}
