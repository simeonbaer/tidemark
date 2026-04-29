import { MongoClient, Db } from 'mongodb';
import 'dotenv/config';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
	if (cachedClient && cachedDb) {
		return { client: cachedClient, db: cachedDb };
	}

	const MONGODB_URI = process.env.MONGODB_URI;

	if (!MONGODB_URI) {
		throw new Error('MONGODB_URI environment variable is not defined');
	}

	const client = new MongoClient(MONGODB_URI);

	await client.connect();
	const db = client.db('Tidemark');

	cachedClient = client;
	cachedDb = db;

	return { client, db };
}

export async function closeDatabase(): Promise<void> {
	if (cachedClient) {
		await cachedClient.close();
		cachedClient = null;
		cachedDb = null;
	}
}

export function getDatabase(): Db {
	if (!cachedDb) {
		throw new Error('Database not connected. Call connectToDatabase() first.');
	}
	return cachedDb;
}
