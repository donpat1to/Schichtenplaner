// frontend/src/services/scheduling/scheduling.ts

import { useState, useCallback } from 'react';
import { ScheduleRequest, ScheduleResult } from '../types/scheduling';

export const useScheduling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  
  const generateSchedule = useCallback(async (request: ScheduleRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/scheduling/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) throw new Error('Scheduling request failed');
      
      const data: ScheduleResult = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { generateSchedule, loading, error, result };
};