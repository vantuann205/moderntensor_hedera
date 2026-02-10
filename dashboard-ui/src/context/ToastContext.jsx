import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence initial={false}>
                    {toasts.map((toast, index) => (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                            className={`pointer-events-auto flex items-center gap-3 p-4 w-80 rounded-lg shadow-2xl border backdrop-blur-xl ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                    toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                        'bg-[#0a0a0a]/90 border-white/10 text-white'
                                }`}
                        >
                            {toast.type === 'success' ? <CheckCircle size={20} className="text-green-500" /> :
                                toast.type === 'error' ? <AlertCircle size={20} className="text-red-500" /> :
                                    <Info size={20} className="text-blue-400" />}

                            <span className="text-sm font-medium flex-1">{toast.message}</span>

                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-white/40 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
