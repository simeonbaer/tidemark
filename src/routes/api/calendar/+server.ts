import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const month = url.searchParams.get('month');
		const year = url.searchParams.get('year');

		if (!userId || !month || !year) {
			return json({ message: 'User ID, month, and year are required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const battlesCollection = db.collection('battles');

		// Get start and end dates for the month
		const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
		const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

		const battles = await battlesCollection
			.find({
				userId: new ObjectId(userId),
				createdAt: {
					$gte: startDate,
					$lte: endDate
				}
			})
			.toArray();

		// Group by date
		const eventMap = new Map<string, number>();
		battles.forEach(battle => {
			const dateStr = battle.createdAt.toISOString().split('T')[0];
			eventMap.set(dateStr, (eventMap.get(dateStr) || 0) + 1);
		});

		// Convert to array
		const events = Array.from(eventMap, ([date, count]) => ({ date, count }));

		return json(events);
	} catch (error) {
		console.error('Error fetching calendar data:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
