import useTheme from "../state/theme"
import PageContainer from "../components/PageContainer"

export default function Settings() {
    const theme = useTheme((s) => s.theme)
    const setTheme = useTheme((s) => s.setTheme)
    const toggle = useTheme((s) => s.toggle)

    return (
        <PageContainer>
            <h1 className="text-4xl font-bold text-neon mb-6">Settings</h1>

            <div className="bg-card rounded-2xl p-6 border border-accent shadow-lg">
                <h2 className="text-2xl font-semibold text-accent mb-4">Appearance</h2>

                <div className="flex items-center justify-between gap-4 bg-[rgba(255,255,255,0.02)] p-4 rounded-lg border border-accent">
                    <div>
                        <h3 className="font-medium text-accent">Theme</h3>
                        <p className="text-cyan/70 text-sm">Choose between dark and light mode</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setTheme('dark')}
                            className={`px-3 py-2 rounded-lg transition ${theme === 'dark' ? 'bg-cyan/20 text-neon' : 'bg-transparent text-muted hover:bg-cyan/10'}`}
                        >
                            Dark
                        </button>

                        <button
                            onClick={() => setTheme('light')}
                            className={`px-3 py-2 rounded-lg transition ${theme === 'light' ? 'bg-cyan/20 text-neon' : 'bg-transparent text-muted hover:bg-cyan/10'}`}
                        >
                            Light
                        </button>

                        <button
                            onClick={() => toggle()}
                            className="ml-2 px-3 py-2 rounded-lg bg-neon hover:opacity-95 text-navy font-semibold"
                        >
                            Toggle
                        </button>
                    </div>
                </div>

                <div className="mt-6">
                    <h2 className="text-2xl font-semibold text-accent mb-2">Account Settings</h2>
                    <p className="text-cyan/70">Settings page - coming soon!</p>
                </div>
            </div>
        </PageContainer>
    )
}