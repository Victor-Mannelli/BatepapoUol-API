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

	try {
		const { error } = participantsScheme.validate(body);
		if (error)
			return res.sendStatus(422).send(error.details.map((e) => e.message));

		const isLoggedIn = await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.findOne({ name: body.name });
		if (isLoggedIn) return res.sendStatus(409);

		await mongoClient.db("batepapoUol").collection("participants").insertOne({
			name: body.name,
			lastStatus: Date.now(),
		});
		res.status(201).send({ message: "User created successfully" });
	} catch (error) {
		res.status(422).send(error);
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
		if (!userExists)
			return res.status(422).send({ message: "User is not registered" });

		await mongoClient
			.db("batepapoUol")
			.collection("messages")
			.insertOne({
				from: user,
				to: body.to,
				text: body.text,
				type: body.type,
				time: dayjs(Date.now()).format("HH:mm:ss"),
			});
		res.status(201).send({ message: "Message sent successfully" });
	} catch (error) {
		res.send(error);
	}
});

app.get("/messages", async (req, res) => {
	const mongoClient = await connectMongo();
	const limit = req.query.limit;
	const user = req.headers.user;

	try {
		const messagesList = await mongoClient
			.db("batepapoUol")
			.collection("messages")
			.find({
				$or: [
					{
						type: "status"
					},
					{
						type: "message",
					},
					{
						type: "private_message",
						to: user,
					},
				],
			})
			.toArray();

		if (limit) {
			res.status(201).send([...messagesList].reverse().slice(-limit));
		} else {
			res.status(201).send(messagesList.reverse());
		}
	} catch {
		res
			.status(422)
			.send({ message: "It wasn't possible to reach the messages list" });
	}
});

app.post("/status", async (req, res) => {
	const mongoClient = await connectMongo();
	const user = req.headers.user;

	const isOnline = await mongoClient
		.db("batepapoUol")
		.collection("participants")
		.findOne({ name: user });
	if (!isOnline) return res.sendStatus(404);

	try {
		await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.updateOne(
				{ name: user },
				{
					$set: {
						lastStatus: Date.now(),
					},
				}
			);
		res.sendStatus(200);
	} catch (error) {
		res.status(422).send(error);
	}
});

async function cleanOfflineUsers() {
	const mongoClient = await connectMongo();

	try {
		const allUsers = await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.find({})
			.toArray();

		const timeOutedUser = allUsers.filter(e =>  Date.now() - e.lastStatus > 10000)

		timeOutedUser.forEach(async e => {
			await mongoClient
			.db("batepapoUol")
			.collection("messages")
			.insertOne({
				from: e.name,
				to: "todos",
				text: "sai da sala...",
				type: "status",
				time: dayjs(Date.now()).format("HH:mm:ss")
			});

			await mongoClient
			.db("batepapoUol")
			.collection("participants")
			.deleteOne({_id: e._id})
		});
		
	} catch (error) {
		console.error(error);
	}
}

setInterval(async () => await cleanOfflineUsers(), 15000);

app.listen(5000);