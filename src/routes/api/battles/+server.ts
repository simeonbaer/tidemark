import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const opponentId = url.searchParams.get('opponentId');

		if (!opponentId) {
			return json({ message: 'Opponent ID is required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');
		const usersCollection = db.collection('users');

		// Get opponent's user info
		const opponent = await usersCollection.findOne({ _id: new ObjectId(opponentId) });

		if (!opponent) {
			return json({ message: 'Opponent not found' }, { status: 404 });
		}

		// Get opponent's total distance and recent activities
		const activities = await activitiesCollection
			.find({ userId: new ObjectId(opponentId) })
			.sort({ date: -1 })
			.limit(20)
			.toArray();

		const totalDistance = activities.reduce((sum, act) => sum + (act.distance || 0), 0);
		const totalDuration = activities.reduce((sum, act) => sum + (act.duration || 0), 0);

		return json({
			opponent: {
				_id: opponent._id.toString(),
				username: opponent.username,
				skillLevel: opponent.skillLevel
			},
			stats: {
				totalDistance,
				totalDuration,
				activityCount: activities.length
			},
			recentActivities: activities.map((a) => ({
				_id: a._id.toString(),
				distance: a.distance || 0,
				duration: a.duration || 0,
				date: a.date,
				notes: a.notes || ''
			}))
		});
	} catch (error) {
		console.error('Error fetching opponent stats:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
