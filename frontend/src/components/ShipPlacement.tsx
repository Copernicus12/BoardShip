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
        <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                <h3 className="text-xl font-bold text-cyan-400 mb-3">📍 Place Your Fleet</h3>

                {/* Ship list */}
                <div className="space-y-2 mb-4">
                    {ships.map(ship => (
                        <div
                            key={ship.id}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                                ship.placed
                                    ? 'bg-green-500/20 border border-green-500/50'
                                    : selectedShip?.id === ship.id
                                    ? 'bg-cyan-500/30 border border-cyan-500'
                                    : 'bg-slate-700/50 border border-slate-600 hover:border-cyan-500/50'
                            }`}
                            onClick={() => !ship.placed && setSelectedShip(ship)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🚢</span>
                                <span className="font-semibold text-white">{ship.name}</span>
                                <span className="text-gray-400 text-sm">({ship.size} cells)</span>
                            </div>
                            {ship.placed ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeShip(ship.id);
                                    }}
                                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30"
                                >
                                    Remove
                                </button>
                            ) : selectedShip?.id === ship.id ? (
                                <span className="text-cyan-400 text-sm">← Selected</span>
                            ) : null}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={toggleOrientation}
                        disabled={!selectedShip}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-700/50 disabled:text-gray-500 text-purple-400 rounded border border-purple-500/50 disabled:border-slate-600 transition-all"
                    >
                        <RotateCw size={18} />
                        {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
                    </button>

                    <button
                        onClick={randomPlacement}
                        className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/50 transition-all"
                    >
                        🎲 Random
                    </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-10 gap-1 mb-4 bg-slate-900/50 p-2 rounded">
                    {Array.from({ length: boardSize * boardSize }).map((_, index) => {
                        const row = Math.floor(index / boardSize);
                        const col = index % boardSize;

                        const isOccupied = isCellOccupied(row, col);
                        const isHovered = hoveredCells.some(cell => cell.row === row && cell.col === col);

                        return (
                            <div
                                key={index}
                                className={`aspect-square rounded cursor-pointer transition-all border ${
                                    isOccupied
                                        ? 'bg-green-500/40 border-green-500'
                                        : isHovered
                                        ? canPlace
                                            ? 'bg-cyan-500/40 border-cyan-500'
                                            : 'bg-red-500/40 border-red-500'
                                        : 'bg-blue-900/30 border-blue-800 hover:bg-blue-700/40'
                                }`}
                                onMouseEnter={() => handleCellHover(row, col)}
                                onMouseLeave={() => setHoveredCells([])}
                                onClick={() => handleCellClick(row, col)}
                            />
                        );
                    })}
                </div>

                {/* Complete button */}
                <button
                    onClick={handleComplete}
                    disabled={!allShipsPlaced}
                    className="w-full px-6 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/50 disabled:text-gray-500 text-green-400 font-bold rounded border border-green-500/50 disabled:border-slate-600 transition-all"
                >
                    {allShipsPlaced ? '✓ Ready to Battle!' : `Place ${ships.filter(s => !s.placed).length} more ship(s)`}
                </button>
            </div>
        </div>
    );
}

