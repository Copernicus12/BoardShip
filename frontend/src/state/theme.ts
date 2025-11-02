import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

type ThemeState = {
    theme: Theme
    setTheme: (t: Theme) => void
    toggle: () => void
}

const useTheme = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'dark',
            setTheme: (t: Theme) => set({ theme: t }),
            toggle: () => set((state: any) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
        }),
        { name: 'boardship-theme' }
    )
)

export default useTheme
