// Codes d'accès NOXEL SPECTRA : « J'ai un code » (tout compte) et création des codes (SPECTRA_ADMIN_EMAILS).
// Table access_codes partagée avec NOXEL SEO et NOXEL FORGE (product = 'spectra'), routes backend/src/account/codes.routes.ts.
import { useState } from "react";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, rafraichirCompte } from "./account";
import { tr, locale } from "../../i18n";

type Code = { code: string; tier: string; duration: string; created_by: string | null; created_at: string; expires_at: string | null; is_used?: boolean | null; used_by?: string | null; used_at?: string | null };

const jour = (iso: string) => new Date(iso).toLocaleDateString(locale());
const moment = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) : "—");
const DUREES: [string, string][] = [["1week", "1 semaine"], ["1month", "1 mois"], ["3months", "3 mois"], ["6months", "6 mois"], ["1year", "1 an"], ["lifetime", "Sans fin"]];
const TIERS: [string, string][] = [["diamond", "💎 Diamond"], ["platinum", "Platinum"], ["gold", "Gold"], ["silver", "Silver"]];
const libelleDuree = (d: string) => tr(DUREES.find(([k]) => k === d)?.[1] ?? d);

export function RedeemCode({ offerEndsAt }: { offerEndsAt?: string | null }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  async function echanger() {
    if (!code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await apiFetch(`${API_URL}/api/codes/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!r.ok) throw new Error(await lireErreur(r));
      const d = await r.json();
      setMsg({ ok: true, texte: d.expiresAt
        ? tr("Code accepté : forfait {a} jusqu'au {b}.", { a: String(d.tier).toUpperCase(), b: jour(d.expiresAt) })
        : tr("Code accepté : forfait {a}.", { a: String(d.tier).toUpperCase() }) });
      setCode("");
      await rafraichirCompte();
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof Error ? e.message : tr("Erreur") });
    } finally { setBusy(false); }
  }

  return (
    <div className="nx-info" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="nx-info__title">{tr("Tu as un code d'accès ?")}</div>
      {offerEndsAt && <div className="nx-info__desc" style={{ color: "#3ddc84" }}>{tr("Ton forfait actuel est offert jusqu'au {a}.", { a: jour(offerEndsAt) })}</div>}
      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }} onSubmit={(e) => { e.preventDefault(); void echanger(); }}>
        <label htmlFor="spectra-code" className="sp-sr-only" style={{ position: "absolute", left: -9999 }}>{tr("Code d'accès")}</label>
        <input id="spectra-code" className="sp-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="NXS-XXXXXX-XXXXXX" autoComplete="off" spellCheck={false}
          style={{ flex: "1 1 220px", maxWidth: 320, fontFamily: "monospace", letterSpacing: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f5f5f5", fontSize: 14 }} />
        <HudButton action="ok" compact label={tr("Utiliser le code")} busy={busy} onClick={() => void echanger()} />
      </form>
      {msg && <div role="status" className={msg.ok ? undefined : "sp-error"} style={msg.ok ? { color: "#3ddc84", fontSize: 13 } : undefined}>{msg.texte}</div>}
    </div>
  );
}

function CarteCode({ c }: { c: Code }) {
  const [copie, setCopie] = useState(false);
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: c.is_used ? 0.6 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, letterSpacing: 2, color: "#3ddc84" }}>{c.code}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, fontSize: 11, alignItems: "center", color: "rgba(255,255,255,0.62)" }}>
          <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(61,220,132,0.15)", color: "#3ddc84", fontWeight: 800, textTransform: "uppercase" }}>{c.tier}</span>
          <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(168,85,247,0.15)", color: "#c99bff", fontWeight: 800 }}>{libelleDuree(c.duration)}</span>
          {c.created_by && <span>→ {c.created_by}</span>}
          <span>{moment(c.created_at)}</span>
          {c.is_used
            ? <span style={{ color: "#ffb74d", fontWeight: 700 }}>{tr("Utilisé par {a} le {b}", { a: c.used_by || "?", b: moment(c.used_at) })}</span>
            : c.expires_at && <span>{tr("À utiliser avant le {a}", { a: jour(c.expires_at) })}</span>}
        </div>
      </div>
      {!c.is_used && <HudButton action="copy-code" compact label={copie ? tr("Copié") : tr("Copier")} onClick={() => {
        navigator.clipboard?.writeText(c.code).then(() => { setCopie(true); window.setTimeout(() => setCopie(false), 1500); }).catch(() => {});
      }} />}
    </div>
  );
}

const champ = { width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "#14171f", color: "#f5f5f5", fontSize: 14 };
const etiquette = { display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.62)", marginBottom: 6 };

export function AdminCodes() {
  const [onglet, setOnglet] = useState<"creer" | "tous">("creer");
  const [tier, setTier] = useState("diamond");
  const [duree, setDuree] = useState("1month");
  const [nombre, setNombre] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [session, setSession] = useState<Code[]>([]);
  const [tous, setTous] = useState<Code[] | null>(null);

  async function charger() {
    setTous(null);
    try {
      const r = await apiFetch(`${API_URL}/api/admin/codes`);
      if (!r.ok) throw new Error(await lireErreur(r));
      setTous((await r.json()).codes ?? []);
    } catch (e) { setErreur(e instanceof Error ? e.message : tr("Erreur")); setTous([]); }
  }

  async function creer() {
    setBusy(true); setErreur(null);
    try {
      const r = await apiFetch(`${API_URL}/api/admin/codes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier, duration: duree, count: nombre, note }) });
      if (!r.ok) throw new Error(await lireErreur(r));
      const d = await r.json();
      setSession((s) => [...(d.codes ?? []), ...s]);
    } catch (e) { setErreur(e instanceof Error ? e.message : tr("Erreur")); }
    finally { setBusy(false); }
  }

  return (
    <div className="nx-info" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div className="nx-info__title" style={{ color: "#3ddc84", fontSize: 18 }}>⚡ {tr("Codes d'accès NOXEL SPECTRA (admin)")}</div>
        <div className="nx-info__desc">{tr("Créez un code et envoyez-le à la personne : elle l'entre ici, dans « Tu as un code d'accès ? ». Le forfait revient tout seul à l'ancien à la fin de la durée.")}</div>
      </div>
      <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 12 }}>
        {([["creer", tr("Créer un code")], ["tous", tr("Tous les codes")]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={onglet === k} onClick={() => { setOnglet(k); if (k === "tous") void charger(); }}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
              background: onglet === k ? "rgba(61,220,132,0.15)" : "transparent", color: onglet === k ? "#3ddc84" : "rgba(255,255,255,0.62)" }}>{l}</button>
        ))}
      </div>
      {erreur && <div role="alert" className="sp-error">{erreur}</div>}
      {onglet === "creer" ? (
        <>
          <div>
            <label style={etiquette} htmlFor="sc-note">{tr("Pour qui (courriel ou note, facultatif)")}</label>
            <input id="sc-note" style={champ} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="user@example.com" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div><label style={etiquette} htmlFor="sc-tier">{tr("Forfait")}</label>
              <select id="sc-tier" style={champ} value={tier} onChange={(e) => setTier(e.target.value)}>{TIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label style={etiquette} htmlFor="sc-duree">{tr("Durée")}</label>
              <select id="sc-duree" style={champ} value={duree} onChange={(e) => setDuree(e.target.value)}>{DUREES.map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select></div>
            <div><label style={etiquette} htmlFor="sc-nombre">{tr("Nombre")}</label>
              <input id="sc-nombre" type="number" min={1} max={20} style={champ} value={nombre} onChange={(e) => setNombre(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} /></div>
          </div>
          <div><HudButton action="new-project" compact label={tr("Créer le code")} busy={busy} onClick={() => void creer()} /></div>
          {session.length > 0 && (
            <>
              <div style={etiquette}>{tr("Créés pendant cette session")}</div>
              <div style={{ display: "grid", gap: 8 }}>{session.map((c) => <CarteCode key={c.code} c={c} />)}</div>
            </>
          )}
        </>
      ) : tous === null ? (
        <div className="nx-info__desc">{tr("Chargement…")}</div>
      ) : tous.length === 0 ? (
        <div className="nx-info__desc">{tr("Aucun code pour l'instant.")}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>{tous.map((c) => <CarteCode key={c.code} c={c} />)}</div>
      )}
    </div>
  );
}
