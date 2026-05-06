import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const opponentId = url.searchParams.get('opponentId');
		const userId = url.searchParams.get('userId');

		if (!opponentId) {
			return json({ message: 'Opponent ID is required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const activitiesCollection = db.collection('activities');
		const usersCollection = db.collection('users');
		const battlesCollection = db.collection('battles');

		const opponent = await usersCollection.findOne({ _id: new ObjectId(opponentId) });
		if (!opponent) {
			return json({ message: 'Opponent not found' }, { status: 404 });
		}

		// Check for active battle first (if userId provided) so we can filter activities by battle start
		let activeBattle = null;
		if (userId) {
			const battle = await battlesCollection.findOne({
				$or: [
					{ creatorId: new ObjectId(userId), opponentId: new ObjectId(opponentId) },
					{ creatorId: new ObjectId(opponentId), opponentId: new ObjectId(userId) }
				],
				status: 'active'
			});
			if (battle) {
				activeBattle = {
					_id: battle._id.toString(),
					creatorId: battle.creatorId.toString(),
					opponentId: battle.opponentId.toString(),
					distanceGoal: battle.distanceGoal,
					bet: battle.bet || '',
					status: battle.status,
					createdAt: battle.createdAt
				};
			}
		}

		// Filter opponent activities: if there's an active battle, only count since battle started
		const activityQuery: Record<string, unknown> = { userId: new ObjectId(opponentId) };
		if (activeBattle) {
			activityQuery.date = { $gte: activeBattle.createdAt };
		}

		const activities = await activitiesCollection
			.find(activityQuery)
			.sort({ date: -1 })
			.limit(20)
			.toArray();

		const totalDistance = activities.reduce((sum, act) => sum + (act.distance || 0), 0);
		const totalDuration = activities.reduce((sum, act) => sum + (act.duration || 0), 0);

		return json({
			opponent: {
				_id: opponent._id.toString(),
				username: opponent.username,
				skillLevel: opponent.skillLevel,
				profilePicture: opponent.profilePicture || null
			},
			stats: { totalDistance, totalDuration, activityCount: activities.length },
			recentActivities: activities.map((a) => ({
				_id: a._id.toString(),
				distance: a.distance || 0,
				duration: a.duration || 0,
				date: a.date,
				notes: a.notes || ''
			})),
			activeBattle
		});
	} catch (error) {
		console.error('Error fetching battle data:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { creatorId, opponentId, distanceGoal, bet } = await request.json();

		if (!creatorId || !opponentId || !distanceGoal || distanceGoal <= 0) {
			return json({ message: 'Missing or invalid required fields' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const battlesCollection = db.collection('battles');

		const existing = await battlesCollection.findOne({
			$or: [
				{ creatorId: new ObjectId(creatorId), opponentId: new ObjectId(opponentId) },
				{ creatorId: new ObjectId(opponentId), opponentId: new ObjectId(creatorId) }
			],
			status: 'active'
		});

		if (existing) {
			return json(
				{ message: 'An active battle already exists with this opponent' },
				{ status: 409 }
			);
		}

		const now = new Date();
		const battle = {
			creatorId: new ObjectId(creatorId),
			opponentId: new ObjectId(opponentId),
			distanceGoal, // stored in meters
			bet: bet || '',
			status: 'active',
			createdAt: now
		};

		const result = await battlesCollection.insertOne(battle);

		return json({
			_id: result.insertedId.toString(),
			creatorId,
			opponentId,
			distanceGoal,
			bet: bet || '',
			status: 'active',
			createdAt: now
		});
	} catch (error) {
		console.error('Error creating battle:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
