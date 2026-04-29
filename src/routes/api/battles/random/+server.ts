import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async () => {
	try {
		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');

		// Get all users
		const users = await usersCollection.find({}).toArray();

		if (users.length < 2) {
			return json({ message: 'Not enough users for a battle' }, { status: 400 });
		}

		// Pick two random users
		const swimmer1 = users[Math.floor(Math.random() * users.length)];
		let swimmer2 = users[Math.floor(Math.random() * users.length)];

		while (swimmer2._id.toString() === swimmer1._id.toString() && users.length > 1) {
			swimmer2 = users[Math.floor(Math.random() * users.length)];
		}

		return json({
			_id: new ObjectId().toString(),
			swimmer1: {
				_id: swimmer1._id.toString(),
				name: swimmer1.name,
				stats: swimmer1.stats || { wins: 0, losses: 0, draws: 0 }
			},
			swimmer2: {
				_id: swimmer2._id.toString(),
				name: swimmer2.name,
				stats: swimmer2.stats || { wins: 0, losses: 0, draws: 0 }
			},
			date: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error fetching random battle:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
