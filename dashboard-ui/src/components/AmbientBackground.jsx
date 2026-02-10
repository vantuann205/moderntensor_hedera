import React from 'react';
import { motion } from 'framer-motion';

/**
 * AmbientBackground
 * Renders a deep black background with:
 * 1. Slowly moving, blurred gradient orbs (Atmosphere)
 * 2. A subtle moving "Neural Grid" (Spatial Depth)
 * 3. Noise texture (Tactile feel)
 */
export default function AmbientBackground() {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-background">
            {/* Base gradient mesh */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-background to-background opacity-80" />

            {/* Neural Grid Effect */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px),
                                      linear-gradient(to bottom, #333 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
                }}
            >
                <motion.div
                    className="w-full h-full"
                    animate={{ y: [0, 40] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    style={{
                        backgroundImage: 'inherit',
                        backgroundSize: 'inherit',
                    }}
                />
            </div>

            {/* Animated Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] animate-blob" />
            <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-secondary/20 blur-[100px] animate-blob animate-delay-2000" />
            <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-accent/10 blur-[150px] animate-blob animate-delay-4000" />

            {/* Noise Texture Overlay for graininess */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
        </div>
    );
}
