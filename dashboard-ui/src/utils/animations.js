export const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};

export const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.4
};

export const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

export const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export const cardHover = {
    scale: 1.02,
    transition: { duration: 0.2 }
};

export const buttonTap = {
    scale: 0.95
};
