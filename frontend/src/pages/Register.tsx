import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../state/auth';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const register = useAuth((state) => state.register);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await register(username, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-accent px-4">
            <h1 className="text-2xl font-bold text-neon mb-6">Register</h1>
            <form onSubmit={handleSubmit} className="bg-card border border-accent rounded-xl p-8 w-full max-w-xs">
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <input
                    className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent focus:border-neon outline-none transition"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                />

                <input
                    className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent focus:border-neon outline-none transition"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />

                <input
                    className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent focus:border-neon outline-none transition"
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                />

                <button
                    type="submit"
                    className="w-full bg-neon hover:opacity-95 text-navy font-bold py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    {loading ? 'Creating account...' : 'Create account'}
                </button>

                <div className="mt-4 text-center text-sm">
                    <span className="text-accent">Already have an account? </span>
                    <Link to="/login" className="text-neon hover:underline">
                        Login here
                    </Link>
                </div>
            </form>
        </div>
    )
}