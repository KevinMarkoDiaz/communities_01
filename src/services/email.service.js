import transporter from "../libs/mailer.js";

const appUrl = process.env.FRONTEND_URL || "https://app.communidades.com";
const from =
  process.env.EMAIL_FROM || "Communidades <no-reply@communidades.com>";

export async function sendNewMessageEmail({
  to,
  recipientName,
  senderName,
  preview,
  conversationId,
}) {
  const subject = `Nuevo mensaje de ${senderName} en Communidades`;
  const url = `${appUrl}/inbox/conversation/${conversationId}`;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="max-width:560px;margin:24px auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:20px 24px">
        <strong>Communidades</strong>
      </div>
      <div style="padding:24px">
        <p>Hola ${recipientName || ""},</p>
        <p><strong>${senderName}</strong> te envió un mensaje:</p>
        <blockquote style="margin:16px 0;padding:12px 16px;background:#f8f8f8;border-left:4px solid #fb923c">
          ${escapeHtml(preview || "")}
        </blockquote>
        <a href="${url}" style="display:inline-block;padding:12px 16px;background:#fb923c;color:#111;text-decoration:none;border-radius:10px;font-weight:600">
          Abrir conversación
        </a>
        <p style="font-size:12px;color:#666;margin-top:20px">
          Si no quieres recibir estos correos, desactiva las notificaciones por email en tu perfil.
        </p>
      </div>
    </div>
  </div>`;

  const text = `Nuevo mensaje de ${senderName}:\n\n"${(preview || "").slice(
    0,
    200
  )}"\n\nAbrir conversación: ${url}`;

  return transporter.sendMail({ from, to, subject, text, html });
}

// util mínima para no inyectar HTML
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
