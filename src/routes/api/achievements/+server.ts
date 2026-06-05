import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

const ACHIEVEMENTS = [
	{ id: 'first_wave', name: 'First Wave', emoji: '🌊', desc: 'Log your first swim session' },
	{ id: 'open_water', name: 'Open Water', emoji: '🐠', desc: 'Swim 10km total' },
	{ id: 'shark_mode', name: 'Shark Mode', emoji: '🦈', desc: 'Swim 50km total' },
	{ id: 'leviathan', name: 'Leviathan', emoji: '🐋', desc: 'Swim 100km total' },
	{ id: 'first_blood', name: 'First Blood', emoji: '⚔️', desc: 'Start your first battle' },
	{ id: 'tide_king', name: 'Tide King', emoji: '👑', desc: 'Win 5 battles' },
	{ id: 'sardine', name: 'Sardine', emoji: '🐟', desc: 'Lose 5 battles in a row' },
	{ id: 'on_fire', name: 'On Fire', emoji: '🔥', desc: 'Swim 7 days in a row' },
	{ id: 'hooked', name: 'Hooked', emoji: '📅', desc: 'Be active for 1 month' },
	{ id: 'veteran', name: 'Veteran', emoji: '🏅', desc: 'Be active for 6 months' },
	{ id: 'still_going', name: 'Still Going', emoji: '🐢', desc: 'Be active for 1 year' },
	{
		id: 'jack_of_all_strokes',
		name: 'Jack of All Strokes',
		emoji: '🦋',
		desc: 'Log all 4 swim styles at least once (freestyle, breaststroke, backstroke, butterfly)'
	}
];

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		if (!userId) return json({ message: 'userId required' }, { status: 400 });

		const { db } = await connectToDatabase();

		const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
		if (!user) return json({ message: 'User not found' }, { status: 404 });

		const activities = await db
			.collection('activities')
			.find({ userId: new ObjectId(userId) })
			.toArray();

		const battles = await db
			.collection('battles')
			.find({ $or: [{ creatorId: new ObjectId(userId) }, { opponentId: new ObjectId(userId) }] })
			.toArray();

		// ── Compute conditions ──────────────────────────────────────────────────

		const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
		const activityCount = activities.length;

		const battlesCreated = battles.filter((b) => b.creatorId?.toString() === userId).length;
		const completedBattles = battles.filter((b) => b.status === 'completed');
		const battlesWon = completedBattles.filter((b) => b.winnerId?.toString() === userId).length;

		// Sardine: consecutive losses from the most recent completed battle
		const sortedCompleted = completedBattles
			.filter((b) => b.completedAt)
			.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
		let losingStreak = 0;
		for (const battle of sortedCompleted) {
			if (battle.winnerId && battle.winnerId.toString() !== userId) {
				losingStreak++;
			} else {
				break;
			}
		}

		// On Fire: max consecutive-day streak
		const dateKey = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const activeDateSet = new Set(activities.map((a) => dateKey(new Date(a.date))));
		const sortedDates = [...activeDateSet].sort();
		let maxStreak = sortedDates.length > 0 ? 1 : 0;
		let currentStreak = sortedDates.length > 0 ? 1 : 0;
		for (let i = 1; i < sortedDates.length; i++) {
			const prev = new Date(sortedDates[i - 1]);
			const curr = new Date(sortedDates[i]);
			const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays === 1) {
				currentStreak++;
				maxStreak = Math.max(maxStreak, currentStreak);
			} else {
				currentStreak = 1;
			}
		}

		// Account age from ObjectId embedded timestamp
		const accountCreatedAt: Date = user._id.getTimestamp();
		const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

		// Jack of All Strokes
		const swimStyles = new Set(
			activities
				.map((a) => (a.swimStyle || '').toLowerCase())
				.filter((s) => s && s !== 'unspecified')
		);
		const allFourStyles = ['freestyle', 'breaststroke', 'backstroke', 'butterfly'].every((s) =>
			swimStyles.has(s)
		);

		// ── Evaluate ────────────────────────────────────────────────────────────

		const conditions: Record<string, boolean> = {
			first_wave: activityCount >= 1,
			open_water: totalDistance >= 10000,
			shark_mode: totalDistance >= 50000,
			leviathan: totalDistance >= 100000,
			first_blood: battlesCreated >= 1,
			tide_king: battlesWon >= 5,
			sardine: losingStreak >= 5,
			on_fire: maxStreak >= 7,
			hooked: accountAgeDays >= 30 && activityCount >= 1,
			veteran: accountAgeDays >= 180 && activityCount >= 1,
			still_going: accountAgeDays >= 365 && activityCount >= 1,
			jack_of_all_strokes: allFourStyles
		};

		// ── Persist newly unlocked achievements ─────────────────────────────────

		const stored: { id: string; unlockedAt: Date }[] = user.achievements || [];
		const storedIds = new Set(stored.map((a) => a.id));

		const newlyUnlocked: { id: string; unlockedAt: Date }[] = [];
		for (const achievement of ACHIEVEMENTS) {
			if (!storedIds.has(achievement.id) && conditions[achievement.id]) {
				newlyUnlocked.push({ id: achievement.id, unlockedAt: new Date() });
			}
		}

		if (newlyUnlocked.length > 0) {
			await db.collection('users').updateOne(
				{ _id: new ObjectId(userId) },
				{ $set: { achievements: [...stored, ...newlyUnlocked] } }
			);
		}

		const allUnlocked = [...stored, ...newlyUnlocked];
		const unlockedMap = new Map(allUnlocked.map((a) => [a.id, a.unlockedAt]));

		return json(
			ACHIEVEMENTS.map((a) => {
				const unlockedAt = unlockedMap.get(a.id);
				return {
					...a,
					unlocked: unlockedMap.has(a.id),
					unlockedAt: unlockedAt ? new Date(unlockedAt).toISOString() : null
				};
			})
		);
	} catch (error) {
		console.error('Error fetching achievements:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
