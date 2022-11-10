import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
	await mongoClient.connect()
} catch (error) {
	console.log(error)
}

let db = mongoClient.db("")



app.listen(5000, () => console.log("Server running in port 5000"));