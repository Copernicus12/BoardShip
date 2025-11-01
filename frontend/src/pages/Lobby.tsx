import PageContainer from "../components/PageContainer"

export default function Lobby() {
    return (
        <PageContainer>
            <div className="text-accent">
                <h1 className="text-3xl font-bold text-neon mb-6">Lobby</h1>
                <p className="text-muted">Here you will see available games and active players.</p>
            </div>
        </PageContainer>
    )
}
