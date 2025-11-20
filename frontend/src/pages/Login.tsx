import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../state/auth';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const login = useAuth((state) => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-app flex items-center justify-center px-4 py-16 text-accent overflow-hidden">
            {/* floating glows */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -right-10 top-8 w-80 h-80 bg-[radial-gradient(circle_at_center,_rgba(0,180,216,0.28),_transparent_55%)] blur-3xl opacity-70" />
                <div className="absolute -left-10 bottom-0 w-96 h-96 bg-[radial-gradient(circle_at_center,_rgba(72,202,228,0.26),_transparent_55%)] blur-3xl opacity-60" />
                <div className="absolute inset-x-10 top-1/3 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
                <div className="absolute inset-y-10 left-1/2 w-px bg-gradient-to-b from-transparent via-neon/30 to-transparent" />
            </div>

            <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-stretch">
                <div className="relative bg-card/80 border border-accent rounded-2xl p-8 md:p-10 overflow-hidden backdrop-blur">
                    <div className="absolute inset-0 bg-gradient-to-br from-neon/10 via-transparent to-cyan/10" />
                    <div className="absolute -left-20 -top-16 w-52 h-52 rounded-full bg-neon/10 blur-3xl" />
                    <div className="absolute -right-14 bottom-0 w-64 h-64 rounded-full bg-cyan/10 blur-3xl" />

                    <div className="relative z-10 flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-xl bg-neon/20 border border-neon/40 flex items-center justify-center text-neon font-bold">
                            B
                        </div>
                        <div>
                            <p className="text-muted text-xs uppercase tracking-[0.2em]">Command Hub</p>
                            <h1 className="text-2xl font-bold text-neon">BoardShip Access</h1>
                        </div>
                    </div>

                    <p className="relative z-10 text-lg text-accent mb-5">
                        Conecteaza-te si continua sa-ti orchestrezi flota. Panou aerisit, acelasi vibe neon.
                    </p>

                    <div className="relative z-10 grid gap-4">
                        <div className="flex items-start gap-3 bg-navy/40 border border-accent rounded-xl p-3">
                            <div className="mt-1 h-2 w-2 rounded-full bg-neon shadow-glow" />
                            <div>
                                <p className="text-sm text-neon font-semibold">Protectie & control</p>
                                <p className="text-sm text-muted">Autentificare sigura si acces instant in puntea de comanda.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-navy/40 border border-accent rounded-xl p-3">
                            <div className="mt-1 h-2 w-2 rounded-full bg-cyan shadow-glow" />
                            <div>
                                <p className="text-sm text-neon font-semibold">Status vizibil</p>
                                <p className="text-sm text-muted">Vezi rapid sesiunea, progresul si cine mai navigheaza cu tine.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-navy/40 border border-accent rounded-xl p-3">
                            <div className="mt-1 h-2 w-2 rounded-full bg-neon shadow-glow" />
                            <div>
                                <p className="text-sm text-neon font-semibold">Treci direct la actiune</p>
                                <p className="text-sm text-muted">Dupa login mergi direct in dashboard sau lanseaza o noua batalie.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="relative bg-card/80 backdrop-blur border border-neon-30 rounded-2xl p-8 md:p-10 overflow-hidden shadow-lg"
                >
                    <div className="absolute left-1/2 -translate-x-1/2 -top-12 w-72 h-72 bg-[radial-gradient(circle,_rgba(0,180,216,0.25),_transparent_60%)] blur-3xl opacity-70 pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.0))]" />

                    <div className="relative z-10 flex items-center justify-between mb-6">
                        <div>
                            <p className="text-muted text-xs uppercase tracking-[0.25em]">Logare flota</p>
                            <h2 className="text-3xl font-bold text-neon">Login</h2>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-neon/20 border border-neon/40 text-[12px] text-neon font-semibold">
                            Secure channel
                        </div>
                    </div>

                    {error && (
                        <div className="relative z-10 mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <label className="relative z-10 mb-4 block">
                        <span className="text-xs uppercase tracking-[0.08em] text-muted">Email</span>
                        <input
                            className="mt-1 w-full px-3 py-3 rounded-lg bg-[rgba(11,17,32,0.2)] border border-accent text-accent focus:border-neon outline-none transition placeholder:text-muted"
                            placeholder="pilot@boardship.gg"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </label>

                    <label className="relative z-10 mb-6 block">
                        <span className="text-xs uppercase tracking-[0.08em] text-muted">Parola</span>
                        <input
                            className="mt-1 w-full px-3 py-3 rounded-lg bg-[rgba(11,17,32,0.2)] border border-accent text-accent focus:border-neon outline-none transition placeholder:text-muted"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </label>

                    <button
                        type="submit"
                        className="relative z-10 w-full bg-neon hover:opacity-95 text-navy font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>

                    <div className="relative z-10 mt-4 text-center text-sm">
                        <span className="text-accent">Nu ai cont? </span>
                        <Link to="/register" className="text-neon hover:underline font-semibold">
                            Inregistreaza-te
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
