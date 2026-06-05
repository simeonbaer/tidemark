import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;
		const { status } = await request.json();

		if (!['accepted', 'declined'].includes(status)) {
			return json({ message: 'Invalid status' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const result = await db
			.collection('swim_invites')
			.updateOne({ _id: new ObjectId(id) }, { $set: { status } });

		if (result.matchedCount === 0) {
			return json({ message: 'Invite not found' }, { status: 404 });
		}

		return json({ message: 'Updated successfully' });
	} catch (error) {
		console.error('Error updating invite:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
