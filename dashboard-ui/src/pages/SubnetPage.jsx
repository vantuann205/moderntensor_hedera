import React from 'react';
import { useParams } from 'react-router-dom';

// Lazy-loaded components
const CodeReviewDemo = React.lazy(() => import('./CodeReviewDemo'));
const TaskProtocol = React.lazy(() => import('./TaskProtocol'));

/**
 * SubnetPage — Dynamic router for subnet detail pages.
 *
 * subnet/1 → AI Code Review Demo (featured subnet)
 * subnet/:id → Generic TaskProtocol view
 */
export default function SubnetPage() {
    const { id } = useParams();

    if (id === '1') {
        return <CodeReviewDemo />;
    }

    return <TaskProtocol />;
}
