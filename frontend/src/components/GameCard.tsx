type Game = {
    id: number
    name: string
    image: string
    price: number
    discount: number
}

export default function GameCard({ game }: { game: Game }) {
    return (
        <div className="bg-card border border-accent rounded-xl overflow-hidden hover:shadow-glow transition-all">
            <img src={game.image} alt={game.name} className="w-full h-40 object-cover" />
            <div className="p-4">
                <h3 className="text-accent text-lg font-semibold">{game.name}</h3>
                <div className="flex justify-between items-center mt-2 text-sm text-muted">
                    <span>-{game.discount}%</span>
                    <span>${game.price.toFixed(2)}</span>
                </div>
                <button className="mt-4 w-full bg-neon/80 hover:bg-neon text-navy font-bold py-2 rounded-md transition">
                    Join Game
                </button>
            </div>
        </div>
    )
}
