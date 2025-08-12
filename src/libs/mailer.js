import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE) === "true", // SSL para puerto 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function verifyMailer() {
  try {
    await transporter.verify();
    console.log("✅ Conexión SMTP verificada con Hostinger");
    return true;
  } catch (error) {
    console.error("❌ Error al conectar con SMTP:", error.message);
    return false;
  }
}

export default transporter;
