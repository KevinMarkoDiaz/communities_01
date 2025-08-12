import fs from "fs/promises";

export async function safeUnlink(
  filePath,
  { retries = 5, delayMs = 150 } = {}
) {
  for (let i = 0; i < retries; i++) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      // EPERM o EBUSY suelen resolverse con reintentos
      if (err.code === "EPERM" || err.code === "EBUSY") {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      // Otros errores: log y corta
      console.warn(`⚠️ No se pudo borrar archivo temporal: ${err.message}`);
      return false;
    }
  }
  console.warn(
    `⚠️ No se pudo borrar archivo temporal tras reintentos: ${filePath}`
  );
  return false;
}
