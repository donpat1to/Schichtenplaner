// frontend/src/pages/ShiftPlans/ShiftPlanCreate.tsx
import React, { useState } from 'react';

const ShiftPlanCreate: React.FC = () => {
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleCreate = async () => {
    // API Call zum Erstellen
  };

  return (
    <div>
      <h1>Neuen Schichtplan erstellen</h1>
      
      <div>
        <label>Plan Name:</label>
        <input 
          type="text" 
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
        />
      </div>

      <div>
        <label>Von:</label>
        <input 
          type="date" 
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div>
        <label>Bis:</label>
        <input 
          type="date" 
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <div>
        <label>Vorlage verwenden:</label>
        <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
          <option value="">Keine Vorlage</option>
          {/* Vorlagen laden */}
        </select>
      </div>

      <button onClick={handleCreate}>Schichtplan erstellen</button>
    </div>
  );
};