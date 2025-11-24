import { Home, Users, Settings, Anchor, X, Trophy, LayoutDashboard, User } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import useAuth from "../state/auth"

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
    const loc = useLocation()
    const { token } = useAuth()

    const menu = [
        { name: "Home", icon: <Home size={20} />, path: "/" },
        { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/dashboard" },
        { name: "Lobby", icon: <Users size={20} />, path: "/lobby" },
        { name: "Leaderboard", icon: <Trophy size={20} />, path: "/leaderboard" },
        { name: "Profile", icon: <User size={20} />, path: "/profile" },
        { name: "Settings", icon: <Settings size={20} />, path: "/settings" },
    ]

    const filteredMenu = token ? menu.filter((m) => m.path !== "/") : menu

    const mobileTransform = open ? "translate-x-0" : "-translate-x-full md:translate-x-0"

    return (
        <aside className={`
      fixed top-4 left-4 bottom-4
      w-64
      bg-card
      rounded-3xl
      shadow-[0_0_20px_rgba(0,180,216,0.15)]
      border border-accent
      flex flex-col justify-between
      overflow-hidden
      z-50
      transform transition-transform duration-300
      ${mobileTransform}
    `}>
            {/* Decorative glass blobs (liquid glass effect) */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                {/* soft cyan radial glow */}
                <div style={{ filter: "blur(60px)", opacity: 0.28 }} className="absolute -left-8 -top-10 w-56 h-56 rounded-full bg-[radial-gradient(ellipse_at_top_left,_rgba(0,180,216,0.45),_rgba(0,180,216,0.08),_transparent)]" />
                {/* subtle white sheen */}
                <div style={{ filter: "blur(36px)", opacity: 0.08 }} className="absolute -right-10 bottom-4 w-56 h-56 rounded-full bg-[radial-gradient(ellipse_at_bottom_right,_rgba(255,255,255,0.6),_rgba(255,255,255,0.02),_transparent)]" />
            </div>

            {/* Add a subtle inner glass overlay */}
            <div className="absolute inset-0 -z-0 bg-[rgba(255,255,255,0.02)] backdrop-blur-sm" />

            {/* LOGO */}
            <div className="pt-8 px-6 relative">
                <div className="flex items-center gap-3">
                    <Anchor size={28} className="text-neon" />
                    <h1 className="text-2xl font-extrabold text-neon tracking-wider select-none">
                        BoardShip
                    </h1>
                </div>

                {/* Close button for mobile */}
                <div className="md:hidden mt-3">
                    <button
                        onClick={() => onClose && onClose()}
                        aria-label="Close sidebar"
                        className="absolute top-4 right-4 p-2 rounded-md text-muted hover:text-neon bg-transparent"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-muted text-xs mt-1">Multiplayer Battleship</p>
            </div>

            {/* MENIU */}
            <nav className="flex flex-col gap-2 mt-10 px-4 relative z-10">
                {filteredMenu.map((m) => (
                    <Link
                        key={m.path}
                        to={m.path}
                        onClick={() => onClose && onClose()} /* close on navigation in mobile */
                        className={String.raw`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              ${
                            loc.pathname === m.path
                                ? "bg-neon/10 text-neon shadow-[inset_0_0_10px_rgba(0,180,216,0.3)] border border-neon/30"
                                : "text-muted hover:text-neon hover:bg-[rgba(10,140,160,0.06)]"
                        }
            `}
                    >
                        <div className={String.raw`
              p-2 rounded-lg transition
              ${
                            loc.pathname === m.path
                                ? "bg-neon/30 text-neon"
                                : "bg-[rgba(7,16,33,0.12)] text-muted hover:text-neon"
                        }
            `}>
                            {m.icon}
                        </div>
                        <span className="font-medium tracking-wide text-accent">{m.name}</span>
                    </Link>
                ))}
            </nav>

            {/* FOOTER */}
            <div className="p-5 border-t border-accent relative z-10">
                <p className="text-xs text-muted text-center">
                    © {new Date().getFullYear()} BoardShip
                </p>
            </div>
        </aside>
    )
}
