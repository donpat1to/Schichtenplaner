import { useState, useCallback } from 'react';
import { ScheduleRequest, ScheduleResult } from '../../models/scheduling';

export const useScheduling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  
  const generateSchedule = useCallback(async (request: ScheduleRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📤 Sending scheduling request:', {
        shiftPlan: request.shiftPlan.name,
        employees: request.employees.length,
        availabilities: request.availabilities.length,
        constraints: request.constraints.length
      });

      const response = await fetch('/api/scheduling/generate-schedule', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Scheduling request failed: ${response.status} ${errorText}`);
      }
      
      const data: ScheduleResult = await response.json();
      
      console.log('📥 Received scheduling result:', {
        success: data.success,
        assignments: Object.keys(data.assignments).length,
        violations: data.violations.length,
        processingTime: data.processingTime
      });
      
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown scheduling error';
      console.error('❌ Scheduling error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);
  
  return { 
    generateSchedule, 
    loading, 
    error, 
    result,
    reset
  };
};

// Export for backward compatibility
export default useScheduling;