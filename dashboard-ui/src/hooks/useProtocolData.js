/**
 * useProtocolData.js — React hook for fetching & caching protocol data
 *
 * Follows react-ui-patterns skill:
 * - Loading states shown ONLY when no data exists
 * - Errors always surfaced to user via toast
 * - Graceful degradation with partial data
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic data-fetching hook with loading/error states
 * @param {Function} fetcher - sync or async function returning { data, error }
 * @param {Object} options - { autoFetch, deps, onError, cacheKey }
 */
export function useProtocolData(fetcher, options = {}) {
    const {
        autoFetch = true,
        deps = [],
        onError = null,
        cacheKey = null,
    } = options;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(autoFetch);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);
    const cacheRef = useRef(new Map());

    const fetch = useCallback(async (...args) => {
        // Check cache first
        if (cacheKey && cacheRef.current.has(cacheKey)) {
            const cached = cacheRef.current.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) { // 30s cache TTL
                setData(cached.data);
                setLoading(false);
                return cached.data;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const result = await fetcher(...args);

            if (!mountedRef.current) return null;

            if (result.error) {
                setError(result.error);
                onError?.(result.error);
                setLoading(false);
                return null;
            }

            setData(result.data);

            // Cache the result
            if (cacheKey) {
                cacheRef.current.set(cacheKey, {
                    data: result.data,
                    timestamp: Date.now(),
                });
            }

            setLoading(false);
            return result.data;
        } catch (err) {
            if (!mountedRef.current) return null;
            const errorMsg = err.message || 'An unexpected error occurred';
            setError(errorMsg);
            onError?.(errorMsg);
            setLoading(false);
            return null;
        }
    }, [fetcher, cacheKey, onError]);

    useEffect(() => {
        mountedRef.current = true;
        if (autoFetch) {
            fetch();
        }
        return () => {
            mountedRef.current = false;
        };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    const refetch = useCallback((...args) => {
        // Invalidate cache on refetch
        if (cacheKey) {
            cacheRef.current.delete(cacheKey);
        }
        return fetch(...args);
    }, [fetch, cacheKey]);

    return {
        data,
        loading,
        error,
        fetch,
        refetch,
        setData,
    };
}

/**
 * Hook for async mutations (task submission, miner registration, code review)
 * Follows react-ui-patterns: buttons disabled during submission, errors surfaced
 * @param {Function} mutationFn - async function returning { data, error }
 */
export function useMutation(mutationFn) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const mutate = useCallback(async (...args) => {
        setLoading(true);
        setError(null);
        setData(null);

        try {
            const result = await mutationFn(...args);

            if (!mountedRef.current) return null;

            if (result.error) {
                setError(result.error);
                setLoading(false);
                return { data: null, error: result.error };
            }

            setData(result.data);
            setLoading(false);
            return { data: result.data, error: null };
        } catch (err) {
            if (!mountedRef.current) return null;
            const errorMsg = err.message || 'Operation failed';
            setError(errorMsg);
            setLoading(false);
            return { data: null, error: errorMsg };
        }
    }, [mutationFn]);

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setData(null);
    }, []);

    return {
        mutate,
        loading,
        error,
        data,
        reset,
    };
}

export default useProtocolData;
