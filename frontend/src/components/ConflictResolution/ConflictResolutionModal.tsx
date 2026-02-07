import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import { AvailabilityConflict, SwapCandidateInfo, ConflictResolution } from '../../services/employeeService';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: AvailabilityConflict[];
  onResolved: (resolutions: ConflictResolution[]) => void;
  onCancel: () => void;
}

type ResolutionAction = 'swap' | 'unassign' | 'force_keep' | 'cancel';

interface ResolutionChoice {
  action: ResolutionAction;
  swapEmployeeId?: string;
  swapShiftId?: string;  // The shift/week the source employee will take
  swapWeekId?: string;
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
  const [selectedSwapCandidate, setSelectedSwapCandidate] = useState<SwapCandidateInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConflict = conflicts[currentConflictIndex];
  const hasSwapCandidates = currentConflict?.swapCandidates?.length > 0;

  const handleActionSelect = (action: ResolutionAction) => {
    setSelectedAction(action);
    setSelectedSwapCandidate(null);
    setError(null);

    if (action === 'swap' && hasSwapCandidates) {
      // Auto-select best candidate (first in list, already sorted by preference)
      setSelectedSwapCandidate(currentConflict.swapCandidates[0]);
    }
  };

  const handleSwapCandidateSelect = (candidate: SwapCandidateInfo) => {
    setSelectedSwapCandidate(candidate);
  };

  const handleConfirmResolution = () => {
    if (!selectedAction) {
      setError('Bitte wählen Sie eine Aktion aus');
      return;
    }

    if (selectedAction === 'swap' && !selectedSwapCandidate) {
      setError('Bitte wählen Sie einen Tauschpartner aus');
      return;
    }

    // Store the resolution
    const resolutionChoice: ResolutionChoice = {
      action: selectedAction
    };

    if (selectedAction === 'swap' && selectedSwapCandidate) {
      resolutionChoice.swapEmployeeId = selectedSwapCandidate.employeeId;
      resolutionChoice.swapShiftId = selectedSwapCandidate.swapShift?.shiftId;
      resolutionChoice.swapWeekId = selectedSwapCandidate.swapWeek?.weekId;
    }

    setResolutions(prev => ({
      ...prev,
      [currentConflictIndex]: resolutionChoice
    }));

    // Move to next conflict or process all resolutions
    if (currentConflictIndex < conflicts.length - 1) {
      setCurrentConflictIndex(prev => prev + 1);
      setSelectedAction(null);
      setSelectedSwapCandidate(null);
      setError(null);
    } else {
      // All conflicts have resolutions, process them
      processAllResolutions({
        ...resolutions,
        [currentConflictIndex]: resolutionChoice
      });
    }
  };

  const processAllResolutions = (allResolutions: Record<number, ResolutionChoice>) => {
    setIsProcessing(true);
    setError(null);

    // Check if any resolution is 'cancel'
    const hasCancellation = Object.values(allResolutions).some(r => r.action === 'cancel');
    if (hasCancellation) {
      setIsProcessing(false);
      onCancel();
      return;
    }

    // Build resolution data for each conflict and pass back to parent
    const resolutionData: ConflictResolution[] = [];

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      const resolution = allResolutions[i];

      if (!resolution || resolution.action === 'cancel') {
        continue;
      }

      resolutionData.push({
        action: resolution.action,
        employeeId: conflict.employeeId,
        shiftId: conflict.shiftId,
        weekId: conflict.weekId,
        swapEmployeeId: resolution.swapEmployeeId,
        swapShiftId: resolution.swapShiftId,
        swapWeekId: resolution.swapWeekId
      });
    }

    setIsProcessing(false);
    // Pass resolutions back to parent for handling
    onResolved(resolutionData);
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
            onClick={() => hasSwapCandidates && handleActionSelect('swap')}
            style={{
              padding: '15px',
              marginBottom: '10px',
              border: selectedAction === 'swap' ? '2px solid #27ae60' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: hasSwapCandidates ? 'pointer' : 'not-allowed',
              backgroundColor: selectedAction === 'swap' ? '#d5f4e6' : (hasSwapCandidates ? 'white' : '#f5f5f5'),
              opacity: hasSwapCandidates ? 1 : 0.6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="radio"
                checked={selectedAction === 'swap'}
                onChange={() => hasSwapCandidates && handleActionSelect('swap')}
                disabled={!hasSwapCandidates}
              />
              <div>
                <strong style={{ color: hasSwapCandidates ? '#27ae60' : '#999' }}>
                  Schicht tauschen
                </strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
                  {hasSwapCandidates
                    ? `${currentConflict.swapCandidates.length} Tauschpartner gefunden`
                    : 'Keine Tauschpartner gefunden'
                  }
                </p>
              </div>
            </div>

            {/* Swap candidates */}
            {selectedAction === 'swap' && hasSwapCandidates && (
              <div style={{ marginTop: '15px', paddingLeft: '30px' }}>
                <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                  Tauschpartner auswählen:
                </label>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {currentConflict.swapCandidates.map((candidate: SwapCandidateInfo) => (
                    <div
                      key={`${candidate.employeeId}-${candidate.swapShift?.shiftId || candidate.swapWeek?.weekId}`}
                      onClick={() => handleSwapCandidateSelect(candidate)}
                      style={{
                        padding: '10px',
                        marginBottom: '5px',
                        border: selectedSwapCandidate?.employeeId === candidate.employeeId &&
                               (selectedSwapCandidate?.swapShift?.shiftId === candidate.swapShift?.shiftId ||
                                selectedSwapCandidate?.swapWeek?.weekId === candidate.swapWeek?.weekId)
                          ? '2px solid #27ae60' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: selectedSwapCandidate?.employeeId === candidate.employeeId &&
                                        (selectedSwapCandidate?.swapShift?.shiftId === candidate.swapShift?.shiftId ||
                                         selectedSwapCandidate?.swapWeek?.weekId === candidate.swapWeek?.weekId)
                          ? '#e8f8e8' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <input
                          type="radio"
                          checked={selectedSwapCandidate?.employeeId === candidate.employeeId &&
                                   (selectedSwapCandidate?.swapShift?.shiftId === candidate.swapShift?.shiftId ||
                                    selectedSwapCandidate?.swapWeek?.weekId === candidate.swapWeek?.weekId)}
                          onChange={() => handleSwapCandidateSelect(candidate)}
                          style={{ marginTop: '4px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                            <strong>{candidate.employeeName}</strong>
                            {candidate.isTrainee && (
                              <span style={{
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
                          {/* Show the shift/week to swap */}
                          {candidate.swapShift && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#f0f7ff',
                              borderRadius: '4px',
                              border: '1px solid #b8d4f0'
                            }}>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c5282' }}>
                                Tausch-Schicht:
                              </div>
                              <div style={{ fontSize: '13px', color: '#2c5282', marginTop: '2px' }}>
                                {candidate.swapShift.dayName} {formatTime(candidate.swapShift.startTime)}-{formatTime(candidate.swapShift.endTime)}
                                <span style={{ marginLeft: '5px', color: '#666' }}>({candidate.swapShift.timeSlotName})</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                {candidate.employeeName} übernimmt Ihre Schicht, Sie übernehmen diese Schicht
                              </div>
                            </div>
                          )}
                          {candidate.swapWeek && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#f0f7ff',
                              borderRadius: '4px',
                              border: '1px solid #b8d4f0'
                            }}>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c5282' }}>
                                Tausch-Woche:
                              </div>
                              <div style={{ fontSize: '13px', color: '#2c5282', marginTop: '2px' }}>
                                KW {candidate.swapWeek.weekNumber}
                                <span style={{ marginLeft: '5px', color: '#666' }}>
                                  ({formatDate(candidate.swapWeek.startDate)} - {formatDate(candidate.swapWeek.endDate)})
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                {candidate.employeeName} übernimmt Ihre Woche, Sie übernehmen diese Woche
                              </div>
                            </div>
                          )}
                          {/* Preference indicators */}
                          <div style={{ marginTop: '5px', fontSize: '11px', color: '#666', display: 'flex', gap: '10px' }}>
                            <span>
                              Partner-Präferenz:
                              <span style={{
                                marginLeft: '3px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: candidate.theirPreferenceForSourceShift === 1 ? '#d5f4e6' : '#fef5e7',
                                color: candidate.theirPreferenceForSourceShift === 1 ? '#27ae60' : '#f39c12'
                              }}>
                                {candidate.theirPreferenceForSourceShift === 1 ? 'Bevorzugt' : 'Möglich'}
                              </span>
                            </span>
                            <span>
                              Ihre Präferenz:
                              <span style={{
                                marginLeft: '3px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: candidate.sourcePreferenceForTheirShift === 1 ? '#d5f4e6' : '#fef5e7',
                                color: candidate.sourcePreferenceForTheirShift === 1 ? '#27ae60' : '#f39c12'
                              }}>
                                {candidate.sourcePreferenceForTheirShift === 1 ? 'Bevorzugt' : 'Möglich'}
                              </span>
                            </span>
                          </div>
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
