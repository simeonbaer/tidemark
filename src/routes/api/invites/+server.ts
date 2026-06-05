import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		if (!userId) return json({ message: 'userId required' }, { status: 400 });

		const { db } = await connectToDatabase();
		const invites = await db
			.collection('swim_invites')
			.find({ $or: [{ fromUserId: userId }, { toUserId: userId }] })
			.sort({ createdAt: -1 })
			.toArray();

		return json(invites.map((inv) => ({ ...inv, _id: inv._id.toString() })));
	} catch (error) {
		console.error('Error fetching invites:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { fromUserId, fromUsername, toUserId, toUsername, date, time, location, message } =
			await request.json();

		if (!fromUserId || !fromUsername || !toUserId || !toUsername || !date || !time || !location) {
			return json({ message: 'Missing required fields' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const invite = {
			fromUserId,
			fromUsername,
			toUserId,
			toUsername,
			date,
			time,
			location: location.trim(),
			message: message?.trim() || '',
			status: 'pending',
			createdAt: new Date().toISOString()
		};

		const result = await db.collection('swim_invites').insertOne(invite);
		return json({ ...invite, _id: result.insertedId.toString() }, { status: 201 });
	} catch (error) {
		console.error('Error creating invite:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
