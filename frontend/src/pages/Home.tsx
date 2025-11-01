import PageContainer from "../components/PageContainer"

export default function Home() {
    return (
        <PageContainer>
            <div className="text-accent">
                <h1 className="text-3xl font-bold text-neon mb-4">Welcome to BoardShip</h1>
                <p className="text-muted">Choose “Lobby” to join or start a new game.</p>
            </div>
        </PageContainer>
    )
}
