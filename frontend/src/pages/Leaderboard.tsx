import { useEffect, useState } from 'react'
import PageContainer from '../components/PageContainer'

type Player = {
    username: string
    score: number
}

export default function Leaderboard() {
    const [players, setPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const abort = new AbortController()

        async function load() {
            try {
                const res = await fetch('/api/leaderboard', { signal: abort.signal })
                if (!res.ok) throw new Error('No backend leaderboard')
                const data = await res.json()
                // expect data to be array of { username, score }
                const sorted = (data as Player[]).sort((a, b) => b.score - a.score)
                setPlayers(sorted)
            } catch (e) {
                // fallback mock data
                const mock: Player[] = [
                    { username: 'CaptainA', score: 3400 },
                    { username: 'SeaWolf', score: 2880 },
                    { username: 'BlueAnchor', score: 2420 },
                    { username: 'Razor', score: 1880 },
                    { username: 'Gale', score: 1500 },
                    { username: 'Nova', score: 1200 },
                ]
                setPlayers(mock)
                if ((e as Error).message !== 'No backend leaderboard') {
                    setError((e as Error).message)
                }
            } finally {
                setLoading(false)
            }
        }

        load()
        return () => abort.abort()
    }, [])

    return (
        <PageContainer>
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-neon mb-2">Leaderboard</h1>
                    <p className="text-muted">Top players ranked by performance and victories</p>
                </div>

                {/* Top 3 Podium */}
                {!loading && players.length >= 3 && (
                    <div className="grid grid-cols-3 gap-4 mb-12 items-end">
                        {/* 2nd Place */}
                        <div className="text-center">
                            <div className="bg-card border-2 border-accent rounded-xl p-6 mb-3 hover:border-neon transition">
                                <div className="text-5xl mb-3">🥈</div>
                                <div className="text-2xl font-bold text-accent mb-1">{players[1].username}</div>
                                <div className="text-neon text-xl font-semibold">{players[1].score}</div>
                            </div>
                            <div className="h-24 bg-accent/20 border border-accent rounded-t-lg flex items-center justify-center">
                                <span className="text-4xl font-bold text-accent">2</span>
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div className="text-center -mt-8">
                            <div className="bg-card border-2 border-neon rounded-xl p-6 mb-3 shadow-glow">
                                <div className="text-6xl mb-3">👑</div>
                                <div className="text-2xl font-bold text-neon mb-1">{players[0].username}</div>
                                <div className="text-neon text-2xl font-bold">{players[0].score}</div>
                            </div>
                            <div className="h-32 bg-neon/30 border border-neon rounded-t-lg flex items-center justify-center shadow-glow">
                                <span className="text-5xl font-bold text-neon">1</span>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="text-center">
                            <div className="bg-card border-2 border-accent rounded-xl p-6 mb-3 hover:border-neon transition">
                                <div className="text-5xl mb-3">🥉</div>
                                <div className="text-2xl font-bold text-accent mb-1">{players[2].username}</div>
                                <div className="text-neon text-xl font-semibold">{players[2].score}</div>
                            </div>
                            <div className="h-16 bg-accent/10 border border-accent rounded-t-lg flex items-center justify-center">
                                <span className="text-3xl font-bold text-accent">3</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Full Leaderboard Table */}
                <div className="bg-card rounded-xl border border-accent overflow-hidden">
                    <div className="bg-accent/10 px-6 py-4 border-b border-accent">
                        <h2 className="text-xl font-bold text-accent">Full Rankings</h2>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-neon"></div>
                            <p className="text-muted mt-4">Loading rankings...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-accent/30 stagger-children">
                            {players.map((p, i) => (
                                <div
                                    key={p.username}
                                    className={`flex items-center justify-between px-6 py-4 hover:bg-accent/5 transition ${
                                        i < 3 ? 'bg-accent/5' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                                            i === 0 ? 'bg-neon/20 text-neon border-2 border-neon' :
                                            i === 1 ? 'bg-accent/20 text-accent border-2 border-accent' :
                                            i === 2 ? 'bg-accent/10 text-accent border-2 border-accent' :
                                            'bg-navy text-muted border border-accent'
                                        }`}>
                                            {i === 0 ? '👑' : i + 1}
                                        </div>

                                        <div className="flex-1">
                                            <div className={`font-semibold text-lg ${
                                                i < 3 ? 'text-neon' : 'text-accent'
                                            }`}>
                                                {p.username}
                                            </div>
                                            <div className="text-sm text-muted">
                                                Rank #{i + 1}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <div className="text-sm text-muted mb-1">Score</div>
                                            <div className={`text-2xl font-bold ${
                                                i < 3 ? 'text-neon' : 'text-accent'
                                            }`}>
                                                {p.score.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="p-6 bg-red-500/10 border-t border-red-500/30">
                            <p className="text-red-400">⚠️ Error loading leaderboard: {error}</p>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    )
}