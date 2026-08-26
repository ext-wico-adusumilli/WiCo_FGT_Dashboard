import { useAuth } from './useAuth';
import { useCallback } from 'react';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export function useApi() {
  const { token, refreshSession } = useAuth();

  const apiCall = useCallback(
    async (url: string, options: FetchOptions = {}) => {
      const { skipAuth = false, ...fetchOptions } = options;

      const headers = new Headers(fetchOptions.headers);

      if (!skipAuth && token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      headers.set('Content-Type', 'application/json');

      let response = await fetch(url, { ...fetchOptions, headers });

      if (response.status === 401 && !skipAuth && token) {
        const refreshed = await refreshSession();
        if (refreshed) {
          headers.set('Authorization', `Bearer ${token}`);
          response = await fetch(url, { ...fetchOptions, headers });
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [token, refreshSession]
  );

  return { apiCall };
}

