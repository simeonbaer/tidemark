import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const startDate = url.searchParams.get('startDate');
		const endDate = url.searchParams.get('endDate');

		if (!userId) {
			return json({ message: 'User ID is required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');

		const query: Record<string, unknown> = { userId: new ObjectId(userId) };

		// Add date range filtering if provided
		if (startDate || endDate) {
			query.date = {};
			if (startDate) {
				(query.date as Record<string, unknown>).$gte = new Date(startDate);
			}
			if (endDate) {
				(query.date as Record<string, unknown>).$lte = new Date(endDate);
			}
		}

		const activities = await activitiesCollection
			.find(query)
			.sort({ date: -1 })
			.limit(100)
			.toArray();

		return json(
			activities.map((a) => ({
				_id: a._id.toString(),
				userId: a.userId.toString(),
				distance: a.distance || 0,
				duration: a.duration || 0,
				date: a.date,
				notes: a.notes || '',
				createdAt: a.createdAt
			}))
		);
	} catch (error) {
		console.error('Error fetching activities:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, distance, duration, date, notes } = await request.json();

		if (!userId || distance === undefined || duration === undefined || !date) {
			return json({ message: 'Missing required fields: userId, distance, duration, date' }, { status: 400 });
		}

		if (typeof distance !== 'number' || distance < 0) {
			return json({ message: 'Distance must be a non-negative number' }, { status: 400 });
		}

		if (typeof duration !== 'number' || duration < 0) {
			return json({ message: 'Duration must be a non-negative number' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');

		const result = await activitiesCollection.insertOne({
			userId: new ObjectId(userId),
			distance: Math.round(distance),
			duration: Math.round(duration),
			date: new Date(date),
			notes: notes || '',
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
