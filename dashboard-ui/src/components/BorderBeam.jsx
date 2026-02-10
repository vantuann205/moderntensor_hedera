import React from 'react';
import { motion } from 'framer-motion';

/**
 * BorderBeam
 * Adds a moving gradient beam around the border of a container.
 * MUST be used inside a container with `relative` and `overflow-hidden` classes.
 *
 * @param {number} duration - Animation duration in seconds
 * @param {number} size - Length of the beam (default: 300)
 * @param {string} colorFrom - Start color of gradient
 * @param {string} colorTo - End color of gradient
 */
export default function BorderBeam({
    duration = 8,
    size = 300,
    colorFrom = "#7b3fe4",
    colorTo = "#00d4aa",
    className = ""
}) {
    return (
        <div
            className={`absolute inset-[0px] rounded-[inherit] pointer-events-none z-0 ${className}`}
            style={{ maskClip: 'padding-box, border-box' }}
        >
            <motion.div
                className="absolute inset-[-100%] bg-transparent"
                style={{
                    background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 340deg, ${colorFrom} 350deg, ${colorTo} 360deg)`,
                    offsetPath: `rect(0 auto auto 0 round ${size}px)`,
                }}
                animate={{ rotate: 360 }}
                transition={{
                    duration: duration,
                    ease: "linear",
                    repeat: Infinity,
                }}
            />
            {/* Fallback mask logic for reliable rendering across browsers */}
            <div
                className="absolute inset-0 rounded-[inherit] border border-transparent"
                style={{
                    mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                    maskComposite: 'exclude',
                    WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                    WebkitMaskComposite: 'xor',
                    padding: '1px',
                }}
            >
                <motion.div
                    className="absolute inset-[-50%] w-[200%] h-[200%] opacity-100"
                    style={{
                        background: `conic-gradient(from 0deg, transparent 0 340deg, ${colorFrom} 350deg, ${colorTo} 360deg)`,
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: duration,
                        ease: "linear",
                        repeat: Infinity,
                    }}
                />
            </div>
        </div>
    );
}
