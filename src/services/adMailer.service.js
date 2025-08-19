// src/services/adMailer.service.js
import transporter from "../libs/mailer.js";
import User from "../models/user.model.js"; // ajusta si difiere
import AdEmailThrottle from "../models/adEmailThrottle.model.js";

const appUrl = process.env.FRONTEND_URL || "https://app.communidades.com";
const from =
  process.env.EMAIL_FROM || "Communidades <no-reply@communidades.com>";
const adminEnvList = (process.env.ADMIN_ALERT_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ------------------------- BRAND CONFIG ------------------------- */
const BRAND = {
  name: "Communidades",
  tagline: "Conecta con tu comunidad latina",
  logoUrl: "https://dev.communidades.com/images/logo.png", // pon aquí tu URL real del logo (PNG transparente ~200x48)
  accentColor: "#fb923c",
  textColor: "#111111",
  bgColor: "#f6f7fb",
  cardBg: "#ffffff",
  footerText: "#6b7280",
  // Links del footer (opcionales)
  website: "https://communidades.com",
  instagram: "https://www.instagram.com/communidades",
  facebook: "https://www.facebook.com/communidades",
  x: "https://x.com/communidades",
  // Dirección legal (opcional, ayuda a la entregabilidad)
  address: "Dallas–Fort Worth, TX, USA",
};

/* --------------------------- HELPERS ---------------------------- */
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(cents = 0, currency = "USD", locale = "es-US") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format((Number(cents) || 0) / 100);
  } catch {
    return `${(Number(cents) || 0) / 100} ${currency?.toUpperCase() || "USD"}`;
  }
}

function formatDate(d, locale = "es-US") {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function utm(url, params = {}) {
  const u = new URL(url);
  const q = u.searchParams;
  Object.entries({
    utm_source: "email",
    utm_medium: "notification",
    utm_campaign: "ads",
    ...params,
  }).forEach(([k, v]) => q.set(k, v));
  return u.toString();
}

/**
 * Botón bulletproof para Outlook (VML) + HTML normal
 */
function renderButton({ href, label, brand = BRAND }) {
  const color = brand.accentColor || "#fb923c";
  const text = "#111111";
  const safeLabel = escapeHtml(label || "Abrir");
  const safeHref = escapeHtml(href || "#");

  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="16%" stroke="f" fillcolor="${color}">
    <w:anchorlock/>
    <center style="color:${text};font-family:Segoe UI, Arial, sans-serif;font-size:14px;font-weight:700;">
      ${safeLabel}
    </center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${safeHref}" target="_blank"
     style="display:inline-block;padding:12px 18px;font-weight:700;text-decoration:none;border-radius:10px;background:${color};color:${text};">
    ${safeLabel}
  </a>
  <!--<![endif]-->`;
}

/**
 * Layout base reutilizable para todos los correos
 */
function renderEmailShell({ subject, preheader, innerHtml, brand = BRAND }) {
  const {
    name,
    tagline,
    logoUrl,
    bgColor,
    cardBg,
    textColor,
    footerText,
    website,
    instagram,
    facebook,
    x,
    address,
  } = brand;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject || name)}</title>
    <style>
      body,table,td,a { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
      table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
      table { border-collapse:collapse !important; }
      body { margin:0 !important; padding:0 !important; width:100% !important; background:${bgColor}; }
      .text, .muted { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; }
      @media screen and (max-width: 600px) {
        .container { width:100% !important; }
        .px-24 { padding-left:16px !important; padding-right:16px !important; }
        .py-24 { padding-top:16px !important; padding-bottom:16px !important; }
        .btn { width:100% !important; }
      }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0b0b !important; }
        .card { background:#111111 !important; }
        .text { color:#e5e7eb !important; }
        .muted { color:#9ca3af !important; }
        .brandbar { background:#111111 !important; color:#ffffff !important; }
        .divider { border-top-color:#222 !important; }
      }
    </style>
  </head>
  <body style="background:${bgColor};">
    <div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(preheader || "")}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" class="px-24" style="padding:24px;">
          <table role="presentation" width="560" class="container" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
            <tr>
              <td class="brandbar" style="background:#111111;color:#ffffff;padding:18px 20px;border-radius:12px 12px 0 0;">
                <table role="presentation" width="100%">
                  <tr>
                    <td align="left">
                      <img src="${escapeHtml(logoUrl || "")}" alt="${escapeHtml(
    name
  )}" height="28" style="display:block;height:28px;">
                    </td>
                    <td align="right" class="muted" style="font-size:12px;color:#e5e7eb;">
                      ${escapeHtml(tagline || "")}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="card px-24 py-24" style="background:${cardBg};padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
                <div class="text" style="color:${textColor};font-size:16px;">
                  ${innerHtml}
                  <hr class="divider" style="border:none;border-top:1px solid #eee;margin:24px 0;">
                  <p class="muted" style="margin:0 0 6px 0;font-size:12px;color:${footerText};">
                    Este correo se envió por una acción en tu cuenta de ${escapeHtml(
                      name
                    )}.
                  </p>
                  <p class="muted" style="margin:0;font-size:12px;color:${footerText};">
                    © ${new Date().getFullYear()} ${escapeHtml(name)}${
    address ? `. ${escapeHtml(address)}` : ""
  }
                  </p>
                  ${
                    website || instagram || facebook || x
                      ? `<p class="muted" style="margin:8px 0 0 0;font-size:12px;color:${footerText};">
                         ${
                           website
                             ? `<a href="${escapeHtml(
                                 website
                               )}" style="color:${footerText};text-decoration:underline;">Web</a>`
                             : ""
                         }${
                          instagram
                            ? ` · <a href="${escapeHtml(
                                instagram
                              )}" style="color:${footerText};text-decoration:underline;">Instagram</a>`
                            : ""
                        }${
                          facebook
                            ? ` · <a href="${escapeHtml(
                                facebook
                              )}" style="color:${footerText};text-decoration:underline;">Facebook</a>`
                            : ""
                        }${
                          x
                            ? ` · <a href="${escapeHtml(
                                x
                              )}" style="color:${footerText};text-decoration:underline;">X</a>`
                            : ""
                        }
                       </p>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ----------------------- ADMIN RECIPIENTS ----------------------- */
async function getAdminRecipients() {
  if (adminEnvList.length) {
    return adminEnvList.map((email) => ({ email, name: "Admin" }));
  }
  const admins = await User.find({ role: "admin", isVerified: true })
    .select("email name")
    .lean();
  return admins.map((a) => ({ email: a.email, name: a.name || "Admin" }));
}

/* ===================== 1) Alert a Admin: SUBMIT ===================== */
export async function sendAdSubmittedAdminAlert({
  banner,
  submitter,
  brand = BRAND,
}) {
  const recipients = await getAdminRecipients();
  if (!recipients.length) return;

  const subject = `Nuevo banner enviado: ${banner?.title || "Sin título"}`;
  const reviewUrl = utm(`${appUrl}dashboard-admin/banners`, {
    utm_campaign: "ads_admin",
    utm_content: "submitted",
  });
  const preheader = `${
    submitter?.name || "Usuario"
  } envió un banner para revisión`;

  const innerHtml = `
    <p style="margin:0 0 12px 0;">
      <strong>${escapeHtml(
        submitter?.name || "Usuario"
      )}</strong> envió un banner para revisión.
    </p>
    <p style="margin:12px 0 0"><strong>Título:</strong> ${escapeHtml(
      banner?.title || "—"
    )}</p>
    <p style="margin:4px 0 12px"><strong>Placement:</strong> ${escapeHtml(
      banner?.placement || "—"
    )}</p>
    ${
      banner?.imageUrl
        ? `<p style="margin:0 0 16px 0;">
             <img src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(
            banner?.imageAlt || banner?.title || ""
          )}" style="max-width:100%;border-radius:8px;border:1px solid #eee"/>
           </p>`
        : ""
    }
    ${renderButton({ href: reviewUrl, label: "Revisar banner", brand })}
    <p class="muted" style="margin:16px 0 0 0;font-size:12px;">
      ID: ${escapeHtml(String(banner?._id || ""))}
    </p>
  `;

  const html = renderEmailShell({ subject, preheader, innerHtml, brand });

  const text = [
    `${submitter?.name || "Usuario"} envió un banner para revisión.`,
    `Título: ${banner?.title || "—"}`,
    `Placement: ${banner?.placement || "—"}`,
    `Revisar: ${reviewUrl}`,
    `ID: ${banner?._id || ""}`,
  ].join("\n");

  await Promise.allSettled(
    recipients.map((r) =>
      transporter.sendMail({ from, to: r.email, subject, text, html })
    )
  );
}

/* ============ 2) Confirmación al usuario: RECIBIDO/PENDIENTE ============ */
export async function sendAdSubmittedUserReceipt({
  banner,
  user,
  brand = BRAND,
}) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "submitted",
    10
  );
  if (!can) return;

  const subject = `Recibimos tu banner: ${banner?.title || "Sin título"}`;
  const statusUrl = utm(`${appUrl}dashboard/mis-banners`, {
    utm_content: "submitted_receipt",
  });
  const preheader = `Tu banner está pendiente de aprobación. Te avisaremos por email.`;

  const innerHtml = `
    <p style="margin:0 0 12px 0;">Hola ${escapeHtml(user?.name || "")},</p>
    <p style="margin:0 0 16px 0;">
      Tu banner <strong>"${escapeHtml(
        banner?.title || "—"
      )}"</strong> fue recibido y está
      <strong>pendiente de aprobación</strong>. Te avisaremos cuando tengamos una respuesta.
    </p>
    ${renderButton({ href: statusUrl, label: "Ver estado", brand })}
    <p class="muted" style="margin:16px 0 0 0;font-size:12px;">
      ID: ${escapeHtml(String(banner?._id || ""))}
    </p>
  `;

  const html = renderEmailShell({ subject, preheader, innerHtml, brand });

  const text = [
    `Hola ${user?.name || ""},`,
    `Tu banner "${
      banner?.title || "—"
    }" fue recibido y está pendiente de aprobación.`,
    `Ver estado: ${statusUrl}`,
    `ID: ${banner?._id || ""}`,
  ].join("\n");

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "submitted");
}

/* ================= 3) Aprobado: CTA a pagar (Stripe) ================= */
export async function sendAdApprovedUserEmail({ banner, user, brand = BRAND }) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "approved",
    10
  );
  if (!can) return;

  const subject = `Tu banner fue aprobado: ${banner?.title || "Sin título"}`;
  const payUrl = utm(`${appUrl}dashboard/mis-banners`, {
    utm_content: "approved_pay",
  });
  const preheader = `Completa el pago para publicar tu banner.`;

  const amount = formatMoney(
    banner?.priceCents || 0,
    banner?.currency || "USD"
  );

  const innerHtml = `
    <p style="margin:0 0 12px 0;">Hola ${escapeHtml(user?.name || "")},</p>
    <p style="margin:0 0 8px 0;">
      Tu banner <strong>"${escapeHtml(
        banner?.title || "—"
      )}"</strong> fue <strong>aprobado</strong>.
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>Monto:</strong> ${escapeHtml(amount)}
    </p>
    ${renderButton({ href: payUrl, label: "Ir a pagar", brand })}
    <p class="muted" style="margin:16px 0 0 0;font-size:12px;">
      ID: ${escapeHtml(String(banner?._id || ""))}
    </p>
  `;

  const html = renderEmailShell({ subject, preheader, innerHtml, brand });

  const text = [
    `Hola ${user?.name || ""},`,
    `Tu banner "${banner?.title || "—"}" fue aprobado.`,
    `Monto: ${amount}`,
    `Pagar: ${payUrl}`,
    `ID: ${banner?._id || ""}`,
  ].join("\n");

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "approved");
}

/* ============== 4) Publicado: confirmación al usuario ============== */
export async function sendAdPublishedUserEmail({
  banner,
  user,
  brand = BRAND,
}) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "published",
    10
  );
  if (!can) return;

  const subject = `¡Tu banner ya está publicado!`;
  const detailsUrl = utm(`${appUrl}dashboard/mis-banners`, {
    utm_content: "published",
  });
  const preheader = `Tu campaña está activa. Revisa fechas y detalles.`;

  const innerHtml = `
    <p style="margin:0 0 12px 0;">Hola ${escapeHtml(user?.name || "")},</p>
    <p style="margin:0 0 12px 0;">
      Tu banner <strong>"${escapeHtml(
        banner?.title || "—"
      )}"</strong> ya está <strong>publicado</strong> 🎉
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>Vigencia:</strong> ${escapeHtml(
        formatDate(banner?.startAt)
      )} a ${escapeHtml(formatDate(banner?.endAt))}
    </p>
    ${renderButton({ href: detailsUrl, label: "Ver detalles", brand })}
  `;

  const html = renderEmailShell({ subject, preheader, innerHtml, brand });

  const text = [
    `Hola ${user?.name || ""},`,
    `Tu banner "${banner?.title || "—"}" ya está publicado.`,
    `Vigencia: ${formatDate(banner?.startAt)} a ${formatDate(banner?.endAt)}`,
    `Ver detalles: ${detailsUrl}`,
  ].join("\n");

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "published");
}
