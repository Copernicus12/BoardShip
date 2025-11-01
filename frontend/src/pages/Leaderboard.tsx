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
        <PageContainer maxWidth="max-w-5xl">
            <div>
                <h1 className="text-3xl font-bold text-neon mb-6">Leaderboard</h1>

                <div className="bg-card rounded-2xl p-6 border border-accent shadow-lg">
                    <p className="text-muted mb-4">Top players by score</p>

                    {loading ? (
                        <div className="text-muted">Loading...</div>
                    ) : (
                        <ol className="space-y-3">
                            {players.map((p, i) => (
                                <li
                                    key={p.username}
                                    className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-neon/10 border border-neon/30' : 'bg-card border border-accent'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-navy/20 flex items-center justify-center text-neon font-bold">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-accent">{p.username}</div>
                                            <div className="text-muted text-sm">Score: {p.score}</div>
                                        </div>
                                    </div>
                                    <div className="text-neon font-semibold">{p.score}</div>
                                </li>
                            ))}
                        </ol>
                    )}

                    {error && <p className="text-red-400 mt-4">Error loading leaderboard: {error}</p>}
                </div>
            </div>
        </PageContainer>
    )
}
