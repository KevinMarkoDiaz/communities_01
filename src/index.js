import app from "./app.js";
import { connectDB } from "./db.js"
import dotenv from 'dotenv';
const PORT = process.env.PORT || 3000;

dotenv.config();
connectDB()

app.listen(PORT, () => {
  console.log(`🚀 Server on port #${PORT}`);
});