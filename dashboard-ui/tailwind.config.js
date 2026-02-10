/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                background: "#050505", // Deep void black
                surface: "#0a0a0a",    // Slightly lighter for cards
                primary: {
                    DEFAULT: "#7b3fe4",  // Vibrant Purple
                    foreground: "#ffffff",
                    glow: "rgba(123, 63, 228, 0.5)",
                },
                secondary: {
                    DEFAULT: "#00d4aa",  // Cyan/Teal
                    foreground: "#000000",
                    glow: "rgba(0, 212, 170, 0.5)",
                },
                accent: {
                    DEFAULT: "#ff2e63",  // Neon Pink/Red
                    foreground: "#ffffff",
                },
                muted: {
                    DEFAULT: "#1a1a1a",
                    foreground: "#a3a3a3",
                },
                border: "rgba(255, 255, 255, 0.1)",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)',
            },
            keyframes: {
                blob: {
                    "0%": { transform: "translate(0px, 0px) scale(1)" },
                    "33%": { transform: "translate(30px, -50px) scale(1.1)" },
                    "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
                    "100%": { transform: "translate(0px, 0px) scale(1)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-200%" },
                    "100%": { backgroundPosition: "200%" },
                },
                spotlight: {
                    "0%": { opacity: 0, transform: "translate(-72%, -62%) scale(0.5)" },
                    "100%": { opacity: 1, transform: "translate(-50%,-40%) scale(1)" },
                },
            },
            animation: {
                blob: "blob 7s infinite",
                shimmer: "shimmer 2s linear infinite",
                spotlight: "spotlight 2s ease .75s 1 forwards",
            },
        },
    },
    plugins: [],
}
