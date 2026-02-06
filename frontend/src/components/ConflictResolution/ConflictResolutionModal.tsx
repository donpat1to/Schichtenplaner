import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import { AvailabilityConflict, ReplacementCandidate, ConflictResolution } from '../../services/employeeService';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService } from '../../services/weeklyPlanService';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: AvailabilityConflict[];
  onResolved: () => void;
  onCancel: () => void;
}

type ResolutionAction = 'swap' | 'unassign' | 'force_keep' | 'cancel';

interface ResolutionChoice {
  action: ResolutionAction;
  replacementEmployeeId?: string;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolved,
  onCancel
}) => {
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<number, ResolutionChoice>>({});
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConflict = conflicts[currentConflictIndex];
  const hasReplacements = currentConflict?.replacementCandidates?.length > 0;

  const handleActionSelect = (action: ResolutionAction) => {
    setSelectedAction(action);
    setSelectedReplacement(null);
    setError(null);

    if (action === 'swap' && hasReplacements) {
      // Auto-select best candidate (first in list, already sorted by preference)
      setSelectedReplacement(currentConflict.replacementCandidates[0].employeeId);
    }
  };

  const handleReplacementSelect = (employeeId: string) => {
    setSelectedReplacement(employeeId);
  };

  const handleConfirmResolution = () => {
    if (!selectedAction) {
      setError('Bitte wählen Sie eine Aktion aus');
      return;
    }

    if (selectedAction === 'swap' && !selectedReplacement) {
      setError('Bitte wählen Sie einen Ersatzmitarbeiter aus');
      return;
    }

    // Store the resolution
    setResolutions(prev => ({
      ...prev,
      [currentConflictIndex]: {
        action: selectedAction,
        replacementEmployeeId: selectedAction === 'swap' ? selectedReplacement || undefined : undefined
      }
    }));

    // Move to next conflict or process all resolutions
    if (currentConflictIndex < conflicts.length - 1) {
      setCurrentConflictIndex(prev => prev + 1);
      setSelectedAction(null);
      setSelectedReplacement(null);
      setError(null);
    } else {
      // All conflicts have resolutions, process them
      processAllResolutions({
        ...resolutions,
        [currentConflictIndex]: {
          action: selectedAction,
          replacementEmployeeId: selectedAction === 'swap' ? selectedReplacement || undefined : undefined
        }
      });
    }
  };

  const processAllResolutions = async (allResolutions: Record<number, ResolutionChoice>) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Check if any resolution is 'cancel'
      const hasCancellation = Object.values(allResolutions).some(r => r.action === 'cancel');
      if (hasCancellation) {
        onCancel();
        return;
      }

      // Process each resolution
      for (let i = 0; i < conflicts.length; i++) {
        const conflict = conflicts[i];
        const resolution = allResolutions[i];

        if (!resolution || resolution.action === 'cancel') {
          continue;
        }

        const resolutionData: ConflictResolution = {
          action: resolution.action,
          employeeId: conflict.employeeId,
          shiftId: conflict.shiftId,
          weekId: conflict.weekId,
          replacementEmployeeId: resolution.replacementEmployeeId
        };

        if (conflict.type === 'shift') {
          await shiftPlanService.resolveConflict(conflict.planId, resolutionData);
        } else {
          await weeklyPlanService.resolveConflict(conflict.planId, resolutionData);
        }
      }

      onResolved();
    } catch (err: any) {
      console.error('Error processing resolutions:', err);
      setError(err.message || 'Fehler beim Verarbeiten der Auflösungen');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAll = () => {
    onCancel();
  };

  const formatTime = (time: string) => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!isOpen || conflicts.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancelAll}
      title="Verfügbarkeitskonflikt"
      width="600px"
    >
      <div style={{ minHeight: '400px' }}>
        {/* Progress indicator */}
        {conflicts.length > 1 && (
          <div style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            Konflikt {currentConflictIndex + 1} von {conflicts.length}
          </div>
        )}

        {/* Conflict details */}
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
            Konflikt erkannt
          </h4>
          <p style={{ margin: '0 0 10px 0', color: '#856404' }}>
            <strong>{currentConflict.employeeName}</strong> ist im veröffentlichten Plan <strong>"{currentConflict.planName}"</strong> zugewiesen,
            möchte aber als nicht verfügbar markiert werden.
          </p>

          {/* Shift details */}
          {currentConflict.type === 'shift' && currentConflict.shiftDetails && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '4px'
            }}>
              <strong>Betroffene Schicht:</strong>
              <div style={{ marginTop: '5px' }}>
                {currentConflict.shiftDetails.dayName}, {currentConflict.shiftDetails.timeSlotName}
                <br />
                <span style={{ color: '#666' }}>
                  {formatTime(currentConflict.shiftDetails.startTime)} - {formatTime(currentConflict.shiftDetails.endTime)}
                </span>
              </div>
            </div>
          )}

          {/* Week details */}
          {currentConflict.type === 'weekly' && currentConflict.weekDetails && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '4px'
            }}>
              <strong>Betroffene Woche:</strong>
              <div style={{ marginTop: '5px' }}>
                KW {currentConflict.weekDetails.weekNumber}
                <br />
                <span style={{ color: '#666' }}>
                  {formatDate(currentConflict.weekDetails.startDate)} - {formatDate(currentConflict.weekDetails.endDate)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Resolution options */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Wie möchten Sie fortfahren?</h4>

          {/* Swap option */}
          <div
            onClick={() => hasReplacements && handleActionSelect('swap')}
            style={{
              padding: '15px',
              marginBottom: '10px',
              border: selectedAction === 'swap' ? '2px solid #27ae60' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: hasReplacements ? 'pointer' : 'not-allowed',
              backgroundColor: selectedAction === 'swap' ? '#d5f4e6' : (hasReplacements ? 'white' : '#f5f5f5'),
              opacity: hasReplacements ? 1 : 0.6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                checked={selectedAction === 'swap'}
                onChange={() => hasReplacements && handleActionSelect('swap')}
                disabled={!hasReplacements}
              />
              <div>
                <strong style={{ color: hasReplacements ? '#27ae60' : '#999' }}>
                  Ersatzmitarbeiter zuweisen
                </strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                  {hasReplacements
                    ? `${currentConflict.replacementCandidates.length} verfügbare Ersatzmitarbeiter gefunden`
                    : 'Keine verfügbaren Ersatzmitarbeiter gefunden'
                  }
                </p>
              </div>
            </div>

            {/* Replacement candidates */}
            {selectedAction === 'swap' && hasReplacements && (
              <div style={{ marginTop: '15px', paddingLeft: '30px' }}>
                <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                  Ersatzmitarbeiter auswählen:
                </label>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {currentConflict.replacementCandidates.map((candidate: ReplacementCandidate) => (
                    <div
                      key={candidate.employeeId}
                      onClick={() => handleReplacementSelect(candidate.employeeId)}
                      style={{
                        padding: '10px',
                        marginBottom: '5px',
                        border: selectedReplacement === candidate.employeeId ? '2px solid #27ae60' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: selectedReplacement === candidate.employeeId ? '#e8f8e8' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="radio"
                          checked={selectedReplacement === candidate.employeeId}
                          onChange={() => handleReplacementSelect(candidate.employeeId)}
                        />
                        <div>
                          <strong>{candidate.employeeName}</strong>
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: candidate.preferenceLevel === 1 ? '#27ae60' : '#f39c12',
                            color: 'white'
                          }}>
                            {candidate.preferenceLevel === 1 ? 'Bevorzugt' : 'Möglich'}
                          </span>
                          {candidate.isTrainee && (
                            <span style={{
                              marginLeft: '5px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              backgroundColor: '#CDA8F0',
                              color: 'white'
                            }}>
                              Trainee
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Unassign option */}
          <div
            onClick={() => currentConflict.canUnassign && handleActionSelect('unassign')}
            style={{
              padding: '15px',
              marginBottom: '10px',
              border: selectedAction === 'unassign' ? '2px solid #f39c12' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: currentConflict.canUnassign ? 'pointer' : 'not-allowed',
              backgroundColor: selectedAction === 'unassign' ? '#fef5e7' : (currentConflict.canUnassign ? 'white' : '#f5f5f5'),
              opacity: currentConflict.canUnassign ? 1 : 0.6
            }}
            title={!currentConflict.canUnassign ? currentConflict.unassignBlockedReason : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                checked={selectedAction === 'unassign'}
                onChange={() => currentConflict.canUnassign && handleActionSelect('unassign')}
                disabled={!currentConflict.canUnassign}
              />
              <div>
                <strong style={{ color: currentConflict.canUnassign ? '#f39c12' : '#999' }}>
                  Zuweisung entfernen
                </strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                  {currentConflict.canUnassign
                    ? `Mitarbeiter von der ${currentConflict.type === 'shift' ? 'Schicht' : 'Woche'} entfernen`
                    : `Nicht möglich: ${currentConflict.unassignBlockedReason}`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Force keep option */}
          <div
            onClick={() => handleActionSelect('force_keep')}
            style={{
              padding: '15px',
              marginBottom: '10px',
              border: selectedAction === 'force_keep' ? '2px solid #e74c3c' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: selectedAction === 'force_keep' ? '#fadbd8' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                checked={selectedAction === 'force_keep'}
                onChange={() => handleActionSelect('force_keep')}
              />
              <div>
                <strong style={{ color: '#e74c3c' }}>Zuweisung beibehalten</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                  Zuweisung trotz Verfügbarkeitsänderung beibehalten (Admin-Override)
                </p>
              </div>
            </div>
          </div>

          {/* Cancel option */}
          <div
            onClick={() => handleActionSelect('cancel')}
            style={{
              padding: '15px',
              border: selectedAction === 'cancel' ? '2px solid #95a5a6' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: selectedAction === 'cancel' ? '#ecf0f1' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                checked={selectedAction === 'cancel'}
                onChange={() => handleActionSelect('cancel')}
              />
              <div>
                <strong style={{ color: '#95a5a6' }}>Abbrechen</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                  Verfügbarkeitsänderung nicht speichern
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '10px',
            marginBottom: '15px',
            backgroundColor: '#fadbd8',
            border: '1px solid #e74c3c',
            borderRadius: '4px',
            color: '#c0392b'
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleCancelAll}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            Alle abbrechen
          </button>

          <button
            onClick={handleConfirmResolution}
            disabled={isProcessing || !selectedAction}
            style={{
              padding: '10px 20px',
              backgroundColor: isProcessing || !selectedAction ? '#bdc3c7' : '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isProcessing || !selectedAction ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? 'Wird verarbeitet...' :
              currentConflictIndex < conflicts.length - 1 ? 'Weiter' : 'Bestätigen'
            }
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictResolutionModal;
