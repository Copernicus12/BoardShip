import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

type User = { id: string; username: string; email: string }

type AuthState = {
    user: User | null
    token: string | null
    login: (username: string, password: string) => Promise<void>
    register: (username: string, email: string, password: string) => Promise<void>
    logout: () => void
    fetchMe: () => Promise<void>
}

const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,

            async login(username, password) {
                const { data } = await api.post('/api/auth/login', { username, password })
                set({ token: data.accessToken })
                await get().fetchMe()
            },

            async register(username, email, password) {
                await api.post('/api/auth/register', { username, email, password })
            },

            logout() {
                set({ user: null, token: null })
            },

            async fetchMe() {
                const { data } = await api.get('/api/users/me')
                set({ user: data })
            },
        }),
        { name: 'boardship-auth' }
    )
)

export default useAuth
