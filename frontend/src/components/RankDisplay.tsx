import React from 'react';

interface RankInfo {
    rank: string;
    icon: string;
    color: string;
    currentRP: number;
    minRP: number;
    maxRP: number;
    progressToNext: number;
    nextRank: string | null;
    rpToNext: number;
}

interface RankDisplayProps {
    rankInfo: RankInfo;
    showProgressBar?: boolean;
    size?: 'small' | 'medium' | 'large';
}

const RankDisplay: React.FC<RankDisplayProps> = ({
    rankInfo,
    showProgressBar = false,
    size = 'medium'
}) => {
    const getRankGradient = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'bronze':
                return 'from-orange-400 to-amber-700';
            case 'silver':
                return 'from-slate-300 to-gray-500';
            case 'gold':
                return 'from-yellow-400 to-amber-600';
            case 'diamond':
                return 'from-cyan-300 to-blue-500';
            case 'platinum':
                return 'from-slate-300 to-slate-500';
            default:
                return 'from-gray-400 to-gray-600';
        }
    };

    const getRankBorderColor = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'bronze':
                return 'border-orange-400';
            case 'silver':
                return 'border-slate-300';
            case 'gold':
                return 'border-yellow-400';
            case 'diamond':
                return 'border-cyan-400';
            case 'platinum':
                return 'border-slate-400';
            default:
                return 'border-gray-500';
        }
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'small':
                return {
                    icon: 'text-2xl',
                    rank: 'text-sm',
                    rp: 'text-xs',
                    container: 'p-3'
                };
            case 'large':
                return {
                    icon: 'text-6xl',
                    rank: 'text-3xl',
                    rp: 'text-xl',
                    container: 'p-8'
                };
            default:
                return {
                    icon: 'text-4xl',
                    rank: 'text-xl',
                    rp: 'text-sm',
                    container: 'p-6'
                };
        }
    };

    const sizeClasses = getSizeClasses();
    const gradient = getRankGradient(rankInfo.rank);
    const borderColor = getRankBorderColor(rankInfo.rank);

    return (
        <div className="w-full">
            <div className={`bg-gradient-to-br ${gradient} rounded-xl border-2 ${borderColor} ${sizeClasses.container} text-center shadow-lg`}>
                <div className={`${sizeClasses.icon} mb-2`}>{rankInfo.icon}</div>
                <div className={`font-bold text-white ${sizeClasses.rank} mb-1`}>{rankInfo.rank}</div>
                <div className={`text-white/90 ${sizeClasses.rp} font-semibold`}>{rankInfo.currentRP} RP</div>
                {rankInfo.nextRank && (
                    <div className={`text-white/70 ${sizeClasses.rp} mt-1`}>
                        {rankInfo.rpToNext} RP to {rankInfo.nextRank}
                    </div>
                )}
            </div>

            {showProgressBar && rankInfo.nextRank && (
                <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted">{rankInfo.rank}</span>
                        <span className="text-accent font-semibold">{rankInfo.progressToNext}%</span>
                        <span className="text-muted">{rankInfo.nextRank}</span>
                    </div>
                    <div className="w-full bg-navy rounded-full h-4 border border-accent overflow-hidden">
                        <div
                            className={`bg-gradient-to-r ${gradient} h-full transition-all duration-500 shadow-glow relative`}
                            style={{ width: `${rankInfo.progressToNext}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <div className="text-center mt-2 text-sm text-muted">
                        {rankInfo.currentRP} / {rankInfo.maxRP} RP
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankDisplay;

