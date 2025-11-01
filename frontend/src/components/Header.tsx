import { LogIn, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import useAuth from "../state/auth"

export default function Header() {
     const { user, logout, token } = useAuth()
     const nav = useNavigate()

     return (
         <header
            className={"flex items-end justify-end h-full px-8 py-8 animate-fadeIn"}
         >

             {/* 👤 Profile / Login */}
            <div className="flex items-center gap-3 relative">
                {/* decorative small blurred blob behind controls */}
                <div className="pointer-events-none absolute -left-8 -top-6 w-28 h-20 rounded-full" style={{ background: 'radial-gradient(ellipse at center, var(--neon, #00b4d8)20%, transparent)', filter: 'blur(12px)', opacity: 0.35 }} />

                {token && user ? (
                    <>
                        <div className="flex items-center gap-3 bg-card backdrop-blur-sm px-4 py-2 rounded-full border border-accent hover:border-neon transition shadow-lg">
                            <img
                                src={`https://ui-avatars.com/api/?name=${user.username}&background=0b1220&color=00b4d8`}
                                alt="avatar"
                                className="w-10 h-10 rounded-full border-2 border-accent"
                            />
                            <span className="text-base text-accent font-medium">{user.username}</span>
                        </div>

                        <button
                            onClick={() => {
                                logout()
                                nav("/login")
                            }}
                            className="flex items-center gap-2 bg-neon text-navy font-bold px-4 py-2.5 rounded-xl transition shadow-lg"
                        >
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => nav("/login")}
                        className="flex items-center gap-2 bg-neon text-navy font-bold px-4 py-2.5 rounded-xl transition shadow-lg"
                    >
                        <LogIn size={20} />
                        <span>Login</span>
                    </button>
                )}
            </div>
         </header>
     )
 }
