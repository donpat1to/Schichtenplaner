// frontend/src/pages/ShiftTemplates/ShiftTemplateList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShiftTemplate } from '../../types/shiftTemplate';
import { shiftTemplateService } from '../../services/shiftTemplateService';
import { useAuth } from '../../contexts/AuthContext';

const ShiftTemplateList: React.FC = () => {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasRole } = useAuth();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await shiftTemplateService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Fehler:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return;
    
    try {
      await shiftTemplateService.deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (error) {
      console.error('Löschen fehlgeschlagen:', error);
    }
  };

  if (loading) return <div>Lade Vorlagen...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Schichtplan Vorlagen</h1>
        {hasRole(['admin', 'instandhalter']) && (
          <Link to="/shift-templates/new">
            <button style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
              Neue Vorlage
            </button>
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {templates.map(template => (
          <div key={template.id} style={{ 
            border: '1px solid #ddd', 
            padding: '15px', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{template.name}</h3>
                {template.description && (
                  <p style={{ margin: '0 0 10px 0', color: '#666' }}>{template.description}</p>
                )}
                <div style={{ fontSize: '14px', color: '#888' }}>
                  {template.shifts.length} Schichttypen • Erstellt am {new Date(template.createdAt).toLocaleDateString('de-DE')}
                  {template.isDefault && <span style={{ color: 'green', marginLeft: '10px' }}>• Standard</span>}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link to={`/shift-templates/${template.id}`}>
                  <button style={{ padding: '5px 10px', border: '1px solid #007bff', color: '#007bff', background: 'white' }}>
                    {hasRole(['admin', 'instandhalter']) ? 'Bearbeiten' : 'Ansehen'}
                  </button>
                </Link>
                
                {hasRole(['admin', 'instandhalter']) && (
                  <>
                    <Link to={`/shift-plans/new?template=${template.id}`}>
                      <button style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none' }}>
                        Verwenden
                      </button>
                    </Link>
                    <button 
                      onClick={() => handleDelete(template.id)}
                      style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none' }}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>Noch keine Vorlagen vorhanden.</p>
            {hasRole(['admin', 'instandhalter']) && (
              <Link to="/shift-templates/new">
                <button style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
                  Erste Vorlage erstellen
                </button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftTemplateList;