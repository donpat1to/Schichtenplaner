// frontend/src/pages/ShiftTemplates/ShiftTemplateList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShiftTemplate } from '../../types/shiftTemplate';
import { shiftTemplateService } from '../../services/shiftTemplateService';
import { useAuth } from '../../contexts/AuthContext';
import DefaultTemplateView from './components/DefaultTemplateView';
import styles from './ShiftTemplateList.module.css';

const ShiftTemplateList: React.FC = () => {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasRole } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await shiftTemplateService.getTemplates();
      setTemplates(data);
      // Setze die Standard-Vorlage als ausgewählt
      const defaultTemplate = data.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
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
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Löschen fehlgeschlagen:', error);
    }
  };

  if (loading) return <div>Lade Vorlagen...</div>;

  return (
    <div className={styles.templateList}>
      <div className={styles.header}>
        <h1>Schichtplan Vorlagen</h1>
        {hasRole(['admin', 'instandhalter']) && (
          <Link to="/shift-templates/new">
            <button className={styles.createButton}>
              Neue Vorlage
            </button>
          </Link>
        )}
      </div>

      <div className={styles.templateGrid}>
        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>Noch keine Vorlagen vorhanden.</p>
            {hasRole(['admin', 'instandhalter']) && (
              <Link to="/shift-templates/new">
                <button className={styles.createButton}>
                  Erste Vorlage erstellen
                </button>
              </Link>
            )}
          </div>
        ) : (
          templates.map(template => (
            <div key={template.id} className={styles.templateCard}>
              <div className={styles.templateHeader}>
                <div className={styles.templateInfo}>
                  <h3>{template.name}</h3>
                  {template.description && (
                    <p>{template.description}</p>
                  )}
                  <div className={styles.templateMeta}>
                    {template.shifts.length} Schichttypen • Erstellt am {new Date(template.createdAt).toLocaleDateString('de-DE')}
                    {template.isDefault && <span className={styles.defaultBadge}>• Standard</span>}
                  </div>
                </div>
                
                <div className={styles.actionButtons}>
                  <button 
                    className={styles.viewButton}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    Vorschau
                  </button>
                  
                  {hasRole(['admin', 'instandhalter']) && (
                    <>
                      <Link to={`/shift-templates/${template.id}`}>
                        <button className={styles.viewButton}>
                          Bearbeiten
                        </button>
                      </Link>
                      <Link to={`/shift-plans/new?template=${template.id}`}>
                        <button className={styles.useButton}>
                          Verwenden
                        </button>
                      </Link>
                      <button 
                        onClick={() => handleDelete(template.id)}
                        className={styles.deleteButton}
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTemplate && (
        <div style={{ marginTop: '30px' }}>
          <DefaultTemplateView template={selectedTemplate} />
        </div>
      )}
    </div>
  );
};

export default ShiftTemplateList;