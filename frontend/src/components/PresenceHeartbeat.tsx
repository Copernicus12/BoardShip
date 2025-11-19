import { useEffect, useRef } from 'react';
import api from '../utils/api';
import useAuth from '../state/auth';

export default function PresenceHeartbeat() {
    const token = useAuth((state) => state.token);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reachableRef = useRef<boolean>(false);

    useEffect(() => {
        const sendPing = () => {
            api.post('/api/auth/ping')
                .then(() => { reachableRef.current = true; })
                .catch(() => { reachableRef.current = false; });
        };

        if (!token) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            reachableRef.current = false;
            return;
        }

        sendPing();
        intervalRef.current = setInterval(sendPing, 30_000);

        const handleBeforeUnload = () => {
            // Only attempt to notify backend if we successfully pinged it recently
            if (!reachableRef.current) return;

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
            reachableRef.current = false;
        };
    }, [token]);

    return null;
}
