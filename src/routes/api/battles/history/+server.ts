import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const opponentId = url.searchParams.get('opponentId');

		if (!userId || !opponentId) {
			return json({ message: 'userId and opponentId are required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const battlesCollection = db.collection('battles');
		const activitiesCollection = db.collection('activities');
		const usersCollection = db.collection('users');

		const battles = await battlesCollection
			.find({
				$or: [
					{ creatorId: new ObjectId(userId), opponentId: new ObjectId(opponentId) },
					{ creatorId: new ObjectId(opponentId), opponentId: new ObjectId(userId) }
				],
				status: 'completed'
			})
			.sort({ completedAt: -1, createdAt: -1 })
			.limit(5)
			.toArray();

		if (battles.length === 0) {
			return json([]);
		}

		// Get opponent user info once
		const opponentUser = await usersCollection.findOne({ _id: new ObjectId(opponentId) });

		const enriched = await Promise.all(
			battles.map(async (battle) => {
				// Distances for both users since battle start
				const [userActs, oppActs] = await Promise.all([
					activitiesCollection
						.find({ userId: new ObjectId(userId), date: { $gte: battle.createdAt } })
						.toArray(),
					activitiesCollection
						.find({ userId: new ObjectId(opponentId), date: { $gte: battle.createdAt } })
						.toArray()
				]);

				const yourDistance = userActs.reduce((sum, a) => sum + (a.distance || 0), 0);
				const oppDistance = oppActs.reduce((sum, a) => sum + (a.distance || 0), 0);

				const winnerId = battle.winnerId?.toString() || null;

				return {
					_id: battle._id.toString(),
					distanceGoal: battle.distanceGoal,
					bet: battle.bet || '',
					createdAt: battle.createdAt,
					completedAt: battle.completedAt || null,
					winnerId,
					yourDistance,
					opponentDistance: oppDistance,
					opponent: opponentUser
						? {
								_id: opponentUser._id.toString(),
								username: opponentUser.username,
								profilePicture: opponentUser.profilePicture || null
							}
						: null
				};
			})
		);

		return json(enriched);
	} catch (error) {
		console.error('Error fetching battle history:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
