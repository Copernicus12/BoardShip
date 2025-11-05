import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import useAuth from '../state/auth';

type OnlineUser = {
    id: string;
    username: string;
    email: string;
    lastSeen: string;
};

type OnlineUsersResponse = {
    count: number;
    users: OnlineUser[];
};

const REFRESH_INTERVAL_MS = 30_000;

export default function OnlinePlayersCard() {
    const token = useAuth((state) => state.token);
    const [data, setData] = useState<OnlineUsersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setData(null);
            setLoading(false);
            setError('Authentication required');
            return;
        }

        let active = true;
        let interval: ReturnType<typeof setInterval> | null = null;

        const fetchData = async () => {
            try {
                const { data: response } = await api.get<OnlineUsersResponse>('/api/users/online');
                if (!active) return;
                setData(response);
                setError(null);
            } catch (err) {
                if (!active) return;
                setError('Could not load online players');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchData();
        interval = setInterval(fetchData, REFRESH_INTERVAL_MS);

        return () => {
            active = false;
            if (interval) clearInterval(interval);
        };
    }, [token]);

    const topPlayers = useMemo(() => {
        if (!data?.users?.length) return [];
        return data.users
            .slice(0, 5)
            .map((user) => ({
                id: user.id,
                username: user.username ?? user.email ?? 'Unknown player',
                lastSeen: user.lastSeen,
            }));
    }, [data]);

    const count = data?.count ?? 0;

    return (
        <div className="bg-card border border-accent rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-sm text-muted mb-1">Players Online</div>
                    <div className="text-3xl font-bold text-neon">
                        {loading ? '—' : count}
                    </div>
                </div>
                {!loading && (
                    <span className="text-xs text-muted">
                        Refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}s
                    </span>
                )}
            </div>

            {loading && (
                <div className="flex items-center gap-3 text-sm text-muted">
                    <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    Loading online players...
                </div>
            )}

            {!loading && error && (
                <div className="text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/40 rounded-md px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {!loading && !error && topPlayers.length > 0 && (
                <div className="mt-4 space-y-2">
                    {topPlayers.map((player) => (
                        <div
                            key={player.id}
                            className="flex items-center justify-between text-sm bg-navy/40 px-3 py-2 rounded-md border border-accent/30"
                        >
                            <span className="text-accent font-medium">
                                {player.username}
                            </span>
                            <span className="text-xs text-muted">
                                active
                            </span>
                        </div>
                    ))}
                    {count > topPlayers.length && (
                        <div className="text-xs text-muted">
                            +{count - topPlayers.length} more players online
                        </div>
                    )}
                </div>
            )}

            {!loading && !error && topPlayers.length === 0 && (
                <div className="text-sm text-muted">
                    No players online right now. Be the first to queue!
                </div>
            )}
        </div>
    );
}
