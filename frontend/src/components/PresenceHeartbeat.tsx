import { useEffect, useRef } from 'react';
import api from '../utils/api';
import useAuth from '../state/auth';

export default function PresenceHeartbeat() {
    const token = useAuth((state) => state.token);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const sendPing = () => {
            api.post('/api/auth/ping').catch(() => {
                // ignore errors; presence will fall back to scheduled cleanup
            });
        };

        if (!token) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        sendPing();
        intervalRef.current = setInterval(sendPing, 30_000);

        const handleBeforeUnload = () => {
            try {
                fetch('/api/auth/offline', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    keepalive: true,
                }).catch(() => {});
            } catch (error) {
                // ignore errors
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [token]);

    return null;
}
