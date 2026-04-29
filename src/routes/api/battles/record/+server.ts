import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, swimmer1Id, swimmer2Id, winnerId, sliderValue } = await request.json();

		if (!userId || !swimmer1Id || !swimmer2Id) {
			return json({ message: 'Missing required fields' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const battlesCollection = db.collection('battles');
		const usersCollection = db.collection('users');

		// Record the battle
		const battleResult = await battlesCollection.insertOne({
			userId: new ObjectId(userId),
			swimmer1Id: new ObjectId(swimmer1Id),
			swimmer2Id: new ObjectId(swimmer2Id),
			winnerId: winnerId ? new ObjectId(winnerId) : null,
			sliderValue,
			createdAt: new Date()
		});

		// Update user stats
		if (winnerId) {
			const winner = await usersCollection.findOne({ _id: new ObjectId(winnerId) });
			const loser =
				winnerId === swimmer1Id
					? await usersCollection.findOne({ _id: new ObjectId(swimmer2Id) })
					: await usersCollection.findOne({ _id: new ObjectId(swimmer1Id) });

			if (winner) {
				await usersCollection.updateOne(
					{ _id: new ObjectId(winnerId) },
					{
						$inc: { 'stats.wins': 1 }
					}
				);
			}

			if (loser) {
				const loserId =
					winnerId === swimmer1Id ? new ObjectId(swimmer2Id) : new ObjectId(swimmer1Id);
				await usersCollection.updateOne(
					{ _id: loserId },
					{
						$inc: { 'stats.losses': 1 }
					}
				);
			}
		} else {
			// Draw
			await usersCollection.updateOne(
				{ _id: new ObjectId(swimmer1Id) },
				{ $inc: { 'stats.draws': 1 } }
			);
			await usersCollection.updateOne(
				{ _id: new ObjectId(swimmer2Id) },
				{ $inc: { 'stats.draws': 1 } }
			);
		}

		return json(
			{
				battleId: battleResult.insertedId.toString(),
				message: 'Battle recorded successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error recording battle:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
