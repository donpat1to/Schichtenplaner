// src/components/Scheduler.tsx
import React from 'react';
import { useScheduling } from '../hooks/useScheduling';

interface Props {
  scheduleRequest: ScheduleRequest;
}

export const Scheduler: React.FC<Props> = ({ scheduleRequest }) => {
  const { generateSchedule, loading, error, result } = useScheduling();
  
  const handleGenerateSchedule = async () => {
    try {
      await generateSchedule(scheduleRequest);
    } catch (err) {
      // Error handling
    }
  };
  
  return (
    <div>
      <button 
        onClick={handleGenerateSchedule} 
        disabled={loading}
      >
        {loading ? 'Generating Schedule...' : 'Generate Optimal Schedule'}
      </button>
      
      {loading && (
        <div>
          <progress max="100" value="70" />
          <p>Optimizing schedule... (max 2 minutes)</p>
        </div>
      )}
      
      {error && <div className="error">{error}</div>}
      
      {result && (
        <ScheduleResultView result={result} />
      )}
    </div>
  );
};