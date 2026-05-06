import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		if (!userId) {
			return json({ message: 'userId is required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');
		const activitiesCollection = db.collection('activities');
		const battlesCollection = db.collection('battles');

		const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}

		const activities = await activitiesCollection
			.find({ userId: new ObjectId(userId) })
			.toArray();

		const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
		const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);

		// Battle stats
		const allBattles = await battlesCollection
			.find({
				$or: [{ creatorId: new ObjectId(userId) }, { opponentId: new ObjectId(userId) }]
			})
			.toArray();

		const completedBattles = allBattles.filter((b) => b.status === 'completed');
		const battlesWon = completedBattles.filter((b) => b.winnerId?.toString() === userId).length;
		const battlesLost = completedBattles.filter(
			(b) => b.winnerId && b.winnerId.toString() !== userId
		).length;
		const totalDecided = battlesWon + battlesLost;
		const winRate = totalDecided > 0 ? Math.round((battlesWon / totalDecided) * 100) : 0;

		// Personal bests
		const personalBestDistance =
			activities.length > 0 ? Math.max(...activities.map((a) => a.distance || 0)) : 0;

		const activitiesWithBoth = activities.filter(
			(a) => (a.distance || 0) > 0 && (a.duration || 0) > 0
		);
		const personalBestPace =
			activitiesWithBoth.length > 0
				? Math.min(...activitiesWithBoth.map((a) => a.duration / (a.distance / 100)))
				: 0;

		// Monthly distances
		const now = new Date();
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

		const thisMonthDistance = activities
			.filter((a) => new Date(a.date) >= thisMonthStart)
			.reduce((sum, a) => sum + (a.distance || 0), 0);

		const lastMonthDistance = activities
			.filter((a) => {
				const d = new Date(a.date);
				return d >= lastMonthStart && d <= lastMonthEnd;
			})
			.reduce((sum, a) => sum + (a.distance || 0), 0);

		return json({
			_id: user._id.toString(),
			username: user.username,
			email: user.email,
			skillLevel: user.skillLevel,
			profilePicture: user.profilePicture || null,
			stats: {
				totalDistance,
				totalDuration,
				totalSwims: activities.length,
				battleCount: allBattles.length,
				battlesWon,
				battlesLost,
				winRate,
				personalBestDistance,
				personalBestPace,
				thisMonthDistance,
				lastMonthDistance
			}
		});
	} catch (error) {
		console.error('Error fetching profile:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { userId, username, skillLevel, profilePicture } = await request.json();

		if (!userId) {
			return json({ message: 'userId is required' }, { status: 400 });
		}

		const updates: Record<string, unknown> = {};
		if (username !== undefined && username !== '') updates.username = username;
		if (skillLevel !== undefined) updates.skillLevel = skillLevel;
		if (profilePicture !== undefined) updates.profilePicture = profilePicture;

		if (Object.keys(updates).length === 0) {
			return json({ message: 'No fields to update' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');

		const result = await usersCollection.updateOne(
			{ _id: new ObjectId(userId) },
			{ $set: updates }
		);

		if (result.matchedCount === 0) {
			return json({ message: 'User not found' }, { status: 404 });
		}

		return json({ message: 'Profile updated successfully' });
	} catch (error) {
		console.error('Error updating profile:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
