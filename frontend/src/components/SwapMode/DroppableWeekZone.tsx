// frontend/src/components/SwapMode/DroppableWeekZone.tsx
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import styles from './DroppableWeekZone.module.css';

interface DroppableWeekZoneProps {
  weekId: string;
  children: React.ReactNode;
  isValidTarget?: boolean;
  targetType?: 'direct' | 'two-step' | null;
}

const DroppableWeekZone: React.FC<DroppableWeekZoneProps> = ({
  weekId,
  children,
  isValidTarget = false,
  targetType = null
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-${weekId}`,
    data: { weekId }
  });

  const zoneClasses = [
    styles.droppableZone,
    isOver ? styles.dragOver : '',
    isValidTarget && targetType === 'direct' ? styles.validDirect : '',
    isValidTarget && targetType === 'two-step' ? styles.validTwoStep : ''
  ].filter(Boolean).join(' ');

  return (
    <div ref={setNodeRef} className={zoneClasses}>
      {children}
    </div>
  );
};

export default DroppableWeekZone;
