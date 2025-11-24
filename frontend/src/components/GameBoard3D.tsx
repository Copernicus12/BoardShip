import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

// Types for game state
type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

type Ship = {
    id: string;
    name: string;
    size: number;
    positions: Array<{ row: number; col: number }>;
    orientation: 'horizontal' | 'vertical';
    hits: number;
};

type BoardProps = {
    isPlayerBoard: boolean;
    size?: number;
    onCellClick?: (row: number, col: number) => void;
    initialShips?: Ship[];
    isClickable?: boolean;
    attacks?: Array<{row: number, col: number, isHit: boolean}>;
    pendingAttacks?: Array<{row: number, col: number}>;
};

// Individual water cell component
function WaterCell({
    position,
    state,
    onClick,
    isHovered,
    isClickable = true,
    isPending = false
}: {
    position: [number, number, number];
    state: CellState;
    onClick?: () => void;
    isHovered: boolean;
    isClickable?: boolean;
    isPending?: boolean;
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    const getColor = () => {
        switch (state) {
            case 'hit': return '#ff4444';
            case 'miss': return '#4444ff';
            case 'sunk': return '#aa0000';
            case 'ship': return '#555555';
            default: return isPending ? '#c28a00' : (isHovered ? '#2a7a9a' : '#1a5a7a');
        }
    };

    const canClick = isClickable && state === 'empty' && !isPending;

    return (
        <mesh
            ref={meshRef}
            position={position}
            onClick={canClick ? onClick : undefined}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                if (meshRef.current && canClick) {
                    document.body.style.cursor = 'pointer';
                } else if (meshRef.current) {
                    document.body.style.cursor = 'not-allowed';
                }
            }}
            onPointerOut={() => {
                document.body.style.cursor = 'default';
            }}
        >
            <boxGeometry args={[0.9, 0.15, 0.9]} />
            <meshStandardMaterial
                color={getColor()}
                metalness={0.4}
                roughness={0.6}
                emissive={state === 'hit' || state === 'sunk' ? '#ff0000' : '#000000'}
                emissiveIntensity={state === 'hit' || state === 'sunk' ? 0.3 : 0}
            />
        </mesh>
    );
}

// Ship component - 3D ship model
function Ship3D({
    position,
    size,
    orientation,
    isDestroyed
}: {
    position: [number, number, number];
    size: number;
    orientation: 'horizontal' | 'vertical';
    isDestroyed: boolean;
}) {
    const rotation: [number, number, number] = orientation === 'vertical'
        ? [0, Math.PI / 2, 0]
        : [0, 0, 0];

    const shipLength = size * 0.9;
    const shipWidth = 0.6;
    const shipHeight = 0.4;

    return (
        <group position={position} rotation={rotation}>
            {/* Main hull */}
            <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[shipLength, shipHeight, shipWidth]} />
                <meshStandardMaterial
                    color={isDestroyed ? '#333333' : '#666666'}
                    metalness={0.7}
                    roughness={0.3}
                />
            </mesh>

            {/* Deck/Superstructure */}
            <mesh position={[shipLength * 0.2, 0.6, 0]}>
                <boxGeometry args={[shipLength * 0.3, 0.3, shipWidth * 0.6]} />
                <meshStandardMaterial
                    color={isDestroyed ? '#222222' : '#555555'}
                    metalness={0.6}
                    roughness={0.4}
                />
            </mesh>

            {/* Front point (bow) */}
            <mesh position={[shipLength / 2, 0.3, 0]}>
                <coneGeometry args={[shipWidth / 2, shipWidth, 4]} />
                <meshStandardMaterial
                    color={isDestroyed ? '#333333' : '#666666'}
                    metalness={0.7}
                    roughness={0.3}
                />
            </mesh>

            {/* Smoke effect if destroyed */}
            {isDestroyed && (
                <>
                    <mesh position={[0, 1.2, 0]}>
                        <sphereGeometry args={[0.5, 8, 8]} />
                        <meshStandardMaterial
                            color="#ff4400"
                            emissive="#ff4400"
                            emissiveIntensity={0.8}
                            transparent
                            opacity={0.6}
                        />
                    </mesh>

                    {/* Red strike-through line */}
                    <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0]}>
                        <boxGeometry args={[shipLength + 0.5, 0.15, 0.15]} />
                        <meshStandardMaterial
                            color="#ff0000"
                            emissive="#ff0000"
                            emissiveIntensity={1}
                        />
                    </mesh>

                    {/* Red glow effect */}
                    <pointLight position={[0, 0.5, 0]} color="#ff0000" intensity={3} distance={shipLength + 2} />
                </>
            )}
        </group>
    );
}

// Explosion/Hit marker with X
function HitMarker({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Explosion sphere */}
            <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial
                    color="#ff0000"
                    emissive="#ff4400"
                    emissiveIntensity={1}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* X marker - first line */}
            <mesh position={[0, 0.8, 0]} rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.7, 0.1, 0.1]} />
                <meshStandardMaterial
                    color="#ff0000"
                    emissive="#ff0000"
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* X marker - second line */}
            <mesh position={[0, 0.8, 0]} rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.7, 0.1, 0.1]} />
                <meshStandardMaterial
                    color="#ff0000"
                    emissive="#ff0000"
                    emissiveIntensity={0.5}
                />
            </mesh>

            <pointLight position={[0, 0.5, 0]} color="#ff4400" intensity={2} distance={3} />
        </group>
    );
}

// Miss marker with checkmark/splash
function MissMarker({ position }: { position: [number, number, number] }) {
    return (
        <group position={[position[0], position[1] + 0.3, position[2]]}>
            {/* Water splash */}
            <mesh>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial
                    color="#4444ff"
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Small checkmark/indicator */}
            <mesh position={[0, 0.4, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial
                    color="#6666ff"
                    emissive="#6666ff"
                    emissiveIntensity={0.3}
                />
            </mesh>
        </group>
    );
}

// Main board grid component
function BoardGrid({ isPlayerBoard, size = 10, onCellClick, initialShips, isClickable = true, attacks = [], pendingAttacks = [] }: BoardProps) {
    const [hoveredCell] = useState<{ row: number; col: number } | null>(null);
    const [board, setBoard] = useState<CellState[][]>(
        Array(size).fill(null).map(() => Array(size).fill('empty'))
    );

    // Only use ships if they are provided (for player's board)
    // Enemy board should have empty ships array
    const [ships, setShips] = useState<Ship[]>(initialShips || []);

    // Update ships when initialShips prop changes
    useEffect(() => {
        if (initialShips && initialShips.length > 0) {
            console.log('Updating board with ships:', initialShips);
            setShips(initialShips);
        } else if (initialShips !== undefined) {
            // If initialShips is explicitly set to empty, clear ships
            setShips([]);
        }
    }, [initialShips]);

    // Update board when attacks change
    useEffect(() => {
        if (attacks && attacks.length > 0) {
            const newBoard = Array(size).fill(null).map(() => Array(size).fill('empty' as CellState));

            // Mark all attacked cells
            attacks.forEach(attack => {
                if (attack.row >= 0 && attack.row < size && attack.col >= 0 && attack.col < size) {
                    newBoard[attack.row][attack.col] = attack.isHit ? 'hit' : 'miss';
                }
            });

            setBoard(newBoard);
            console.log('Board updated with attacks:', attacks);
        }
    }, [attacks, size]);

    const handleCellClick = (row: number, col: number) => {
        // Check if board is clickable
        if (!isClickable) {
            console.log('🚫 Board is not clickable - not your turn!');
            return;
        }

        // Prevent clicking on already attacked cells
        const cellState = board[row][col];
        const isPending = Array.isArray(pendingAttacks) && pendingAttacks.some(p => p.row === row && p.col === col);
        if (cellState === 'hit' || cellState === 'miss' || isPending) {
            console.log('❌ Cell already attacked or pending!', { row, col, state: cellState, isPending });
            return;
        }

        // Only call the parent handler - don't update board locally
        // Board will be updated when we receive the attack result from server
        if (onCellClick) {
            onCellClick(row, col);
        }
    };

    const cells = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const x = col - size / 2 + 0.5;
            const z = row - size / 2 + 0.5;
            const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;

            const isPendingCell = Array.isArray(pendingAttacks) && pendingAttacks.some(p => p.row === row && p.col === col);
            cells.push(
                <WaterCell
                    key={`${row}-${col}`}
                    position={[x, 0, z]}
                    state={board[row][col]}
                    isHovered={isHovered}
                    isClickable={isClickable}
                    isPending={isPendingCell}
                    onClick={() => handleCellClick(row, col)}
                />
            );

            // Add hit/miss markers
            if (board[row][col] === 'hit') {
                cells.push(
                    <HitMarker key={`hit-${row}-${col}`} position={[x, 0, z]} />
                );
            } else if (board[row][col] === 'miss') {
                cells.push(
                    <MissMarker key={`miss-${row}-${col}`} position={[x, 0, z]} />
                );
            }
        }
    }

    // Render ships (only on player's board)
    const shipElements = isPlayerBoard ? ships.map(ship => {
        if (!ship || !ship.positions || ship.positions.length === 0) {
            return null;
        }

        // Calculate center position of the ship
        const centerPos = {
            row: ship.positions.reduce((sum, p) => sum + p.row, 0) / ship.positions.length,
            col: ship.positions.reduce((sum, p) => sum + p.col, 0) / ship.positions.length
        };

        const x = centerPos.col - size / 2 + 0.5;
        const z = centerPos.row - size / 2 + 0.5;
        const isDestroyed = ship.hits >= ship.size;

        return (
            <Ship3D
                key={ship.id}
                position={[x, 0, z]}
                size={ship.size}
                orientation={ship.orientation}
                isDestroyed={isDestroyed}
            />
        );
    }) : [];

    return (
        <group>
            {cells}
            {shipElements}

            {/* Grid lines */}
            <Grid
                args={[size, size]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#ffffff"
                sectionSize={size}
                sectionThickness={1}
                sectionColor="#4a9aba"
                fadeDistance={50}
                fadeStrength={1}
                position={[0, -0.01, 0]}
            />
        </group>
    );
}

// Main 3D Game Board Component
export default function GameBoard3D({
    isPlayerBoard = true,
    boardSize = 10,
    onCellClick,
    initialShips,
    isClickable = true,
    attacks = [],
    pendingAttacks = []
}: {
    isPlayerBoard?: boolean;
    boardSize?: number;
    onCellClick?: (row: number, col: number) => void;
    initialShips?: Ship[];
    isClickable?: boolean;
    attacks?: Array<{row: number, col: number, isHit: boolean}>;
    pendingAttacks?: Array<{row: number, col: number}>;
}) {
    return (
        <div className="w-full h-full rounded-lg overflow-hidden">
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 15, 15]} />

                {/* Lighting */}
                <ambientLight intensity={0.4} />
                <directionalLight
                    position={[10, 10, 5]}
                    intensity={1}
                    castShadow
                />
                <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4a9aba" />
                <pointLight position={[10, 5, 10]} intensity={0.3} color="#1a5a7a" />

                {/* Ocean/Water base */}
                <mesh position={[0, -0.5, 0]} receiveShadow>
                    <boxGeometry args={[20, 0.5, 20]} />
                    <meshStandardMaterial
                        color="#0a3a5a"
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>

                {/* Game Board */}
                <BoardGrid
                    isPlayerBoard={isPlayerBoard}
                    size={boardSize}
                    onCellClick={onCellClick}
                    initialShips={initialShips}
                    isClickable={isClickable}
                    attacks={attacks}
                    pendingAttacks={pendingAttacks}
                />

                {/* Camera controls - tuned */}
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={10}
                    maxDistance={30}
                    maxPolarAngle={Math.PI / 2.2}
                    rotateSpeed={0.8}
                    zoomSpeed={0.8}
                    panSpeed={0.8}
                />
            </Canvas>
        </div>
    );
}
