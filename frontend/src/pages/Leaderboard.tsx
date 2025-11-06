import { useEffect, useState } from 'react'
import PageContainer from '../components/PageContainer'
import api from '../utils/api'

type Player = {
    username: string
    score: number
    rank?: string
    icon?: string
    wins: number
    losses: number
    totalGames: number
    winRate: number
}

type SortBy = 'rp' | 'wins' | 'winrate';

export default function Leaderboard() {
    const [players, setPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<SortBy>('rp')

    useEffect(() => {
        const abortController = new AbortController()
        let cancelled = false

        async function load() {
            try {
                setLoading(true)
                // Use /api/leaderboard endpoint (not just /leaderboard)
                const res = await api.get(`/api/leaderboard?limit=100&sortBy=${sortBy}`, {
                    signal: abortController.signal
                })

                // Check if request was cancelled
                if (cancelled) return

                // Handle different response formats
                let data: Player[] = []
                if (Array.isArray(res.data)) {
                    data = res.data
                } else if (res.data && typeof res.data === 'object') {
                    // Backend might return { players: [...] } or similar
                    data = res.data.players || res.data.leaderboard || []
                }

                // Ensure we have an array
                if (!Array.isArray(data)) {
                    console.error('Invalid leaderboard data format:', res.data)
                    data = []
                }

                setPlayers(data)
                setError(null)
            } catch (e: any) {
                // Don't show error if request was just cancelled
                if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || cancelled) {
                    console.log('Leaderboard request cancelled')
                    return
                }

                console.error('Failed to load leaderboard:', e)

                // Only show mock data if not cancelled
                if (!cancelled) {
                    // fallback mock data
                    const mock: Player[] = [
                        { username: 'CaptainA', score: 3400, rank: 'Diamond', icon: '💎', wins: 85, losses: 15, totalGames: 100, winRate: 85.0 },
                        { username: 'SeaWolf', score: 2880, rank: 'Gold', icon: '🥇', wins: 72, losses: 28, totalGames: 100, winRate: 72.0 },
                        { username: 'BlueAnchor', score: 2420, rank: 'Gold', icon: '🥇', wins: 60, losses: 40, totalGames: 100, winRate: 60.0 },
                        { username: 'Razor', score: 1880, rank: 'Silver', icon: '🥈', wins: 47, losses: 53, totalGames: 100, winRate: 47.0 },
                        { username: 'Gale', score: 1500, rank: 'Silver', icon: '🥈', wins: 38, losses: 42, totalGames: 80, winRate: 47.5 },
                        { username: 'Nova', score: 1200, rank: 'Silver', icon: '🥈', wins: 30, losses: 30, totalGames: 60, winRate: 50.0 },
                    ]
                    setPlayers(mock)
                    setError('Failed to load leaderboard from server')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            cancelled = true
            abortController.abort()
        }
    }, [sortBy])

    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto">
                {/* Compact Hero Header */}
                <div className="mb-8 text-center relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-neon/10 via-accent/10 to-neon/10 blur-2xl -z-10"></div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon via-accent to-neon mb-2 animate-pulse">
                        🏆 Leaderboard
                    </h1>
                    <p className="text-sm text-muted">Top players by performance</p>
                </div>

                {/* Compact Sorting Tabs */}
                <div className="mb-6 flex justify-center gap-3">
                    <button
                        onClick={() => setSortBy('rp')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm ${
                            sortBy === 'rp'
                                ? 'bg-gradient-to-r from-neon to-accent text-navy shadow-lg shadow-neon/50'
                                : 'bg-card/50 border border-accent/30 text-accent hover:border-neon hover:shadow-lg hover:shadow-neon/20'
                        }`}
                    >
                        🏆 Rank (RP)
                    </button>
                    <button
                        onClick={() => setSortBy('wins')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm ${
                            sortBy === 'wins'
                                ? 'bg-gradient-to-r from-neon to-accent text-navy shadow-lg shadow-neon/50'
                                : 'bg-card/50 border border-accent/30 text-accent hover:border-neon hover:shadow-lg hover:shadow-neon/20'
                        }`}
                    >
                        ⚔️ Victories
                    </button>
                    <button
                        onClick={() => setSortBy('winrate')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm ${
                            sortBy === 'winrate'
                                ? 'bg-gradient-to-r from-neon to-accent text-navy shadow-lg shadow-neon/50'
                                : 'bg-card/50 border border-accent/30 text-accent hover:border-neon hover:shadow-lg hover:shadow-neon/20'
                        }`}
                    >
                        📊 Win Rate
                    </button>
                </div>

                {/* Compact Top 3 Podium */}
                {!loading && Array.isArray(players) && players.length >= 3 && (
                    <div className="grid grid-cols-3 gap-4 mb-8 items-end">
                        {/* 2nd Place */}
                        <div className="text-center transform transition-all duration-300 hover:scale-105">
                            <div className="relative bg-gradient-to-br from-gray-700 via-gray-600 to-gray-700 rounded-xl p-4 mb-3 border border-gray-500 shadow-lg overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <div className="relative">
                                    <div className="text-4xl mb-2">🥈</div>
                                    <div className="text-lg font-black text-white mb-1">{players[1]?.username || 'N/A'}</div>
                                    {players[1]?.rank && players[1]?.icon && (
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs mb-2">
                                            <span>{players[1].icon}</span>
                                            <span className="font-semibold text-white">{players[1].rank}</span>
                                        </div>
                                    )}
                                    <div className="text-xl font-black text-yellow-300 mb-1">{players[1]?.score || 0} RP</div>
                                    <div className="text-xs text-gray-300">
                                        <span className="text-green-400 font-bold">{players[1]?.wins || 0}W</span>
                                        <span className="mx-1">-</span>
                                        <span className="text-red-400 font-bold">{players[1]?.losses || 0}L</span>
                                        <span className="mx-1">•</span>
                                        <span className="text-yellow-300 font-bold">{(players[1]?.winRate || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-20 bg-gradient-to-t from-gray-700 to-gray-600 border border-gray-500 rounded-t-xl flex items-center justify-center shadow-lg">
                                <span className="text-4xl font-black text-white">2</span>
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div className="text-center transform transition-all duration-300 hover:scale-105 -mt-4">
                            <div className="relative bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-xl p-5 mb-3 border border-yellow-300 shadow-xl shadow-yellow-500/50 overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <div className="relative">
                                    <div className="text-5xl mb-2 animate-pulse">👑</div>
                                    <div className="text-2xl font-black text-navy mb-1">{players[0]?.username || 'N/A'}</div>
                                    {players[0]?.rank && players[0]?.icon && (
                                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-navy/30 rounded-full text-xs mb-2">
                                            <span className="text-lg">{players[0].icon}</span>
                                            <span className="font-black text-navy">{players[0].rank}</span>
                                        </div>
                                    )}
                                    <div className="text-2xl font-black text-navy mb-1">{players[0]?.score || 0} RP</div>
                                    <div className="text-xs text-navy/80 font-semibold">
                                        <span className="text-green-700">{players[0]?.wins || 0}W</span>
                                        <span className="mx-1">-</span>
                                        <span className="text-red-700">{players[0]?.losses || 0}L</span>
                                        <span className="mx-1">•</span>
                                        <span className="text-navy">{(players[0]?.winRate || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-28 bg-gradient-to-t from-yellow-500 to-yellow-400 border border-yellow-300 rounded-t-xl flex items-center justify-center shadow-xl shadow-yellow-500/50">
                                <span className="text-5xl font-black text-navy">1</span>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="text-center transform transition-all duration-300 hover:scale-105">
                            <div className="relative bg-gradient-to-br from-amber-700 via-amber-600 to-amber-700 rounded-xl p-4 mb-3 border border-amber-500 shadow-lg overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <div className="relative">
                                    <div className="text-4xl mb-2">🥉</div>
                                    <div className="text-lg font-black text-white mb-1">{players[2]?.username || 'N/A'}</div>
                                    {players[2]?.rank && players[2]?.icon && (
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs mb-2">
                                            <span>{players[2].icon}</span>
                                            <span className="font-semibold text-white">{players[2].rank}</span>
                                        </div>
                                    )}
                                    <div className="text-xl font-black text-amber-300 mb-1">{players[2]?.score || 0} RP</div>
                                    <div className="text-xs text-amber-100">
                                        <span className="text-green-300 font-bold">{players[2]?.wins || 0}W</span>
                                        <span className="mx-1">-</span>
                                        <span className="text-red-300 font-bold">{players[2]?.losses || 0}L</span>
                                        <span className="mx-1">•</span>
                                        <span className="text-amber-200 font-bold">{(players[2]?.winRate || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-16 bg-gradient-to-t from-amber-700 to-amber-600 border border-amber-500 rounded-t-xl flex items-center justify-center shadow-lg">
                                <span className="text-3xl font-black text-white">3</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Compact Full Rankings Table */}
                <div className="bg-gradient-to-b from-card to-card/50 rounded-xl border border-accent/30 overflow-hidden shadow-xl backdrop-blur-sm">
                    <div className="bg-gradient-to-r from-accent/20 via-neon/20 to-accent/20 px-6 py-3 border-b border-accent/30">
                        <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-neon to-accent">
                            Complete Rankings
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="relative inline-block">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-neon"></div>
                                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-neon opacity-20"></div>
                            </div>
                            <p className="text-muted mt-4">Loading rankings...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-accent/20">
                            {Array.isArray(players) && players.length > 0 ? players.map((p, i) => (
                                <div
                                    key={p.username}
                                    className={`group flex items-center justify-between px-6 py-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-neon/10 hover:via-accent/5 hover:to-transparent ${
                                        i < 3 ? 'bg-gradient-to-r from-accent/5 to-transparent' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* Rank Badge */}
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg shadow-md transition-all duration-300 group-hover:scale-110 ${
                                            i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy border border-yellow-300' :
                                            i === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600 text-white border border-gray-300' :
                                            i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white border border-amber-500' :
                                            'bg-gradient-to-br from-navy to-navy/50 text-accent border border-accent/30'
                                        }`}>
                                            {i === 0 ? '👑' : i + 1}
                                        </div>

                                        {/* Player Info */}
                                        <div className="flex-1">
                                            <div className={`font-bold text-lg mb-0.5 transition-colors ${
                                                i < 3 ? 'text-transparent bg-clip-text bg-gradient-to-r from-neon to-accent' : 'text-accent group-hover:text-neon'
                                            }`}>
                                                {p.username}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                {p.rank && p.icon && (
                                                    <span className="px-2 py-0.5 bg-accent/20 border border-accent/50 rounded-full flex items-center gap-1 font-semibold">
                                                        <span>{p.icon}</span>
                                                        <span className="text-accent">{p.rank}</span>
                                                    </span>
                                                )}
                                                <span className="text-muted">#{i + 1}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="flex items-center gap-6">
                                        {/* RP */}
                                        <div className="text-center min-w-[90px]">
                                            <div className="text-xs text-muted mb-0.5 font-semibold uppercase tracking-wider">RP</div>
                                            <div className={`text-2xl font-black transition-colors ${
                                                i < 3 ? 'text-transparent bg-clip-text bg-gradient-to-r from-neon to-accent' : 'text-accent group-hover:text-neon'
                                            }`}>
                                                {p.score.toLocaleString()}
                                            </div>
                                        </div>

                                        {/* W/L */}
                                        <div className="text-center min-w-[80px]">
                                            <div className="text-xs text-muted mb-0.5 font-semibold uppercase tracking-wider">W/L</div>
                                            <div className="text-lg font-bold flex items-center justify-center gap-1">
                                                <span className="text-green-400">{p.wins}</span>
                                                <span className="text-muted text-sm">-</span>
                                                <span className="text-red-400">{p.losses}</span>
                                            </div>
                                        </div>

                                        {/* Win Rate */}
                                        <div className="text-center min-w-[100px]">
                                            <div className="text-xs text-muted mb-0.5 font-semibold uppercase tracking-wider">Win Rate</div>
                                            <div className={`text-lg font-black mb-1 ${
                                                p.winRate >= 70 ? 'text-green-400' :
                                                p.winRate >= 60 ? 'text-lime-400' :
                                                p.winRate >= 50 ? 'text-yellow-400' :
                                                p.winRate >= 40 ? 'text-orange-400' :
                                                'text-red-400'
                                            }`}>
                                                {p.winRate.toFixed(1)}%
                                            </div>
                                            <div className="w-full bg-navy/50 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        p.winRate >= 70 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                                        p.winRate >= 60 ? 'bg-gradient-to-r from-lime-500 to-lime-400' :
                                                        p.winRate >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                        p.winRate >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                                                        'bg-gradient-to-r from-red-500 to-red-400'
                                                    }`}
                                                    style={{ width: `${p.winRate}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Total Games */}
                                        <div className="text-center min-w-[70px]">
                                            <div className="text-xs text-muted mb-0.5 font-semibold uppercase tracking-wider">Games</div>
                                            <div className="text-lg font-bold text-accent">
                                                {p.totalGames}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <div className="text-5xl mb-3 opacity-50">🏆</div>
                                    <p className="text-muted">No champions yet. Be the first!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-gradient-to-r from-red-500/20 to-red-500/10 border-t border-red-500/30">
                            <p className="text-red-400 text-sm font-semibold">⚠️ {error}</p>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    )
}