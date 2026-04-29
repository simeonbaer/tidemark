import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');

		if (!userId) {
			return json({ message: 'User ID is required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');

		const activities = await activitiesCollection
			.find({ userId: new ObjectId(userId) })
			.sort({ createdAt: -1 })
			.limit(50)
			.toArray();

		return json(activities.map(a => ({
			_id: a._id.toString(),
			userId: a.userId.toString(),
			swimmer1: a.swimmer1,
			swimmer2: a.swimmer2,
			winnerId: a.winnerId ? a.winnerId.toString() : null,
			sliderValue: a.sliderValue,
			createdAt: a.createdAt
		})));
	} catch (error) {
		console.error('Error fetching activities:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, swimmer1, swimmer2, winnerId } = await request.json();

		if (!userId || !swimmer1 || !swimmer2) {
			return json({ message: 'Missing required fields' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');

		const result = await activitiesCollection.insertOne({
			userId: new ObjectId(userId),
			swimmer1,
			swimmer2,
			winnerId: winnerId && winnerId !== 'draw' ? winnerId : null,
			sliderValue: 50,
			createdAt: new Date()
		});

		return json(
			{
				activityId: result.insertedId.toString(),
				message: 'Activity logged successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating activity:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
