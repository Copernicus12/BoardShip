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
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-accent px-4 relative">
            {/* decorative blurred blob behind form */}
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-44 rounded-full blur-3xl opacity-30 bg-[radial-gradient(ellipse_at_center,_rgba(0,180,216,0.25),_rgba(0,120,180,0.04),_transparent)] -z-10" />

            <h1 className="text-2xl font-bold text-neon mb-6">Login</h1>
            <form onSubmit={handleSubmit} className="relative bg-card backdrop-blur-sm border border-accent rounded-xl p-8 w-full max-w-sm overflow-hidden">
                {/* subtle sheen */}
                <div className="absolute left-0 top-0 w-full h-1/2 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_transparent)] pointer-events-none" />

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm relative z-10">
                        {error}
                    </div>
                )}

                <input
                    className="relative z-10 w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent focus:border-neon outline-none transition"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />

                <input
                    className="relative z-10 w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent focus:border-neon outline-none transition"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                />

                <button
                    type="submit"
                    className="relative z-10 w-full bg-neon hover:opacity-95 text-navy font-bold py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>

                <div className="relative z-10 mt-4 text-center text-sm">
                    <span className="text-accent">Don't have an account? </span>
                    <Link to="/register" className="text-neon hover:underline">
                        Register here
                    </Link>
                </div>
            </form>
        </div>
    )
}