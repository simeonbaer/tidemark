export const ACHIEVEMENT_PRIORITY = [
	'leviathan',
	'shark_mode',
	'open_water',
	'tide_king',
	'veteran',
	'still_going',
	'on_fire',
	'jack_of_all_strokes',
	'hooked',
	'first_blood',
	'sardine',
	'first_wave'
] as const;

const ACHIEVEMENT_EMOJIS: Record<string, string> = {
	leviathan: '🐋',
	shark_mode: '🦈',
	open_water: '🐠',
	tide_king: '👑',
	veteran: '🏅',
	still_going: '🐢',
	on_fire: '🔥',
	jack_of_all_strokes: '🦋',
	hooked: '📅',
	first_blood: '⚔️',
	sardine: '🐟',
	first_wave: '🌊'
};

export function getTopAchievementEmoji(achievements: { id: string }[]): string | null {
	const unlockedIds = new Set(achievements.map((a) => a.id));
	for (const id of ACHIEVEMENT_PRIORITY) {
		if (unlockedIds.has(id)) return ACHIEVEMENT_EMOJIS[id];
	}
	return null;
}
