export default function Login() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-accent px-4 relative">
            {/* decorative blurred blob behind form */}
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-44 rounded-full blur-3xl opacity-30 bg-[radial-gradient(ellipse_at_center,_rgba(0,180,216,0.25),_rgba(0,120,180,0.04),_transparent)] -z-10" />

            <h1 className="text-2xl font-bold text-neon mb-6">Login</h1>
            <form className="relative bg-card backdrop-blur-sm border border-accent rounded-xl p-8 w-full max-w-sm overflow-hidden">
                {/* subtle sheen */}
                <div className="absolute left-0 top-0 w-full h-1/2 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_transparent)] pointer-events-none" />

                <input className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent" placeholder="Username" />
                <input className="w-full mb-3 px-3 py-2 rounded bg-[rgba(11,17,32,0.12)] border border-accent text-accent" type="password" placeholder="Password" />
                <button className="w-full bg-neon hover:opacity-95 text-navy font-bold py-2 rounded transition">Sign in</button>
            </form>
        </div>
    )
}
