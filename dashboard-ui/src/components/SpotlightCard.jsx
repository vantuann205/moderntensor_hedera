import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * SpotlightCard
 * A card component that reveals a radial gradient glow following the mouse cursor.
 * Adds depth and interactivity to the UI.
 *
 * @param {React.ReactNode} children - Card content
 * @param {string} className - Additional classes
 * @param {string} spotColor - Color of the spotlight (default: white/10)
 */
export default function SpotlightCard({ children, className = "", spotColor = "rgba(255, 255, 255, 0.15)" }) {
    const divRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e) => {
        if (!divRef.current) return;

        const rect = divRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseEnter = () => {
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden rounded-xl bg-surface border border-white/10 shadow-lg ${className}`}
        >
            {/* Spotlight Effect */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotColor}, transparent 40%)`,
                }}
            />

            {/* Inner Content */}
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
}
