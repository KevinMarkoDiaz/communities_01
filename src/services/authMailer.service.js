// src/services/authMailer.service.js
import transporter from "../libs/mailer.js";

const appUrl = process.env.FRONTEND_URL || "https://app.communidades.com";
const from =
  process.env.EMAIL_FROM || "Communidades <no-reply@communidades.com>";

/* ------------------------- BRAND CONFIG ------------------------- */
const BRAND = {
  name: "Communidades",
  tagline: "Conecta con tu comunidad latina",
  logoUrl: "https://dev.communidades.com/assets/icono-BU47RJ2L.svg",
  accentColor: "#fb923c",
  textColor: "#111111",
  bgColor: "#f6f7fb",
  cardBg: "#ffffff",
  footerText: "#6b7280",
  website: "https://communidades.com",
  instagram: "https://www.instagram.com/communidades",
  facebook: "https://www.facebook.com/communidades",
  x: "https://x.com/communidades",
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
function utm(url, params = {}) {
  const u = new URL(url);
  const q = u.searchParams;
  Object.entries({
    utm_source: "email",
    utm_medium: "notification",
    utm_campaign: "welcome",
    ...params,
  }).forEach(([k, v]) => q.set(k, v));
  return u.toString();
}
function renderButton({ href, label, brand = BRAND }) {
  const color = brand.accentColor || "#fb923c";
  const text = "#111111";
  const safeLabel = escapeHtml(label || "Abrir");
  const safeHref = escapeHtml(href || "#");
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="16%" stroke="f" fillcolor="${color}">
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
      .text, .muted { font-family:-apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; }
      @media screen and (max-width:600px){
        .container{ width:100% !important; }
        .px-24{ padding-left:16px !important; padding-right:16px !important; }
        .py-24{ padding-top:16px !important; padding-bottom:16px !important; }
        .btn{ width:100% !important; }
      }
      @media (prefers-color-scheme: dark){
        body{ background:#0b0b0b !important; }
        .card{ background:#111111 !important; }
        .text{ color:#e5e7eb !important; }
        .muted{ color:#9ca3af !important; }
        .brandbar{ background:#111111 !important; color:#ffffff !important; }
        .divider{ border-top-color:#222 !important; }
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
                    Este correo se envió porque creaste una cuenta en ${escapeHtml(
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
                           }
                           ${
                             instagram
                               ? ` · <a href="${escapeHtml(
                                   instagram
                                 )}" style="color:${footerText};text-decoration:underline;">Instagram</a>`
                               : ""
                           }
                           ${
                             facebook
                               ? ` · <a href="${escapeHtml(
                                   facebook
                                 )}" style="color:${footerText};text-decoration:underline;">Facebook</a>`
                               : ""
                           }
                           ${
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

/* ================== ENVÍO: Bienvenida general ================== */
export async function sendWelcomeEmail({ user, brand = BRAND }) {
  if (!user?.email) return;

  const subject = `¡Bienvenido a ${brand.name}! 🎉`;
  const preheader = `Tu cuenta está lista. Completa tu perfil y descubre negocios, eventos y comunidades.`;

  const profileUrl = utm(`${appUrl}/profile/edit`, {
    utm_content: "primary_cta",
  });
  const exploreUrl = utm(`${appUrl}/`, { utm_content: "secondary_link" });
  const createBusinessUrl = utm(`${appUrl}/businesses/new`, {
    utm_content: "business_cta",
  });
  const createEventUrl = utm(`${appUrl}/events/new`, {
    utm_content: "event_cta",
  });

  const innerHtml = `
    <p style="margin:0 0 12px 0;">Hola ${escapeHtml(user?.name || "")},</p>
    <p style="margin:0 0 12px 0;">
      ¡Gracias por unirte a <strong>${escapeHtml(brand.name)}</strong>!
      Aquí conectamos a personas y negocios de la comunidad latina con <em>servicios locales, eventos y oportunidades</em>.
    </p>
    <p style="margin:0 0 16px 0;">
      Para empezar, completa tu perfil y personaliza tu experiencia:
    </p>
    ${renderButton({ href: profileUrl, label: "Completar mi perfil", brand })}
    <p style="margin:16px 0 0 0;">
      También puedes:
      <br>• <a href="${exploreUrl}" target="_blank" style="color:#111;text-decoration:underline;">Explorar Communidades</a>
      <br>• <a href="${createBusinessUrl}" target="_blank" style="color:#111;text-decoration:underline;">Crear el perfil de tu negocio</a>
      <br>• <a href="${createEventUrl}" target="_blank" style="color:#111;text-decoration:underline;">Publicar tu primer evento</a>
    </p>
    <p style="margin:16px 0 0 0;">
      ¿Necesitas ayuda? Responde este correo y con gusto te apoyamos.
    </p>
  `;

  const html = renderEmailShell({ subject, preheader, innerHtml, brand });

  const text = [
    `Hola ${user?.name || ""},`,
    `¡Gracias por unirte a ${brand.name}!`,
    `Completa tu perfil: ${profileUrl}`,
    `Explorar: ${exploreUrl}`,
    `Crear perfil de negocio: ${createBusinessUrl}`,
    `Publicar evento: ${createEventUrl}`,
    `¿Dudas? Responde este correo y te apoyamos.`,
  ].join("\n");

  await transporter.sendMail({
    from,
    to: user.email,
    subject,
    text,
    html,
  });
}
