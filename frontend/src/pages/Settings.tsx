import { useEffect, useState } from 'react';
import PageContainer from "../components/PageContainer";
import useTheme from "../state/theme";
import useAuth from "../state/auth";
import api from "../utils/api";

export default function Settings() {
    const { user, fetchMe } = useAuth();
    const theme = useTheme((s) => s.theme);
    const setThemeStore = useTheme((s) => s.setTheme);
    const [username, setUsername] = useState(user?.username || '');
    const [savingName, setSavingName] = useState(false);
    const [nameMessage, setNameMessage] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

    const [savingTheme, setSavingTheme] = useState(false);
    const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable'); // UI density preference (client-side)

    useEffect(() => {
        setUsername(user?.username || '');
        if (user?.themePreference) {
            setThemeStore(user.themePreference);
        }
    }, [user, setThemeStore]);

    useEffect(() => {
        // Ensure DOM class follows store theme
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
        }
    }, [theme]);

    useEffect(() => {
        const saved = localStorage.getItem('boardship-density');
        if (saved === 'comfortable' || saved === 'compact') {
            setDensity(saved);
            if (typeof document !== 'undefined') {
                document.documentElement.dataset.density = saved;
            }
        }
    }, []);

    const handleDensityChange = (d: 'comfortable' | 'compact') => {
        setDensity(d);
        if (typeof document !== 'undefined') {
            document.documentElement.dataset.density = d;
        }
        localStorage.setItem('boardship-density', d);
    };

    const handleThemeChange = async (value: 'dark' | 'light') => {
        setSavingTheme(true);
        setThemeStore(value);
        try {
            await api.patch('/api/users/me/theme', { theme: value });
            await fetchMe();
        } catch (e) {
            // revert on failure
            setThemeStore(theme);
        } finally {
            setSavingTheme(false);
        }
    };

    const handleUsernameSave = async () => {
        if (!username.trim()) return;
        setSavingName(true);
        setNameMessage(null);
        try {
            await api.patch('/api/users/me/username', { username: username.trim() });
            await fetchMe();
            setNameMessage('Username updated');
        } catch (e: any) {
            setNameMessage(e.response?.data?.message || 'Could not update username');
        } finally {
            setSavingName(false);
        }
    };

    const handlePasswordSave = async () => {
        setPasswordMessage(null);
        if (newPassword !== confirmPassword) {
            setPasswordMessage('New passwords do not match');
            return;
        }
        setSavingPassword(true);
        try {
            await api.patch('/api/users/me/password', { currentPassword, newPassword });
            setPasswordMessage('Password updated');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: any) {
            setPasswordMessage(e.response?.data?.message || 'Could not update password');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">Control center</p>
                    <h1 className="text-3xl font-bold text-neon">Settings</h1>
                    <p className="text-sm text-muted">Customize your experience, account, and security.</p>
                </header>

                <section className="rounded-2xl border border-accent/30 bg-card/60 p-5 shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">Appearance</p>
                            <h2 className="text-xl font-bold text-accent">Theme</h2>
                        </div>
                        <div className="flex gap-2">
                            {(['dark','light'] as const).map((option) => (
                                <button
                                    key={option}
                                    disabled={savingTheme}
                                    onClick={() => handleThemeChange(option)}
                                    className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                                        theme === option ? 'border-neon text-neon bg-neon/10' : 'border-accent/40 text-accent hover:border-neon/50'
                                    }`}
                                >
                                    {option === 'dark' ? 'Dark' : 'Light'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-muted">We save your choice server-side so it travels with your account.</p>
                    <div className="mt-4 flex items-center gap-3">
                        <label className="text-xs uppercase tracking-[0.14em] text-muted">Density</label>
                        <div className="flex gap-2">
                            {(['comfortable','compact'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => handleDensityChange(d)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                                        density === d ? 'border-neon text-neon bg-neon/10' : 'border-accent/30 text-accent'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-accent/30 bg-card/60 p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">Identity</p>
                            <h2 className="text-xl font-bold text-accent">Change nametag</h2>
                        </div>
                        {nameMessage && <span className="text-xs text-accent">{nameMessage}</span>}
                    </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted">Username</label>
                            <input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-lg border border-accent/60 bg-[#050a16] px-3 text-accent focus:border-neon outline-none"
                                style={{ padding: `var(--input-py) var(--input-px)` }}
                                placeholder="New username"
                            />
                        </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleUsernameSave}
                            disabled={savingName || !username.trim()}
                            className="px-4 py-2 rounded-lg bg-neon text-navy font-semibold hover:opacity-90 disabled:opacity-50"
                        >
                            {savingName ? 'Saving...' : 'Save username'}
                        </button>
                    </div>
                </section>

                <section className="rounded-2xl border border-accent/30 bg-card/60 p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">Security</p>
                            <h2 className="text-xl font-bold text-accent">Change password</h2>
                        </div>
                        {passwordMessage && <span className="text-xs text-accent">{passwordMessage}</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <label className="text-sm text-muted">Current password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full rounded-lg border border-accent/60 bg-[#050a16] px-3 text-accent focus:border-neon outline-none"
                                style={{ padding: `var(--input-py) var(--input-px)` }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted">New password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full rounded-lg border border-accent/60 bg-[#050a16] px-3 text-accent focus:border-neon outline-none"
                                style={{ padding: `var(--input-py) var(--input-px)` }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted">Confirm new password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full rounded-lg border border-accent/60 bg-[#050a16] px-3 text-accent focus:border-neon outline-none"
                                style={{ padding: `var(--input-py) var(--input-px)` }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handlePasswordSave}
                            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                            className="px-4 py-2 rounded-lg bg-neon text-navy font-semibold hover:opacity-90 disabled:opacity-50"
                        >
                            {savingPassword ? 'Saving...' : 'Update password'}
                        </button>
                    </div>
                </section>
            </div>
        </PageContainer>
    );
}
