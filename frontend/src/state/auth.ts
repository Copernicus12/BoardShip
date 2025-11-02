import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

type User = { id: string; username: string; email: string }

type AuthState = {
    user: User | null
    token: string | null
    login: (email: string, password: string) => Promise<void>
    register: (username: string, email: string, password: string) => Promise<void>
    logout: () => void
    fetchMe: () => Promise<void>
}

const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,

            async login(email, password) {
                // Clear any existing token before login
                set({ token: null, user: null })
                const { data } = await api.post('/api/auth/login', { email, password })
                set({ token: data.token })
                await get().fetchMe()
            },

            async register(username, email, password) {
                // Clear any existing token before register
                set({ token: null, user: null })
                const { data } = await api.post('/api/auth/register', { username, email, password })
                set({ token: data.token })
                await get().fetchMe()
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