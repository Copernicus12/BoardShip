// Achievement system utilities

export type Achievement = {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'combat' | 'skill' | 'dedication' | 'rank' | 'special';
    unlocked: boolean;
    progress?: number;
    target?: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
};

export type AchievementStats = {
    totalGames: number;
    wins: number;
    losses: number;
    currentStreak: number;
    bestStreak: number;
    winRate: number;
    rank?: string;
};

export const calculateAchievements = (stats: AchievementStats): Achievement[] => {
    return [
        // Combat Achievements
        {
            id: 'first-blood',
            name: 'First Blood',
            description: 'Win your first battle',
            icon: '⚔️',
            category: 'combat',
            unlocked: stats.wins >= 1,
            progress: Math.min(stats.wins, 1),
            target: 1,
            rarity: 'common',
        },
        {
            id: 'veteran',
            name: 'Veteran Sailor',
            description: 'Win 10 battles',
            icon: '🎖️',
            category: 'combat',
            unlocked: stats.wins >= 10,
            progress: Math.min(stats.wins, 10),
            target: 10,
            rarity: 'common',
        },
        {
            id: 'warrior',
            name: 'Sea Warrior',
            description: 'Win 25 battles',
            icon: '⚡',
            category: 'combat',
            unlocked: stats.wins >= 25,
            progress: Math.min(stats.wins, 25),
            target: 25,
            rarity: 'rare',
        },
        {
            id: 'champion',
            name: 'Champion',
            description: 'Win 50 battles',
            icon: '🏅',
            category: 'combat',
            unlocked: stats.wins >= 50,
            progress: Math.min(stats.wins, 50),
            target: 50,
            rarity: 'epic',
        },
        {
            id: 'legendary',
            name: 'Legendary Captain',
            description: 'Win 100 battles',
            icon: '👑',
            category: 'combat',
            unlocked: stats.wins >= 100,
            progress: Math.min(stats.wins, 100),
            target: 100,
            rarity: 'legendary',
        },

        // Skill Achievements
        {
            id: 'winning-streak',
            name: 'Winning Streak',
            description: 'Win 3 games in a row',
            icon: '🔥',
            category: 'skill',
            unlocked: stats.bestStreak >= 3,
            progress: Math.min(stats.bestStreak, 3),
            target: 3,
            rarity: 'common',
        },
        {
            id: 'unstoppable',
            name: 'Unstoppable',
            description: 'Win 5 games in a row',
            icon: '💥',
            category: 'skill',
            unlocked: stats.bestStreak >= 5,
            progress: Math.min(stats.bestStreak, 5),
            target: 5,
            rarity: 'rare',
        },
        {
            id: 'domination',
            name: 'Domination',
            description: 'Win 10 games in a row',
            icon: '⚡',
            category: 'skill',
            unlocked: stats.bestStreak >= 10,
            progress: Math.min(stats.bestStreak, 10),
            target: 10,
            rarity: 'epic',
        },
        {
            id: 'sharpshooter',
            name: 'Sharpshooter',
            description: 'Maintain 70% win rate over 20 games',
            icon: '🎯',
            category: 'skill',
            unlocked: stats.totalGames >= 20 && stats.winRate >= 70,
            progress: stats.totalGames >= 20 ? Math.min(stats.winRate, 70) : 0,
            target: 70,
            rarity: 'rare',
        },
        {
            id: 'perfectionist',
            name: 'Perfectionist',
            description: 'Maintain 80% win rate over 50 games',
            icon: '💯',
            category: 'skill',
            unlocked: stats.totalGames >= 50 && stats.winRate >= 80,
            progress: stats.totalGames >= 50 ? Math.min(stats.winRate, 80) : 0,
            target: 80,
            rarity: 'legendary',
        },

        // Dedication Achievements
        {
            id: 'beginner',
            name: 'Setting Sail',
            description: 'Play 5 battles',
            icon: '⛵',
            category: 'dedication',
            unlocked: stats.totalGames >= 5,
            progress: Math.min(stats.totalGames, 5),
            target: 5,
            rarity: 'common',
        },
        {
            id: 'experienced',
            name: 'Experienced Captain',
            description: 'Play 25 battles',
            icon: '🚢',
            category: 'dedication',
            unlocked: stats.totalGames >= 25,
            progress: Math.min(stats.totalGames, 25),
            target: 25,
            rarity: 'common',
        },
        {
            id: 'seasoned',
            name: 'Seasoned Admiral',
            description: 'Play 50 battles',
            icon: '⚓',
            category: 'dedication',
            unlocked: stats.totalGames >= 50,
            progress: Math.min(stats.totalGames, 50),
            target: 50,
            rarity: 'rare',
        },
        {
            id: 'dedicated',
            name: 'Fleet Commander',
            description: 'Play 100 battles',
            icon: '🎖️',
            category: 'dedication',
            unlocked: stats.totalGames >= 100,
            progress: Math.min(stats.totalGames, 100),
            target: 100,
            rarity: 'epic',
        },

        // Rank Achievements
        {
            id: 'bronze-rank',
            name: 'Bronze Tier',
            description: 'Reach Bronze rank',
            icon: '🥉',
            category: 'rank',
            unlocked: true, // Everyone starts at Bronze
            rarity: 'common',
        },
        {
            id: 'silver-rank',
            name: 'Silver Ascension',
            description: 'Reach Silver rank',
            icon: '🥈',
            category: 'rank',
            unlocked: stats.rank === 'Silver' || stats.rank === 'Gold' || stats.rank === 'Diamond' || stats.rank === 'Platinum',
            rarity: 'common',
        },
        {
            id: 'gold-rank',
            name: 'Golden Admiral',
            description: 'Reach Gold rank',
            icon: '🥇',
            category: 'rank',
            unlocked: stats.rank === 'Gold' || stats.rank === 'Diamond' || stats.rank === 'Platinum',
            rarity: 'rare',
        },
        {
            id: 'diamond-rank',
            name: 'Diamond Elite',
            description: 'Reach Diamond rank',
            icon: '💎',
            category: 'rank',
            unlocked: stats.rank === 'Diamond' || stats.rank === 'Platinum',
            rarity: 'epic',
        },
        {
            id: 'platinum-rank',
            name: 'Platinum Legend',
            description: 'Reach Platinum rank',
            icon: '👑',
            category: 'rank',
            unlocked: stats.rank === 'Platinum',
            rarity: 'legendary',
        },

        // Special Achievements
        {
            id: 'comeback-king',
            name: 'Comeback King',
            description: 'Win after being behind',
            icon: '🌟',
            category: 'special',
            unlocked: false, // This requires game-specific logic
            rarity: 'rare',
        },
        {
            id: 'speed-demon',
            name: 'Speed Demon',
            description: 'Win 10 Speed mode games',
            icon: '⚡',
            category: 'special',
            unlocked: false, // Requires mode-specific tracking
            rarity: 'rare',
        },
        {
            id: 'ranked-warrior',
            name: 'Ranked Warrior',
            description: 'Win 25 Ranked games',
            icon: '🏆',
            category: 'special',
            unlocked: false, // Requires mode-specific tracking
            rarity: 'epic',
        },
    ];
};

export const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
        case 'common':
            return 'text-gray-400 border-gray-500';
        case 'rare':
            return 'text-blue-400 border-blue-500';
        case 'epic':
            return 'text-purple-400 border-purple-500';
        case 'legendary':
            return 'text-yellow-400 border-yellow-500';
        default:
            return 'text-gray-400 border-gray-500';
    }
};

export const getRarityGradient = (rarity: Achievement['rarity']) => {
    switch (rarity) {
        case 'common':
            return 'from-gray-600 to-gray-800';
        case 'rare':
            return 'from-blue-600 to-blue-800';
        case 'epic':
            return 'from-purple-600 to-purple-800';
        case 'legendary':
            return 'from-yellow-600 to-yellow-800';
        default:
            return 'from-gray-600 to-gray-800';
    }
};

export const getCategoryIcon = (category: Achievement['category']) => {
    switch (category) {
        case 'combat':
            return '⚔️';
        case 'skill':
            return '🎯';
        case 'dedication':
            return '🎖️';
        case 'rank':
            return '🏆';
        case 'special':
            return '⭐';
        default:
            return '🏅';
    }
};

