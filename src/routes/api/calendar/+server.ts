import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

interface ActivityByDate {
	date: string;
	count: number;
	activities: Array<{
		_id: string;
		distance: number;
		duration: number;
		notes: string;
	}>;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const month = url.searchParams.get('month');
		const year = url.searchParams.get('year');

		if (!userId || !month || !year) {
			return json({ message: 'User ID, month, and year are required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');

		// Get start and end dates for the month
		const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
		const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

		const activities = await activitiesCollection
			.find({
				userId: new ObjectId(userId),
				date: {
					$gte: startDate,
					$lte: endDate
				}
			})
			.sort({ date: -1 })
			.toArray();

		// Group by date
		const eventMap = new Map<string, ActivityByDate>();
		activities.forEach((activity) => {
			const dateStr = activity.date
				? new Date(activity.date).toISOString().split('T')[0]
				: new Date().toISOString().split('T')[0];

			if (!eventMap.has(dateStr)) {
				eventMap.set(dateStr, {
					date: dateStr,
					count: 0,
					activities: []
				});
			}

			const dayActivities = eventMap.get(dateStr)!;
			dayActivities.count++;
			dayActivities.activities.push({
				_id: activity._id.toString(),
				distance: activity.distance || 0,
				duration: activity.duration || 0,
				notes: activity.notes || ''
			});
		});

		// Convert to array
		const events = Array.from(eventMap.values());
		return json(events);
	} catch (error) {
		console.error('Error fetching calendar data:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
