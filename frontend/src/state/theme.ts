import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

type ThemeState = {
    theme: Theme
    setTheme: (t: Theme) => void
    toggle: () => void
}

const applyThemeClass = (t: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(t);
    root.dataset.theme = t;
};

const useTheme = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            setTheme: (t: Theme) => {
                applyThemeClass(t);
                set({ theme: t });
            },
            toggle: () => {
                const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
                applyThemeClass(next);
                set({ theme: next });
            },
        }),
        { name: 'boardship-theme' }
    )
)

export default useTheme
