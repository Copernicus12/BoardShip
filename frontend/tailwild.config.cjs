/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",                // fișierul HTML principal
        "./src/**/*.{js,ts,jsx,tsx}",  // toate fișierele React
    ],
    theme: {
        extend: {
            colors: {
                navy: '#0b1220',
                lightNavy: '#101a2e',
                neon: '#00b4d8',
                cyan: '#48cae4',
                accent: '#90e0ef',
            },
            fontFamily: {
                inter: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                glow: '0 0 10px rgba(0,180,216,0.6)',
            },
        },
    },
    plugins: [],
}

// This file is intentionally removed; use `tailwind.config.cjs` instead.
