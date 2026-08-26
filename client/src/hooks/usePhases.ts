/**
 * usePhases Hook
 * Custom hook for fetching and managing phases
 */

import { useState, useEffect } from 'react';
import { phaseService } from '../services/phaseService';
import { Phase } from '../types/phase';

export function usePhases() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadPhases = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await phaseService.getPhases();
        setPhases(data);
      } catch (err) {
        setError(err as Error);
        setPhases([]);
      } finally {
        setLoading(false);
      }
    };

    loadPhases();
  }, []);

  const getPhaseById = (phaseId: string): Phase | undefined => {
    return phases.find(p => p.id === phaseId);
  };

  const getPhaseNameById = (phaseId: string): string => {
    const phase = getPhaseById(phaseId);
    return phase?.name || phaseId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPhasesByIds = (phaseIds: string[]): Phase[] => {
    return phases.filter(p => phaseIds.includes(p.id));
  };

  return {
    phases,
    loading,
    error,
    getPhaseById,
    getPhaseNameById,
    getPhasesByIds
  };
}
