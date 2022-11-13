import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();

const participantsScheme = joi.object({
	name: joi.string().required(),
});
const messagesScreme = joi.object({
	to: joi.string().required(),
	text: joi.string().required(),
	type: joi.any().valid("message", "private_message").required(),
});

let mongoClient = undefined;
async function connectMongo() {
	try {
		if (mongoClient === undefined) {
			const conection = new MongoClient(process.env.MONGO_URI);
			await conection.connect();
			mongoClient = conection;
			return conection;
		} else {
			return mongoClient;
		}
	} catch (error) {
		console.log(error);
	}
}

app.post("/participants", async (req, res) => {
	const mongoClient = await connectMongo();
	const body = req.body;
	const userName = req.body.name;

	try {
		const { error } = participantsScheme.validate(body);
		if (error) return res.sendStatus(422).send(error.details.map((e) => e.message));

		const isLoggedIn = await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.findOne({ name: userName });
		if (isLoggedIn) return res.sendStatus(409);

		await mongoClient.db("batepapoUol").collection("participants").insertOne({
			name: userName,
			lastStatus: Date.now(),
		});
		res.sendStatus(201);
	} catch (error) {
		res.sendStatus(422);
	}
});

app.get("/participants", async (req, res) => {
	const mongoClient = await connectMongo();
	try {
		const partList = await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.find({})
			.toArray();

		res.status(201).send(partList);
	} catch {
		res.sendStatus(422);
	}
});

app.post("/messages", async (req, res) => {
	const mongoClient = await connectMongo();
	const body = req.body;
	const { user } = req.headers;

	try {
		const { error } = messagesScreme.validate(body);
		if (error) return res.status(422).send(error.details.map((e) => e.message));

		const userExists = await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.findOne({ name: user });
		if (!userExists) return res.status(422).send({message: "User is not registered"});

		await mongoClient.db("batepapoUol").collection("messages").insertOne({
			from: user, 
			to: body.to, 
			text: body.text, 
			type: body.type, 
			time: dayjs(Date.now()).format('HH:mm:ss')
		});
		res.status(201).send({message: "Message sent successfully"})
	} catch(error) {
		console.log(error)
	}
});
app.listen(5000);
