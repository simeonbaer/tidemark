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

		// Battle stats
		const allBattles = await battlesCollection
			.find({
				$or: [{ creatorId: new ObjectId(userId) }, { opponentId: new ObjectId(userId) }]
			})
			.toArray();

		const completedBattles = allBattles.filter((b) => b.status === 'completed');
		const battlesWon = completedBattles.filter((b) => b.winnerId?.toString() === userId).length;
		const battlesLost = completedBattles.filter(
			(b) => b.winnerId && b.winnerId.toString() !== userId
		).length;
		const totalDecided = battlesWon + battlesLost;
		const winRate = totalDecided > 0 ? Math.round((battlesWon / totalDecided) * 100) : 0;

		// Personal bests (all-time)
		const personalBestDistance =
			activities.length > 0 ? Math.max(...activities.map((a) => a.distance || 0)) : 0;

		const activitiesWithBoth = activities.filter(
			(a) => (a.distance || 0) > 0 && (a.duration || 0) > 0
		);
		const personalBestPace =
			activitiesWithBoth.length > 0
				? Math.min(...activitiesWithBoth.map((a) => a.duration / (a.distance / 100)))
				: 0;

		// Monthly stats
		const now = new Date();
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

		const thisMonthActivities = activities.filter((a) => new Date(a.date) >= thisMonthStart);
		const lastMonthActivities = activities.filter((a) => {
			const d = new Date(a.date);
			return d >= lastMonthStart && d <= lastMonthEnd;
		});

		const thisMonthDistance = thisMonthActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
		const lastMonthDistance = lastMonthActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
		const thisMonthSessions = thisMonthActivities.length;
		const lastMonthSessions = lastMonthActivities.length;

		const thisMonthWithBoth = thisMonthActivities.filter(
			(a) => (a.distance || 0) > 0 && (a.duration || 0) > 0
		);
		const bestPaceThisMonth =
			thisMonthWithBoth.length > 0
				? Math.min(...thisMonthWithBoth.map((a) => a.duration / (a.distance / 100)))
				: 0;

		// Weekly stats — last 8 weeks (week starts Monday)
		const getWeekStart = (date: Date): Date => {
			const d = new Date(date);
			const day = d.getDay(); // 0 = Sun, 1 = Mon
			const diff = d.getDate() - day + (day === 0 ? -6 : 1);
			d.setDate(diff);
			d.setHours(0, 0, 0, 0);
			return d;
		};

		const currentWeekStart = getWeekStart(now);
		const weeklyStats = [];

		for (let i = 0; i < 8; i++) {
			const weekStart = new Date(currentWeekStart);
			weekStart.setDate(weekStart.getDate() - i * 7);
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekEnd.getDate() + 7);

			const weekActivities = activities.filter((a) => {
				const d = new Date(a.date);
				return d >= weekStart && d < weekEnd;
			});

			const dist = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
			const dur = weekActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
			const sessions = weekActivities.length;
			const avgPace = dist > 0 && dur > 0 ? dur / (dist / 100) : 0;
			const calories = weekActivities.reduce(
				(sum, a) => sum + Math.round((a.duration || 0) * 8),
				0
			);
			const bestSession =
				weekActivities.length > 0
					? Math.max(...weekActivities.map((a) => a.distance || 0))
					: 0;

			weeklyStats.push({
				weekStart: weekStart.toISOString(),
				distance: dist,
				sessions,
				avgPace,
				calories,
				bestSession
			});
		}

		// Most sessions in a single week (across all history, not just the last 8)
		const mostSessionsInWeek = weeklyStats.reduce((max, w) => Math.max(max, w.sessions), 0);

		// Longest consecutive-day streak
		const dateKey = (d: Date): string =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

		const activeDateSet = new Set(activities.map((a) => dateKey(new Date(a.date))));
		const sortedDates = [...activeDateSet].sort();

		let longestStreak = sortedDates.length > 0 ? 1 : 0;
		let currentStreakCount = sortedDates.length > 0 ? 1 : 0;

		for (let i = 1; i < sortedDates.length; i++) {
			const prev = new Date(sortedDates[i - 1]);
			const curr = new Date(sortedDates[i]);
			const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays === 1) {
				currentStreakCount++;
				if (currentStreakCount > longestStreak) longestStreak = currentStreakCount;
			} else {
				currentStreakCount = 1;
			}
		}

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
				battleCount: allBattles.length,
				battlesWon,
				battlesLost,
				winRate,
				personalBestDistance,
				personalBestPace,
				thisMonthDistance,
				lastMonthDistance,
				thisMonthSessions,
				lastMonthSessions,
				bestPaceThisMonth,
				weeklyStats,
				longestStreak,
				mostSessionsInWeek
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
