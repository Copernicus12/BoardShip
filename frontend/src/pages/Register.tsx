export default function Register() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-accent px-4">
            <h1 className="text-2xl font-bold text-neon mb-6">Register</h1>
            <form className="bg-card border border-accent rounded-xl p-8 w-full max-w-xs">
                <input className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent" placeholder="Username" />
                <input className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent" placeholder="Email" />
                <input className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent" type="password" placeholder="Password" />
                <button className="w-full bg-neon hover:opacity-95 text-navy font-bold py-2 rounded transition">Create account</button>
            </form>
        </div>
    )
}
