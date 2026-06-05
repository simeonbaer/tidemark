import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async () => {
	try {
		const { db } = await connectToDatabase();

		const now = new Date();
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		// Aggregate total distance per user for the current calendar month
		const pipeline = [
			{ $match: { date: { $gte: thisMonthStart } } },
			{
				$group: {
					_id: '$userId',
					totalDistance: { $sum: { $ifNull: ['$distance', 0] } }
				}
			},
			{ $match: { totalDistance: { $gt: 0 } } },
			{ $sort: { totalDistance: -1 } },
			{ $limit: 5 }
		];

		const topEntries = await db.collection('activities').aggregate(pipeline).toArray();

		// Enrich with user info
		const entries = await Promise.all(
			topEntries.map(async (entry, idx) => {
				const uid = entry._id?.toString();
				const user = uid
					? await db.collection('users').findOne(
							{ _id: new ObjectId(uid) },
							{ projection: { username: 1, profilePicture: 1 } }
						)
					: null;
				return {
					rank: idx + 1,
					userId: uid || '',
					username: user?.username || 'Unknown',
					profilePicture: user?.profilePicture || null,
					totalDistance: entry.totalDistance
				};
			})
		);

		return json(entries);
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
