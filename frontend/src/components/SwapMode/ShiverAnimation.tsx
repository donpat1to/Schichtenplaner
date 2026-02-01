// frontend/src/components/SwapMode/ShiverAnimation.tsx
import React from 'react';
import styles from './ShiverAnimation.module.css';

interface ShiverAnimationProps {
  children: React.ReactNode;
  active: boolean;
  intensity?: 'light' | 'strong';
}

const ShiverAnimation: React.FC<ShiverAnimationProps> = ({
  children,
  active,
  intensity = 'light'
}) => {
  if (!active) {
    return <>{children}</>;
  }

  const className = intensity === 'strong'
    ? styles.shiveringStrong
    : styles.shiveringLight;

  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default ShiverAnimation;
