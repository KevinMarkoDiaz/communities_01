// src/services/adMailer.service.js
import transporter from "../libs/mailer.js";
import User from "../models/user.model.js"; // ajusta el path si difiere
import AdEmailThrottle from "../models/adEmailThrottle.model.js";

const appUrl = process.env.FRONTEND_URL || "https://app.communidades.com";
const from =
  process.env.EMAIL_FROM || "Communidades <no-reply@communidades.com>";
const adminEnvList = (process.env.ADMIN_ALERT_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Reutil util
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Busca admins: primero por env, si no hay, por DB
async function getAdminRecipients() {
  if (adminEnvList.length) {
    return adminEnvList.map((email) => ({ email, name: "Admin" }));
  }
  const admins = await User.find({ role: "admin", isVerified: true })
    .select("email name")
    .lean();
  return admins.map((a) => ({ email: a.email, name: a.name || "Admin" }));
}

/**
 * Admin alert: nuevo banner enviado por usuario
 */
export async function sendAdSubmittedAdminAlert({ banner, submitter }) {
  const recipients = await getAdminRecipients();
  if (!recipients.length) return;

  const subject = `Nuevo banner enviado: ${banner.title}`;
  const url = `${appUrl}/dashboard/ads/review?bannerId=${banner._id}`;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="max-width:560px;margin:24px auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:20px 24px"><strong>Communidades</strong></div>
      <div style="padding:24px">
        <p><strong>${escapeHtml(
          submitter?.name || "Usuario"
        )}</strong> envió un banner para revisión.</p>
        <p style="margin:12px 0 0"><strong>Título:</strong> ${escapeHtml(
          banner.title
        )}</p>
        <p style="margin:4px 0 12px"><strong>Placement:</strong> ${escapeHtml(
          banner.placement
        )}</p>
        <p><img src="${banner.imageUrl}" alt="${escapeHtml(
    banner.imageAlt || ""
  )}" style="max-width:100%;border-radius:8px;border:1px solid #eee"/></p>
        <a href="${url}" style="display:inline-block;padding:12px 16px;background:#fb923c;color:#111;text-decoration:none;border-radius:10px;font-weight:600">
          Revisar banner
        </a>
        <p style="font-size:12px;color:#666;margin-top:20px">ID: ${
          banner._id
        }</p>
      </div>
    </div>
  </div>`;

  const text =
    `Nuevo banner enviado por ${submitter?.name || "Usuario"}\n` +
    `Título: ${banner.title}\nPlacement: ${banner.placement}\n` +
    `Revisar: ${url}`;

  await Promise.allSettled(
    recipients.map((r) =>
      transporter.sendMail({
        from,
        to: r.email,
        subject,
        text,
        html,
      })
    )
  );
}

/**
 * Confirmación al usuario: “recibido, pendiente de revisión”
 */
export async function sendAdSubmittedUserReceipt({ banner, user }) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "submitted",
    10
  );
  if (!can) return;

  const subject = `Recibimos tu banner: ${banner.title}`;
  const url = `${appUrl}/dashboard/ads?bannerId=${banner._id}`;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="max-width:560px;margin:24px auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:20px 24px"><strong>Communidades</strong></div>
      <div style="padding:24px">
        <p>Hola ${escapeHtml(user?.name || "")},</p>
        <p>Tu banner <strong>"${escapeHtml(
          banner.title
        )}"</strong> fue recibido y está <strong>pendiente de aprobación</strong>.</p>
        <a href="${url}" style="display:inline-block;padding:12px 16px;background:#fb923c;color:#111;text-decoration:none;border-radius:10px;font-weight:600">
          Ver estado
        </a>
        <p style="font-size:12px;color:#666;margin-top:20px">ID: ${
          banner._id
        }</p>
      </div>
    </div>
  </div>`;

  const text =
    `Tu banner "${banner.title}" fue recibido y está pendiente de aprobación.\n` +
    `Ver estado: ${url}`;

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "submitted");
}

/**
 * Aprobado: mail al usuario con CTA a pagar
 */
export async function sendAdApprovedUserEmail({ banner, user }) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "approved",
    10
  );
  if (!can) return;

  const subject = `Tu banner fue aprobado: ${banner.title}`;
  const url = `${appUrl}/dashboard/ads?bannerId=${banner._id}&action=pay`;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="max-width:560px;margin:24px auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:20px 24px"><strong>Communidades</strong></div>
      <div style="padding:24px">
        <p>Hola ${escapeHtml(user?.name || "")},</p>
        <p>Tu banner <strong>"${escapeHtml(
          banner.title
        )}"</strong> fue <strong>aprobado</strong>. Completa el pago para publicarlo.</p>
        <p style="margin:8px 0"><strong>Monto:</strong> ${(
          banner.priceCents / 100
        ).toFixed(2)} ${banner.currency?.toUpperCase() || "USD"}</p>
        <a href="${url}" style="display:inline-block;padding:12px 16px;background:#fb923c;color:#111;text-decoration:none;border-radius:10px;font-weight:600">
          Ir a pagar
        </a>
        <p style="font-size:12px;color:#666;margin-top:20px">ID: ${
          banner._id
        }</p>
      </div>
    </div>
  </div>`;

  const text =
    `Tu banner "${banner.title}" fue aprobado.\n` +
    `Monto: ${(banner.priceCents / 100).toFixed(2)} ${
      banner.currency?.toUpperCase() || "USD"
    }\n` +
    `Pagar: ${url}`;

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "approved");
}

/**
 * Publicado: mail al usuario (disparado por webhook Stripe)
 */
export async function sendAdPublishedUserEmail({ banner, user }) {
  const can = await AdEmailThrottle.canSend(
    user._id,
    banner._id,
    "published",
    10
  );
  if (!can) return;

  const subject = `¡Tu banner ya está publicado!`;
  const url = `${appUrl}/dashboard/ads?bannerId=${banner._id}`;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111">
    <div style="max-width:560px;margin:24px auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:20px 24px"><strong>Communidades</strong></div>
      <div style="padding:24px">
        <p>Hola ${escapeHtml(user?.name || "")},</p>
        <p>Tu banner <strong>"${escapeHtml(
          banner.title
        )}"</strong> ya está <strong>publicado</strong> 🎉</p>
        <p><strong>Vigencia:</strong> ${
          banner.startAt ? new Date(banner.startAt).toLocaleDateString() : "—"
        } a ${
    banner.endAt ? new Date(banner.endAt).toLocaleDateString() : "—"
  }</p>
        <a href="${url}" style="display:inline-block;padding:12px 16px;background:#fb923c;color:#111;text-decoration:none;border-radius:10px;font-weight:600">
          Ver detalles
        </a>
      </div>
    </div>
  </div>`;

  const text =
    `Tu banner "${banner.title}" ya está publicado.\n` + `Ver detalles: ${url}`;

  await transporter.sendMail({ from, to: user.email, subject, text, html });
  await AdEmailThrottle.markSent(user._id, banner._id, "published");
}
