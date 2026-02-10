import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const CHARS = "-_~`!@#$%^&*()+=[]{}|;:,.<>?/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * DecryptText
 * Animates text from random characters to the final string.
 * Simulates an "AI decoding" effect.
 *
 * @param {string} text - The final text to display
 * @param {number} speed - Speed of decryption in ms (default: 30)
 * @param {string} className - Additional classes
 * @param {boolean} animateOnHover - Whether to replay animation on hover
 */
export default function DecryptText({ text, speed = 30, className = "", animateOnHover = false }) {
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const intervalRef = useRef(null);

    const startAnimation = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        let iteration = 0;

        clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setDisplayText(prev =>
                text
                    .split("")
                    .map((char, index) => {
                        if (index < iteration) {
                            return text[index];
                        }
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                clearInterval(intervalRef.current);
                setIsAnimating(false);
            }

            iteration += 1 / 2; // Decrypt 1 char every 2 ticks for smoother effect
        }, speed);
    };

    useEffect(() => {
        startAnimation();
        return () => clearInterval(intervalRef.current);
    }, [text]);

    return (
        <motion.span
            className={`inline-block font-mono ${className}`}
            onMouseEnter={animateOnHover ? startAnimation : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {displayText}
        </motion.span>
    );
}
