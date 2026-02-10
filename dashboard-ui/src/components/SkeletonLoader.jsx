import React from 'react';

const Skeleton = ({ className }) => (
    <div className={`should-animate-pulse bg-white/10 rounded ${className}`} />
);

export default function SkeletonLoader({ type = 'dashboard' }) {
    if (type === 'dashboard') {
        return (
            <div className="container py-8 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="card p-6 h-32 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <Skeleton className="w-8 h-8 rounded-lg" />
                                <Skeleton className="w-16 h-4" />
                            </div>
                            <Skeleton className="w-24 h-8 mt-2" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="card h-[300px] lg:col-span-2 p-6">
                        <Skeleton className="w-48 h-6 mb-6" />
                        <Skeleton className="w-full h-48" />
                    </div>
                    <div className="card h-[300px] p-6">
                        <Skeleton className="w-32 h-6 mb-6" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="w-full h-12" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'card') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card h-64 p-6 flex flex-col">
                        <div className="flex justify-between mb-4">
                            <Skeleton className="w-8 h-6" />
                            <Skeleton className="w-16 h-6 rounded-full" />
                        </div>
                        <Skeleton className="w-3/4 h-6 mb-2" />
                        <Skeleton className="w-full h-12 mb-6" />
                        <div className="mt-auto grid grid-cols-3 gap-2">
                            <Skeleton className="h-12 rounded-lg" />
                            <Skeleton className="h-12 rounded-lg" />
                            <Skeleton className="h-12 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return <Skeleton className="w-full h-full min-h-[50vh]" />;
}
