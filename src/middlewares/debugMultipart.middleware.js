// middlewares/debugMultipart.middleware.js
export function debugMultipart(req, res, next) {
  console.log("🧩 BODY KEYS:", Object.keys(req.body));
  console.log("🧩 FILES KEYS:", req.files ? Object.keys(req.files) : []);
  if (req.files?.featuredImage?.[0]) {
    console.log(
      "🖼️ featuredImage fieldname:",
      req.files.featuredImage[0].fieldname
    );
    console.log(
      "🖼️ featuredImage originalname:",
      req.files.featuredImage[0].originalname
    );
  }
  next();
}
