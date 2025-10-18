import React from 'react';
import { useScheduling } from '../services/scheduling/useScheduling';
import { ScheduleRequest } from '../models/scheduling';

interface SchedulerProps {
  scheduleRequest: ScheduleRequest;
  onScheduleGenerated?: (result: any) => void;
}

export const Scheduler: React.FC<SchedulerProps> = ({ 
  scheduleRequest, 
  onScheduleGenerated 
}) => {
  const { generateSchedule, loading, error, result } = useScheduling();
  
  const handleGenerateSchedule = async () => {
    try {
      const scheduleResult = await generateSchedule(scheduleRequest);
      if (onScheduleGenerated) {
        onScheduleGenerated(scheduleResult);
      }
    } catch (err) {
      console.error('Scheduling failed:', err);
    }
  };
  
  return (
    <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <h3>Automatic Schedule Generation</h3>
      
      <button 
        onClick={handleGenerateSchedule} 
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#95a5a6' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {loading ? '🔄 Generating Schedule...' : '🚀 Generate Optimal Schedule'}
      </button>
      
      {loading && (
        <div style={{ marginTop: '15px' }}>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            backgroundColor: '#ecf0f1', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '70%',
              height: '100%',
              backgroundColor: '#3498db',
              animation: 'pulse 2s infinite',
              borderRadius: '4px'
            }} />
          </div>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '8px' }}>
            Optimizing schedule... (max 2 minutes)
          </p>
        </div>
      )}
      
      {error && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {result && (
        <div style={{ marginTop: '20px' }}>
          <ScheduleResultView result={result} />
        </div>
      )}
    </div>
  );
};

const ScheduleResultView: React.FC<{ result: any }> = ({ result }) => {
  return (
    <div style={{
      padding: '15px',
      backgroundColor: result.success ? '#d4edda' : '#f8d7da',
      border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
      borderRadius: '4px'
    }}>
      <h4 style={{ 
        color: result.success ? '#155724' : '#721c24',
        marginTop: 0
      }}>
        {result.success ? '✅ Schedule Generated Successfully' : '❌ Schedule Generation Failed'}
      </h4>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Assignments:</strong> {Object.keys(result.assignments || {}).length} shifts assigned
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Violations:</strong> {result.violations?.length || 0}
      </div>
      
      {result.resolution_report && result.resolution_report.length > 0 && (
        <details style={{ marginTop: '10px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Resolution Report
          </summary>
          <div style={{ 
            marginTop: '10px', 
            maxHeight: '200px', 
            overflow: 'auto',
            fontSize: '12px',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0,0,0,0.05)',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {result.resolution_report.map((line: string, index: number) => (
              <div key={index} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default Scheduler;