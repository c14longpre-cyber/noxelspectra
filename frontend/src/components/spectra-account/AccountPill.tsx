// Pastilles de compte de l'en-tête (même rendu que NOXEL SEO et NOXEL FORGE : médaille + avatar + menu)
import { useEffect, useRef, useState } from "react";
import { TIER_MEDAL, allerVers, deconnecter, openLogin, openPricing, useAccount } from "./account";

function initiales(nom?: string | null) {
  const p = String(nom || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

export function AccountPill() {
  const { account, loaded, accountsEnabled } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  if (!loaded || !accountsEnabled) return null;

  if (!account) {
    return <button type="button" className="nx-pill" onClick={openLogin}><span className="nx-pill__code">→</span> Se connecter</button>;
  }

  const { user, plan, credits } = account;
  return (
    <div className="nx-menu-wrap" ref={ref} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" className="nx-pill" onClick={openPricing} title={`Forfait ${plan.name}`} style={{ padding: "3px 10px 3px 4px" }}>
        <img src={TIER_MEDAL(plan.tier)} alt="" className="nx-medal" width={28} height={28} style={{ width: 28, height: 28 }} />
        <span className="nx-pill__muted" style={{ display: "inline" }}>{credits.total} crédit{credits.total > 1 ? "s" : ""}</span>
      </button>
      <button type="button" className="nx-pill nx-user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="nx-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initiales(user.name)}</span>
        <span className="nx-user__name">{user.name?.split(" ")[0] || "Compte"}</span>
        <span className="nx-caret" aria-hidden="true">▼</span>
      </button>
      {open && (
        <div className="nx-menu" role="menu">
          <div className="nx-menu__head">
            <div className="nx-menu__name">{user.name}</div>
            <div className="nx-menu__mail">{user.email}</div>
            <div className="nx-menu__mail" style={{ marginTop: 4 }}>
              Forfait {plan.name} · {plan.opsPerDay.toLocaleString("fr-CA")} opérations/jour · {credits.total} crédit{credits.total > 1 ? "s" : ""} IA
            </div>
          </div>
          <button role="menuitem" type="button" className="nx-menu__item" onClick={() => { setOpen(false); openPricing(); }}>Forfaits et crédits</button>
          {plan.tier !== "bronze" || plan.subscriptionStatus ? (
            <button role="menuitem" type="button" className="nx-menu__item" onClick={() => { setOpen(false); allerVers("/api/billing/portal").catch((e) => alert(e.message)); }}>Gérer l'abonnement</button>
          ) : null}
          <button role="menuitem" type="button" className="nx-menu__item nx-menu__item--danger" onClick={() => { setOpen(false); void deconnecter(); }}>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}
