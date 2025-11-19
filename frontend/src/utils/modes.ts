// filepath: frontend/src/utils/modes.ts

export function formatModeLabel(mode?: string | null): string {
    if (!mode) return '';
    const m = mode.toLowerCase();
    if (m === 'speed') return '⚡ Speed';
    // Use a typographic trophy-like symbol instead of an emoji
    if (m === 'ranked') return '★ Ranked Mode';
    if (m === 'classic') return '⚓ Classic';
    // Fallback: capitalize first letter
    return mode.charAt(0).toUpperCase() + mode.slice(1);
}
