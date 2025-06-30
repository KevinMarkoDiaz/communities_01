import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // carga las variables del .env

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB:", error.message);
    process.exit(1);
  }
};
