import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const excludeUserId = url.searchParams.get('excludeUserId');

		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');

		const query: Record<string, unknown> = {};
		if (excludeUserId) {
			try {
				query._id = { $ne: new ObjectId(excludeUserId) };
			} catch {
				return json({ message: 'Invalid user ID format' }, { status: 400 });
			}
		}

		const users = await usersCollection
			.find(query)
			.project({ _id: 1, username: 1, skillLevel: 1 })
			.sort({ username: 1 })
			.toArray();

		return json(
			users.map((u) => ({
				_id: u._id.toString(),
				username: u.username,
				skillLevel: u.skillLevel
			}))
		);
	} catch (error) {
		console.error('Error fetching users:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
