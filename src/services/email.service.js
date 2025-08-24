import transporter from "../libs/mailer.js";

const appUrl = process.env.FRONTEND_URL || "https://communidades.com/";
const from = process.env.EMAIL_FROM;

// Defaults de marca
const BRAND = {
  name: "Communidades",
  tagline: "Conecta con tu comunidad latina",
  logoUrl: "https://dev.communidades.com/images/logo.png",
  accentColor: "#fb923c",
  textColor: "#111111",
  bgColor: "#f6f7fb",
  cardBg: "#ffffff",
  footerText: "#6b7280",
};

// 👉 Constante de ilustración
const illustrationUrl = "https://dev.communidades.com/images/ilusta.png";

export async function sendNewMessageEmail({
  to,
  recipientName,
  senderName,
  preview,
  conversationId,
  brand = BRAND,
  unsubscribeUrl,
}) {
  const subject = `Nuevo mensaje de ${senderName} en ${brand.name}`;
  const url = `${appUrl}dashboard/inbox/conversation/${conversationId}`;

  const safePreview = escapeHtml(preview || "");
  const preheader = `Tienes un nuevo mensaje de ${senderName}. Abre la conversación en ${brand.name}.`;

  const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
    <style>
      body,table,td,a { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
      table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
      table { border-collapse:collapse !important; }
      body { margin:0 !important; padding:0 !important; width:100% !important; background:${
        brand.bgColor
      }; }
      @media screen and (max-width: 600px) { .container { width:100% !important; } .px-24 { padding-left:16px !important; padding-right:16px !important; } .py-24 { padding-top:16px !important; padding-bottom:16px !important; } .btn { width:100% !important; } }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0b0b !important; }
        .card { background:#111111 !important; }
        .text { color:#e5e7eb !important; }
        .muted { color:#9ca3af !important; }
        .brandbar { background:#111111 !important; color:#ffffff !important; }
      }
      .text, .muted { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; }
    </style>
  </head>
  <body style="background:${brand.bgColor};">
    <div style="display:none; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all;">
      ${escapeHtml(preheader)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" class="px-24" style="padding:24px;">
          <table role="presentation" width="560" class="container" cellpadding="0" cellspacing="0" style="width:560px; max-width:560px;">
            <!-- Brand bar -->
            <tr>
              <td class="brandbar" style="background:#111111; color:#ffffff; padding:18px 20px; border-radius:12px 12px 0 0;">
                <table role="presentation" width="100%">
                  <tr>
                    <td align="left">
                      <img src="${brand.logoUrl}" alt="${escapeHtml(
    brand.name
  )}" height="28" style="display:block; height:28px;">
                    </td>
                    <td align="right" class="muted" style="font-size:12px; color:#e5e7eb;">
                      ${escapeHtml(brand.tagline)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Ilustración -->
            <tr>
              <td align="center" style="padding:20px 0;">
                <img src="${illustrationUrl}" alt="Ilustración" width="100%" style="max-width:500px; height:auto; display:block; margin:0 auto;" />
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td class="card px-24 py-24" style="background:${
                brand.cardBg
              }; padding:24px; border:1px solid #e5e7eb; border-top:0; border-radius:0 0 12px 12px;">
                <div class="text" style="color:${
                  brand.textColor
                }; font-size:16px;">
                  <p style="margin:0 0 12px 0;">Hola ${escapeHtml(
                    recipientName || ""
                  )},</p>
                  <p style="margin:0 0 16px 0;">
                    <strong>${escapeHtml(
                      senderName || "Alguien"
                    )}</strong> te envió un mensaje en <strong>${escapeHtml(
    brand.name
  )}</strong>:
                  </p>
                  <blockquote style="margin:12px 0 20px 0; padding:12px 16px; background:#f8f8f8; border-left:4px solid ${
                    brand.accentColor
                  }; border-radius:8px;">
                    ${safePreview || "<em>(sin contenido)</em>"}
                  </blockquote>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" class="btn" style="margin:0 0 8px 0;">
                    <tr>
                      <td align="center" bgcolor="${
                        brand.accentColor
                      }" style="border-radius:10px;">
                        <a href="${url}" target="_blank"
                           style="display:inline-block; padding:12px 18px; font-weight:700; text-decoration:none; border-radius:10px; color:#111111;">
                           Abrir conversación
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p class="muted" style="margin:16px 0 0 0; font-size:16px; color:#666;">
                    Consejo: responde pronto para mantener el hilo activo y mejorar la visibilidad de tu perfil.
                  </p>
                  <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
                  <p class="muted" style="margin:0 0 6px 0; font-size:12px; color:${
                    brand.footerText
                  };">
                    Este correo se envió a solicitud de una actividad en tu cuenta.
                  </p>
                  ${
                    unsubscribeUrl
                      ? `<p class="muted" style="margin:0; font-size:12px; color:${brand.footerText};">
                           <a href="${unsubscribeUrl}" style="color:${brand.footerText}; text-decoration:underline;">Gestionar notificaciones por email</a>
                         </p>`
                      : `<p class="muted" style="margin:0; font-size:12px; color:${brand.footerText};">
                           Para ajustar tus notificaciones por email, ve a <strong>Perfil &gt; Notificaciones</strong>.
                         </p>`
                  }
                </div>
              </td>
            </tr>

            <!-- Footer legal -->
            <tr>
              <td align="center" style="padding:14px 8px;">
                <p class="muted" style="margin:0; font-size:11px; color:${
                  brand.footerText
                };">
                  © ${new Date().getFullYear()} ${escapeHtml(
    brand.name
  )}. Todos los derechos reservados.
                </p>
                <p class="muted" style="margin:4px 0 0 0; font-size:11px; color:${
                  brand.footerText
                };">
                  Si no fuiste tú, ignora este correo.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hola ${recipientName || ""},`,
    ``,
    `${senderName || "Alguien"} te envió un mensaje en ${brand.name}:`,
    `"${(preview || "").slice(0, 200)}"`,
    ``,
    `Abrir conversación: ${url}`,
    ``,
    unsubscribeUrl
      ? `Gestionar notificaciones: ${unsubscribeUrl}`
      : `Ajusta tus notificaciones en Perfil > Notificaciones`,
    ``,
    `© ${new Date().getFullYear()} ${brand.name}.`,
  ].join("\n");

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

// util mínima
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
