import {type ReactNode, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useAuth from "../state/auth"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, token, fetchMe } = useAuth()
    const nav = useNavigate()

    useEffect(() => {
        if (token && !user) fetchMe().catch(() => nav("/login"))
    }, [token])

    if (!token) {
        nav("/login")
        return null
    }

    return <>{children}</>
}
