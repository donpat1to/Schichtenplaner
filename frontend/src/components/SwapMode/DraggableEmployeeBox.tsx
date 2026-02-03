// frontend/src/components/SwapMode/DraggableEmployeeBox.tsx
import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './DraggableEmployeeBox.module.css';

export type SwapEligibility = 'direct' | 'two-step' | null;

export interface DragData {
  employeeId: string;
  contextId: string; // Can be weekId or shiftId
  employeeName: string;
  isTrainee: boolean;
}

interface SwapableEmployee {
  id: string;
  firstname?: string | null;
  lastname?: string | null;
  employeeType?: string | null;
  isTrainee?: boolean | null;
}

interface DraggableEmployeeBoxProps {
  employee: SwapableEmployee;
  contextId: string; // Can be weekId or shiftId
  isSource: boolean;
  eligibility: SwapEligibility;
  isOverlay?: boolean;
}

const DraggableEmployeeBox: React.FC<DraggableEmployeeBoxProps> = ({
  employee,
  contextId,
  isSource,
  eligibility,
  isOverlay = false
}) => {
  const isManagerType = employee.employeeType === 'manager';
  const isTrainee = employee.isTrainee === true;
  const displayName = `${employee.firstname || ''} ${employee.lastname || ''}`.trim() || 'Unbekannt';

  const dragData: DragData = {
    employeeId: employee.id,
    contextId,
    employeeName: displayName,
    isTrainee
  };

  // Use :: as separator to avoid conflicts with UUIDs that contain dashes
  const boxId = `${employee.id}::${contextId}`;

  // Only use drag/drop hooks for non-overlay items
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging
  } = useDraggable({
    id: boxId,
    data: dragData,
    disabled: isManagerType || isOverlay
  });

  const {
    setNodeRef: setDroppableRef,
    isOver
  } = useDroppable({
    id: boxId,
    disabled: isOverlay
  });

  // Combine refs for both draggable and droppable for non-overlay
  const setNodeRef = (node: HTMLElement | null) => {
    if (!isOverlay) {
      setDraggableRef(node);
      setDroppableRef(node);
    }
  };

  const style = transform && !isOverlay ? {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'transform 0.2s ease',
  } : undefined;

  // Determine styling based on state
  const getBackgroundColor = (): string => {
    if (isOverlay) return isTrainee ? '#cda8f0' : '#642ab5';
    if (isDragging) return '#3498db';
    if (isSource) return '#3498db';
    if (eligibility === 'direct') return '#27ae60';
    if (eligibility === 'two-step') return 'rgba(230, 126, 34, 0.5)';
    if (isManagerType) return '#CC0000';
    if (isTrainee) return '#cda8f0';
    return '#642ab5';
  };

  const boxClasses = [
    isOverlay ? styles.overlayBox : styles.employeeBox,
    !isOverlay && isManagerType ? styles.nonInteractive : '',
    !isOverlay && !isManagerType ? styles.interactive : '',
    !isOverlay && isDragging ? styles.dragging : '',
    !isOverlay && isSource ? styles.source : '',
    !isOverlay && eligibility === 'direct' ? styles.directTarget : '',
    !isOverlay && eligibility === 'two-step' ? styles.twoStepTarget : '',
    !isOverlay && isOver && eligibility ? styles.isOver : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      className={boxClasses}
      style={{ ...style, backgroundColor: getBackgroundColor() }}
      title={isOverlay ? undefined : `${displayName}${isTrainee ? ' (Neuling)' : ''}${isManagerType ? ' (Manager)' : ''}`}
      {...(isOverlay || isManagerType ? {} : { ...attributes, ...listeners })}
    >
      {displayName}
      {!isOverlay && isSource && <span className={styles.sourceIndicator}>*</span>}
    </div>
  );
};

export default DraggableEmployeeBox;