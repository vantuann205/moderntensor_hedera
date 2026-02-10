import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const SoundContext = createContext(null);

export const useSound = () => useContext(SoundContext);

/**
 * SoundProvider
 * Uses Web Audio API to synthesize UI sounds locally.
 * No external assets required.
 */
export const SoundProvider = ({ children, enabled = true }) => {
    const [isMuted, setIsMuted] = useState(!enabled);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);

    const initAudio = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
                gainNodeRef.current = audioContextRef.current.createGain();
                gainNodeRef.current.connect(audioContextRef.current.destination);
                gainNodeRef.current.gain.value = 0.1; // Master volume
            }
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    // Play a synthesized sound
    const play = useCallback((type) => {
        if (isMuted || !audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(gainNodeRef.current);

        const now = ctx.currentTime;

        switch (type) {
            case 'hover':
                // High frequency, very short blip
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                gainNode.gain.setValueAtTime(0.05, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;

            case 'click':
                // Mechanical click
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;

            case 'success':
                // Ascending melodic chime
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(440, now);
                oscillator.frequency.setValueAtTime(554.37, now + 0.1); // C#
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                oscillator.start(now);
                oscillator.stop(now + 0.4);
                break;

            case 'error':
                // Descending low tone
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, now);
                oscillator.frequency.linearRampToValueAtTime(100, now + 0.2);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;

            case 'on':
                // Power up sound
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(220, now);
                oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.3);
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            default:
                break;
        }
    }, [isMuted]);

    const toggleMute = () => setIsMuted(prev => !prev);

    // Initialize audio on first user interaction to comply with autoplay policy
    useEffect(() => {
        const handleInteraction = () => {
            initAudio();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [initAudio]);

    return (
        <SoundContext.Provider value={{ play, toggleMute, isMuted }}>
            {children}
        </SoundContext.Provider>
    );
};
