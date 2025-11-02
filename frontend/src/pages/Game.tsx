import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useAuth from '../state/auth';

export default function Game() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [isHost, setIsHost] = useState(false);

    useEffect(() => {
        if (!roomId) return;

        let mounted = true;

        const load = async () => {
            try {
                const res = await api.get(`/api/lobbies/${roomId}`);
                const lobby = res.data;
                const userIsHost = lobby.hostId && user && lobby.hostId === user.id;
                console.log('Game: lobby loaded', { lobbyId: roomId, lobbyHostId: lobby.hostId, userId: user?.id, isHost: userIsHost });
                if (mounted) setIsHost(userIsHost);
            } catch (e) {
                // if lobby not found, navigate back to lobby list
                console.warn('Lobby not found or error', e);
                navigate('/lobby');
            }
        };

        load();

        const handleBeforeUnload = () => {
            console.log('Game: beforeunload triggered', { isHost, roomId });
            if (isHost && roomId) {
                try {
                    // Use fetch with keepalive so the browser attempts to send the DELETE when the tab closes.
                    // Do not await, as browsers ignore promises in beforeunload.
                    const hdrs: any = { 'Content-Type': 'application/json' };
                    if (token) hdrs['Authorization'] = `Bearer ${token}`;
                    // Fire-and-forget delete with keepalive
                    try {
                        fetch(`/api/lobbies/${roomId}`, { method: 'DELETE', headers: hdrs, keepalive: true });
                    } catch (e) {
                        // fetch may throw in older browsers; ignore
                    }
                } catch (e) { /* ignore */ }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            mounted = false;
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // on SPA navigation unmount: attempt to delete if host (API call via axios)
            console.log('Game: unmount cleanup', { isHost, roomId });
            (async () => {
                if (isHost && roomId) {
                    try { await api.delete(`/api/lobbies/${roomId}`); } catch (e) { /* ignore */ }
                }
            })();
        };
    }, [roomId, user, isHost, navigate, token]);

    return (
        <div className="text-accent">
            <h1 className="text-3xl font-bold text-neon mb-6">Game Board</h1>
            <p className="text-cyan/70">The game grid and opponent info will appear here.</p>
            {isHost && <p className="text-sm text-muted">You are the host — leaving will cancel this lobby.</p>}
        </div>
    )
}