// Page de prix NOXEL SPECTRA, au format commun NOXEL (cartes .nx-pcard, comme NOXEL SEO et NOXEL FORGE).
// Les chiffres viennent du serveur (GET /api/plans, backend/src/account/plans.ts) : jamais recopiés ici.
import { useEffect, useState } from "react";
import { HudButton } from "../hud/HudButton";
import { API_URL, TIER_COLORS, TIER_MEDAL, allerVers, apiFetch, openLogin, useAccount, type PlanInfo } from "./account";

interface PlansReponse { plans: PlanInfo[]; creditPack: { credits: number; priceCad: number; available: boolean } }

const prix = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: n % 1 ? 2 : 0 });

export function PricingPage() {
  const { account } = useAccount();
  const [data, setData] = useState<PlansReponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/plans`).then((r) => r.json()).then(setData).catch(() => setErreur("Forfaits indisponibles pour le moment."));
  }, []);

  async function choisir(p: PlanInfo) {
    if (p.tier === "bronze") return;
    if (!account) { openLogin(); return; }
    setBusy(p.tier); setErreur(null);
    try { await allerVers("/api/billing/checkout", { tier: p.tier, cycle }); }
    catch (e) { setErreur(e instanceof Error ? e.message : "Paiement impossible"); }
    finally { setBusy(null); }
  }

  async function acheterCredits() {
    if (!account) { openLogin(); return; }
    setBusy("credits"); setErreur(null);
    try { await allerVers("/api/billing/credits"); }
    catch (e) { setErreur(e instanceof Error ? e.message : "Paiement impossible"); }
    finally { setBusy(null); }
  }

  const actuel = account?.plan.tier ?? "bronze";

  return (
    <div className="nx-page" style={{ padding: "8px 0 24px", maxWidth: "none" }}>
      <div className="nx-cycle">
        <div className="nx-cycle__track">
          <button type="button" className="nx-cycle__btn" aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>Mensuel</button>
          <button type="button" className="nx-cycle__btn" aria-pressed={cycle === "annual"} onClick={() => setCycle("annual")}>Annuel <span className="nx-save">−17 %</span></button>
        </div>
      </div>
      <div className="nx-price-note">Prix en dollars canadiens (CAD). Les outils d'images et l'outil vidéo sont inclus dans tous les forfaits.</div>
      {erreur && <p className="sp-error" role="alert" style={{ textAlign: "center" }}>{erreur}</p>}

      <div className="nx-pricing-grid">
        {(data?.plans ?? []).map((p) => {
          const estActuel = p.tier === actuel;
          const montant = cycle === "annual" ? p.annual / 12 : p.monthly;
          return (
            <div key={p.tier} className={`nx-pcard${p.tier === "gold" ? " nx-pcard--featured" : ""}${estActuel && account ? " nx-pcard--active" : ""}`}>
              {estActuel && account ? <div className="nx-pcard__flag">✓ Forfait actuel</div> : p.tier === "gold" ? <div className="nx-pcard__flag">Le plus choisi</div> : null}
              <div className="nx-pcard__head">
                <img src={TIER_MEDAL(p.tier)} alt="" width={48} height={48} />
                <div className="nx-pcard__name" style={{ color: TIER_COLORS[p.tier] }}>{p.name.toUpperCase()}</div>
              </div>
              <div className="nx-pcard__price">
                {p.monthly === 0 ? "Gratuit" : prix(montant)}
                {p.monthly > 0 && <span className="nx-pcard__period">/mois</span>}
              </div>
              {p.monthly > 0 && cycle === "annual" && <div className="nx-pcard__sub">Facturé {prix(p.annual)} par an</div>}
              <div className="nx-pcard__note">{p.aiCredits > 0 ? `${p.aiCredits} crédits de dessin IA par mois` : "Sans compte"}</div>
              <ul className="nx-pcard__items">
                {p.features.fr.map((f) => <li key={f}><span style={{ color: TIER_COLORS[p.tier] }}>✓</span>{f}</li>)}
              </ul>
              <div className="nx-pcard__cta">
                {p.tier === "bronze" ? (
                  <HudButton action="ok" compact label={estActuel ? "Inclus" : "Gratuit"} disabled />
                ) : (
                  <HudButton action="continue" compact busy={busy === p.tier}
                    disabled={(estActuel && !!account) || !p.available || (cycle === "annual" && !p.annualAvailable)}
                    label={estActuel && account ? "Forfait actuel" : !p.available ? "Bientôt" : `Choisir ${p.name}`}
                    onClick={() => choisir(p)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="nx-info" style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div className="nx-info__title">Crédits de dessin IA</div>
          <div className="nx-info__desc">
            Une image dessinée par l'IA (FLUX.2 [pro]) coûte 1 crédit. Les crédits inclus reviennent le 1er de chaque mois ;
            les crédits achetés n'expirent pas. {data?.creditPack ? `Paquet de ${data.creditPack.credits} crédits : ${prix(data.creditPack.priceCad)}.` : ""}
            {account ? ` Il te reste ${account.credits.total} crédit${account.credits.total > 1 ? "s" : ""}.` : ""}
          </div>
        </div>
        <HudButton action="continue" compact busy={busy === "credits"} disabled={!data?.creditPack.available}
          label={data?.creditPack.available ? `Acheter ${data.creditPack.credits} crédits` : "Bientôt"} onClick={acheterCredits} />
      </div>
    </div>
  );
}
