import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import SkeletonLoader from './components/SkeletonLoader';

// Lazy load pages for performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const SubnetExplorer = React.lazy(() => import('./pages/SubnetExplorer'));
const TaskProtocol = React.lazy(() => import('./pages/TaskProtocol'));
const MinerLeaderboard = React.lazy(() => import('./pages/MinerLeaderboard'));
const SubnetPage = React.lazy(() => import('./pages/SubnetPage'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={
              <Suspense fallback={<SkeletonLoader type="dashboard" />}>
                <Dashboard />
              </Suspense>
            } />
            <Route path="subnets" element={
              <Suspense fallback={<div className="container py-8"><SkeletonLoader type="card" /></div>}>
                <SubnetExplorer />
              </Suspense>
            } />
            <Route path="tasks" element={
              <Suspense fallback={<div className="container py-8"><SkeletonLoader /></div>}>
                <TaskProtocol />
              </Suspense>
            } />
            <Route path="leaderboard" element={
              <Suspense fallback={<div className="container py-8"><SkeletonLoader /></div>}>
                <MinerLeaderboard />
              </Suspense>
            } />
            <Route path="subnet/:id" element={
              <Suspense fallback={<div className="container py-8"><SkeletonLoader /></div>}>
                <SubnetPage />
              </Suspense>
            } />
            <Route path="*" element={
              <Suspense fallback={<div className="bg-[#0a0a0a] min-h-screen" />}>
                <NotFound />
              </Suspense>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
