import { useState } from 'react';
import { RotateCw } from 'lucide-react';

type Ship = {
    id: string;
    name: string;
    size: number;
    placed: boolean;
};

type PlacedShip = {
    id: string;
    name: string;
    size: number;
    positions: Array<{ row: number; col: number }>;
    orientation: 'horizontal' | 'vertical';
};

type ShipPlacementProps = {
    onPlacementComplete: (ships: PlacedShip[]) => void;
};

const INITIAL_SHIPS: Ship[] = [
    { id: '1', name: 'Carrier', size: 5, placed: false },
    { id: '2', name: 'Battleship', size: 4, placed: false },
    { id: '3', name: 'Cruiser', size: 3, placed: false },
    { id: '4', name: 'Submarine', size: 3, placed: false },
    { id: '5', name: 'Destroyer', size: 2, placed: false },
];

export default function ShipPlacement({ onPlacementComplete }: ShipPlacementProps) {
    const [ships, setShips] = useState<Ship[]>(INITIAL_SHIPS);
    const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);
    const [selectedShip, setSelectedShip] = useState<Ship | null>(INITIAL_SHIPS[0]);
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [hoveredCells, setHoveredCells] = useState<Array<{ row: number; col: number }>>([]);
    const [canPlace, setCanPlace] = useState(true);
    const boardSize = 10;

    // Check if a cell is occupied
    const isCellOccupied = (row: number, col: number): boolean => {
        return placedShips.some(ship =>
            ship.positions.some(pos => pos.row === row && pos.col === col)
        );
    };

    // Check if ship placement is valid
    const isValidPlacement = (row: number, col: number, size: number, orient: 'horizontal' | 'vertical'): boolean => {
        for (let i = 0; i < size; i++) {
            const r = orient === 'vertical' ? row + i : row;
            const c = orient === 'horizontal' ? col + i : col;

            // Check boundaries
            if (r >= boardSize || c >= boardSize || r < 0 || c < 0) {
                return false;
            }

            // Check if occupied
            if (isCellOccupied(r, c)) {
                return false;
            }
        }

        return true;
    };

    // Get cells that would be occupied by ship
    const getShipCells = (row: number, col: number, size: number, orient: 'horizontal' | 'vertical'): Array<{ row: number; col: number }> => {
        const cells: Array<{ row: number; col: number }> = [];

        for (let i = 0; i < size; i++) {
            const r = orient === 'vertical' ? row + i : row;
            const c = orient === 'horizontal' ? col + i : col;
            cells.push({ row: r, col: c });
        }

        return cells;
    };

    const handleCellHover = (row: number, col: number) => {
        if (!selectedShip) return;

        const cells = getShipCells(row, col, selectedShip.size, orientation);
        const valid = isValidPlacement(row, col, selectedShip.size, orientation);

        setHoveredCells(cells);
        setCanPlace(valid);
    };

    const handleCellClick = (row: number, col: number) => {
        if (!selectedShip || !canPlace) {
            if (!canPlace && selectedShip) {
                console.warn('❌ Cannot place ship here - position is invalid or overlaps with another ship!');
            }
            return;
        }

        const positions = getShipCells(row, col, selectedShip.size, orientation);

        const newPlacedShip: PlacedShip = {
            id: selectedShip.id,
            name: selectedShip.name,
            size: selectedShip.size,
            positions,
            orientation
        };

        setPlacedShips([...placedShips, newPlacedShip]);

        const updatedShips = ships.map(s =>
            s.id === selectedShip.id ? { ...s, placed: true } : s
        );
        setShips(updatedShips);

        // Select next unplaced ship
        const nextShip = updatedShips.find(s => !s.placed);
        setSelectedShip(nextShip || null);
        setHoveredCells([]);
    };

    const removeShip = (shipId: string) => {
        setPlacedShips(placedShips.filter(s => s.id !== shipId));
        const updatedShips = ships.map(s =>
            s.id === shipId ? { ...s, placed: false } : s
        );
        setShips(updatedShips);

        if (!selectedShip) {
            const shipToSelect = updatedShips.find(s => s.id === shipId);
            setSelectedShip(shipToSelect || null);
        }
    };

    const toggleOrientation = () => {
        setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
        setHoveredCells([]);
    };

    const randomPlacement = () => {
        const newPlacedShips: PlacedShip[] = [];
        const tempOccupied = new Set<string>();

        const isOccupied = (row: number, col: number) => {
            return tempOccupied.has(`${row}-${col}`);
        };

        const canPlaceShip = (row: number, col: number, size: number, orient: 'horizontal' | 'vertical'): boolean => {
            for (let i = 0; i < size; i++) {
                const r = orient === 'vertical' ? row + i : row;
                const c = orient === 'horizontal' ? col + i : col;

                if (r >= boardSize || c >= boardSize || r < 0 || c < 0 || isOccupied(r, c)) {
                    return false;
                }
            }
            return true;
        };

        for (const ship of INITIAL_SHIPS) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 100) {
                const row = Math.floor(Math.random() * boardSize);
                const col = Math.floor(Math.random() * boardSize);
                const orient: 'horizontal' | 'vertical' = Math.random() > 0.5 ? 'horizontal' : 'vertical';

                if (canPlaceShip(row, col, ship.size, orient)) {
                    const positions = getShipCells(row, col, ship.size, orient);
                    newPlacedShips.push({
                        id: ship.id,
                        name: ship.name,
                        size: ship.size,
                        positions,
                        orientation: orient
                    });

                    positions.forEach(pos => {
                        tempOccupied.add(`${pos.row}-${pos.col}`);
                    });

                    placed = true;
                }
                attempts++;
            }
        }

        if (newPlacedShips.length === INITIAL_SHIPS.length) {
            setPlacedShips(newPlacedShips);
            setShips(ships.map(s => ({ ...s, placed: true })));
            setSelectedShip(null);
        }
    };

    const handleComplete = () => {
        if (placedShips.length === ships.length) {
            onPlacementComplete(placedShips);
        }
    };

    const allShipsPlaced = ships.every(s => s.placed);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-accent bg-card/80 p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -left-10 -top-8 h-48 w-48 bg-neon/10 blur-3xl" />
                <div className="absolute -right-10 bottom-0 h-56 w-56 bg-cyan/10 blur-3xl" />
                <div className="absolute inset-x-6 top-10 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
            </div>

            <div className="relative z-10 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Phase</p>
                        <h3 className="text-2xl font-bold text-neon">Place your fleet</h3>
                        <p className="text-sm text-muted">Select a ship, hover to preview, click to lock it in.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleOrientation}
                            disabled={!selectedShip}
                            className="flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-accent bg-navy/60 hover:border-neon hover:text-neon transition disabled:opacity-60"
                        >
                            <RotateCw size={16} />
                            {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
                        </button>
                        <button
                            onClick={randomPlacement}
                            className="rounded-lg border border-neon/40 bg-neon/10 px-4 py-2 text-neon font-semibold hover:opacity-90 transition"
                        >
                            Auto place
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    <div className="space-y-3">
                        {ships.map(ship => (
                            <div
                                key={ship.id}
                                className={`rounded-xl border px-3 py-2.5 flex items-center justify-between cursor-pointer transition ${
                                    ship.placed
                                        ? 'border-green-500/50 bg-green-500/10 text-green-200'
                                        : selectedShip?.id === ship.id
                                            ? 'border-neon bg-neon/10 text-neon'
                                            : 'border-accent bg-navy/50 text-accent hover:border-neon/40'
                                }`}
                                onClick={() => !ship.placed && setSelectedShip(ship)}
                            >
                                <div>
                                    <p className="text-sm font-semibold">{ship.name}</p>
                                    <p className="text-xs text-muted">{ship.size} cells</p>
                                </div>
                                {ship.placed ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeShip(ship.id);
                                        }}
                                        className="text-xs font-semibold rounded-md px-2 py-1 border border-red-400/60 text-red-200 hover:bg-red-500/10"
                                    >
                                        Remove
                                    </button>
                                ) : selectedShip?.id === ship.id ? (
                                    <span className="text-[11px] uppercase tracking-[0.15em] font-semibold">Selected</span>
                                ) : (
                                    <span className="text-[11px] uppercase tracking-[0.15em] text-muted">Tap to place</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-2xl border border-accent bg-navy/60 p-3">
                            <div className="grid grid-cols-10 gap-1 bg-card/50 p-2 rounded-lg">
                                {Array.from({ length: boardSize * boardSize }).map((_, index) => {
                                    const row = Math.floor(index / boardSize);
                                    const col = index % boardSize;

                                    const occupied = isCellOccupied(row, col);
                                    const hovered = hoveredCells.some(cell => cell.row === row && cell.col === col);

                                    return (
                                        <div
                                            key={index}
                                            className={`aspect-square rounded cursor-pointer border transition ${
                                                occupied
                                                    ? 'bg-neon/40 border-neon/70'
                                                    : hovered
                                                        ? canPlace
                                                            ? 'bg-cyan/30 border-cyan/60'
                                                            : 'bg-red-500/30 border-red-400/60'
                                                        : 'bg-card/40 border-accent/40 hover:border-neon/30'
                                            }`}
                                            onMouseEnter={() => handleCellHover(row, col)}
                                            onMouseLeave={() => setHoveredCells([])}
                                            onClick={() => handleCellClick(row, col)}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleComplete}
                            disabled={!allShipsPlaced}
                            className="w-full rounded-xl bg-neon text-navy font-semibold py-3 shadow-glow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {allShipsPlaced ? 'Ready to battle' : `Place ${ships.filter(s => !s.placed).length} ship(s)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
