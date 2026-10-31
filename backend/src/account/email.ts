// Courriels de connexion SPECTRA (Resend, même compte que NOXEL SEO / FORGE)
import { Resend } from "resend";

export const EMAIL_FROM = process.env.EMAIL_FROM || "NOXEL SPECTRA <noreply@noxelseo.com>";

const T = {
  fr: {
    magic: { subject: "Votre lien de connexion NOXEL SPECTRA", title: "Votre lien de connexion", desc: "Cliquez ci-dessous pour vous connecter, sans mot de passe.", cta: "Se connecter à NOXEL SPECTRA →", expiry: "Ce lien expire dans 15 minutes. Si vous n'avez rien demandé, ignorez ce courriel." },
    signup: { subject: "Confirmez votre compte NOXEL SPECTRA", title: "Confirmez votre adresse", desc: "Ouvrez ce lien pour créer votre compte NOXEL SPECTRA.", cta: "Créer mon compte →", expiry: "Ce lien expire dans 24 heures. Si vous n'avez rien demandé, ignorez ce courriel." },
  },
  en: {
    magic: { subject: "Your NOXEL SPECTRA sign-in link", title: "Your sign-in link", desc: "Click below to sign in, no password needed.", cta: "Sign in to NOXEL SPECTRA →", expiry: "This link expires in 15 minutes. If you did not request it, ignore this e-mail." },
    signup: { subject: "Confirm your NOXEL SPECTRA account", title: "Confirm your address", desc: "Open this link to create your NOXEL SPECTRA account.", cta: "Create my account →", expiry: "This link expires in 24 hours. If you did not request it, ignore this e-mail." },
  },
};

function html(url: string, t: { title: string; desc: string; cta: string; expiry: string }): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0d14;color:#f5f5f5;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#12151f;border:1px solid #1f6b4a;border-radius:14px;padding:28px">
    <div style="font-weight:900;color:#3ddc84;letter-spacing:.5px;margin-bottom:16px">NOXEL SPECTRA</div>
    <h1 style="font-size:20px;margin:0 0 10px">${esc(t.title)}</h1>
    <p style="color:#bbb;line-height:1.5">${esc(t.desc)}</p>
    <p style="margin:24px 0"><a href="${esc(url)}" style="background:#3ddc84;color:#07090f;font-weight:800;padding:12px 18px;border-radius:10px;text-decoration:none">${esc(t.cta)}</a></p>
    <p style="color:#888;font-size:12px;line-height:1.5">${esc(t.expiry)}</p>
  </div></div>`;
}

async function envoyer(to: string, url: string, kind: "magic" | "signup", lang: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[spectra/email] RESEND_API_KEY manquant : courriel non envoyé"); return false; }
  const t = (lang?.startsWith("fr") ? T.fr : T.en)[kind];
  try {
    const { error } = await new Resend(key).emails.send({ from: EMAIL_FROM, to, subject: t.subject, html: html(url, t) });
    if (error) { console.error("[spectra/email]", error); return false; }
    return true;
  } catch (e) {
    console.error("[spectra/email]", e);
    return false;
  }
}

export const sendMagicLinkEmail = (to: string, url: string, lang = "fr") => envoyer(to, url, "magic", lang);
export const sendSignupConfirmationEmail = (to: string, url: string, lang = "fr") => envoyer(to, url, "signup", lang);
