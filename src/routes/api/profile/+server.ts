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

		const battleCount = await battlesCollection.countDocuments({
			$or: [{ creatorId: new ObjectId(userId) }, { opponentId: new ObjectId(userId) }]
		});

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
				battleCount
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
