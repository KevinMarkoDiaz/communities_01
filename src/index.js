import dotenv from "dotenv";
dotenv.config(); // 🟢 PRIMERO, antes de cualquier otro import

import app from "./app.js";
import { connectDB } from "./db.js";

const PORT = process.env.PORT || 3000;

connectDB();

app.listen(PORT, () => {
  console.log(`🚀 Server on port #${PORT}`);
});
