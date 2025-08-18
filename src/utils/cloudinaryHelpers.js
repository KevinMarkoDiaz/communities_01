// utils/cloudinaryHelpers.js
export function isCloudinaryUrl(url = "") {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("res.cloudinary.com") &&
      u.pathname.includes("/upload/")
    );
  } catch {
    return false;
  }
}

export function getCloudinaryPublicId(url = "") {
  try {
    // Ej: /<cloud>/image/upload/v1712345678/carpeta/sub/abcd1234.jpg
    const path = new URL(url).pathname;
    const afterUpload = path.split("/upload/")[1]; // v1712345678/carpeta/sub/abcd1234.jpg
    const parts = afterUpload.split("/");
    // quita versión vNNN
    if (parts[0].startsWith("v") && /^\d+$/.test(parts[0].slice(1)))
      parts.shift();
    const file = parts.pop(); // abcd1234.jpg
    const name = file.replace(/\.[^.]+$/, ""); // abcd1234
    const folder = parts.join("/"); // carpeta/sub
    return folder ? `${folder}/${name}` : name;
  } catch {
    return null;
  }
}
