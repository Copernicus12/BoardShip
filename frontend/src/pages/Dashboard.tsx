import GameCard from "../components/GameCard"

export default function Dashboard() {
    const games = [
        { id: 1, name: "League of Legends", image: "/lol.jpg", price: 39.5, discount: 50 },
        { id: 2, name: "Mario Kart 8 Deluxe", image: "/mario.jpg", price: 36.79, discount: 30 },
        { id: 3, name: "Dota II", image: "/dota.jpg", price: 59.5, discount: 30 },
    ]

    return (
        <div className="min-h-screen">
            <h1 className="text-2xl text-neon font-bold mb-6">Games on Promotion</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((g) => <GameCard key={g.id} game={g} />)}
            </div>
        </div>
    )
}
