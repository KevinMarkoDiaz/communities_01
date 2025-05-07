import mongoose from "mongoose";

export const connectDB = async () => { 
    try { 
        await mongoose.connect("mongodb+srv://kevindi0695:4QQLHkcdD6n6m6jO@cluster0.fbzpdiu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
console.log('db is conected')
    } catch(error){
        console.log(error)
    }
};