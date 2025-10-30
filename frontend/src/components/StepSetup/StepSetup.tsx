import React, { 
  useState, 
  useEffect, 
  useId, 
  useCallback,
  KeyboardEvent
} from 'react';
import { motion, MotionConfig, SpringOptions } from 'framer-motion';

// ===== TYP-DEFINITIONEN =====
export interface Step {
  id: string;
  title: string;
  subtitle?: string;
  optional?: boolean;
}

export interface StepSetupProps {
  /** Array der Schritte mit ID, Titel und optionalen Eigenschaften */
  steps: Step[];
  /** Kontrollierter aktueller Schritt-Index */
  current?: number;
  /** Unkontrollierter Standard-Schritt-Index */
  defaultCurrent?: number;
  /** Callback bei Schrittänderung */
  onChange?: (index: number) => void;
  /** Ausrichtung des Steppers */
  orientation?: 'horizontal' | 'vertical';
  /** Ob Steps anklickbar sind */
  clickable?: boolean;
  /** Größe der Step-Komponente */
  size?: 'sm' | 'md' | 'lg';
  /** Animation aktivieren/deaktivieren */
  animated?: boolean;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

export interface StepState {
  currentStep: number;
  isControlled: boolean;
}

// ===== HOOK FÜR ZUSTANDSVERWALTUNG =====
export const useStepSetup = (props: StepSetupProps) => {
  const {
    steps,
    current,
    defaultCurrent = 0,
    onChange,
    clickable = true
  } = props;

  const [internalStep, setInternalStep] = useState(defaultCurrent);
  const isControlled = current !== undefined;
  
  const currentStep = isControlled ? current : internalStep;

  // Clamp den Schritt-Index auf gültigen Bereich
  const clampedStep = Math.max(0, Math.min(currentStep, steps.length - 1));

  const setStep = useCallback((newStep: number) => {
    const clampedNewStep = Math.max(0, Math.min(newStep, steps.length - 1));
    
    if (!isControlled) {
      setInternalStep(clampedNewStep);
    }
    
    onChange?.(clampedNewStep);
  }, [isControlled, onChange, steps.length]);

  const goToNext = useCallback(() => {
    if (clampedStep < steps.length - 1) {
      setStep(clampedStep + 1);
    }
  }, [clampedStep, steps.length, setStep]);

  const goToPrev = useCallback(() => {
    if (clampedStep > 0) {
      setStep(clampedStep - 1);
    }
  }, [clampedStep, setStep]);

  const goToStep = useCallback((index: number) => {
    if (clickable) {
      setStep(index);
    }
  }, [clickable, setStep]);

  // Warnung bei Duplicate IDs (nur in Development)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const stepIds = steps.map(step => step.id);
      const duplicateIds = stepIds.filter((id, index) => stepIds.indexOf(id) !== index);
      
      if (duplicateIds.length > 0) {
        console.warn(
          `StepSetup: Duplicate step IDs found: ${duplicateIds.join(', ')}. ` +
          `Step IDs should be unique.`
        );
      }
    }
  }, [steps]);

  return {
    currentStep: clampedStep,
    setStep,
    goToNext,
    goToPrev,
    goToStep,
    isControlled
  };
};

// ===== ANIMATIONS-KONFIGURATION =====
const getAnimationConfig = (animated: boolean): { reduced: { duration: number }; normal: SpringOptions } => ({
  reduced: { duration: 0 }, // Keine Animation
  normal: {
    stiffness: 500,
    damping: 30,
    mass: 0.5
  }
});

// ===== HILFSFUNKTIONEN =====

/**
 * Berechnet die Step-Größenklassen basierend auf der size-Prop
 */
const getSizeClasses = (size: StepSetupProps['size'] = 'md') => {
  const sizes = {
    sm: {
      step: 'w-8 h-8 text-sm',
      icon: 'w-4 h-4',
      title: 'text-sm',
      subtitle: 'text-xs'
    },
    md: {
      step: 'w-10 h-10 text-base',
      icon: 'w-5 h-5',
      title: 'text-base',
      subtitle: 'text-sm'
    },
    lg: {
      step: 'w-12 h-12 text-lg',
      icon: 'w-6 h-6',
      title: 'text-lg',
      subtitle: 'text-base'
    }
  };
  
  return sizes[size];
};

/**
 * Prüft ob prefers-reduced-motion aktiv ist
 */
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// ===== STEP ICON KOMPONENTE =====
interface StepIconProps {
  stepIndex: number;
  currentStep: number;
  size: StepSetupProps['size'];
  animated: boolean;
}

const StepNumber: React.FC<{ number: number; isCurrent?: boolean; isCompleted?: boolean }> = ({ 
  number, 
  isCurrent = false, 
  isCompleted = false 
}) => {
  const baseClasses = `
    w-6 h-6
    flex items-center justify-center
    rounded-full text-xs font-medium
    transition-all duration-200
  `;
  
  if (isCompleted) {
    return (
      <div className={`${baseClasses} bg-blue-500 text-white`}>
        ✓
      </div>
    );
  }
  
  if (isCurrent) {
    return (
      <div className={`${baseClasses} bg-blue-500 text-white ring-2 ring-blue-500 ring-opacity-20`}>
        {number}
      </div>
    );
  }
  
  return (
    <div className={`${baseClasses} bg-gray-200 text-gray-600`}>
      {number}
    </div>
  );
};

const StepIcon: React.FC<StepIconProps> = ({ 
  stepIndex, 
  currentStep, 
  size,
  animated 
}) => {
  const isCompleted = stepIndex < currentStep;
  const isCurrent = stepIndex === currentStep;
  
  const sizeClasses = getSizeClasses(size);
  const animationConfig = getAnimationConfig(animated);
  const shouldAnimate = animated && !prefersReducedMotion();
  
  const baseClasses = `
    ${sizeClasses.step}
    flex items-center justify-center
    rounded-full border-2 font-medium
    transition-all duration-200
  `;
  
  if (isCompleted) {
    const completedClasses = `
      ${baseClasses}
      border-blue-500 bg-white
    `;
    
    const iconContent = shouldAnimate ? (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={animationConfig.normal}
      >
        <StepNumber number={stepIndex + 1} isCompleted />
      </motion.div>
    ) : (
      <StepNumber number={stepIndex + 1} isCompleted />
    );
    
    return (
      <div className={completedClasses}>
        {iconContent}
      </div>
    );
  }
  
  if (isCurrent) {
    const currentClasses = `
      ${baseClasses}
      border-blue-500 bg-white
    `;
    
    const stepNumber = shouldAnimate ? (
      <motion.div
        key={stepIndex}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={animationConfig.normal}
      >
        <StepNumber number={stepIndex + 1} isCurrent />
      </motion.div>
    ) : (
      <StepNumber number={stepIndex + 1} isCurrent />
    );
    
    return <div className={currentClasses}>{stepNumber}</div>;
  }
  
  const upcomingClasses = `
    ${baseClasses}
    border-gray-300 bg-white
  `;
  
  return (
    <div className={upcomingClasses}>
      <StepNumber number={stepIndex + 1} />
    </div>
  );
};

// ===== HAUPTKOMPONENTE =====

/**
 * Eine zugängliche, animierte Step/Progress-Komponente mit Unterstützung für 
 * kontrollierte und unkontrollierte Verwendung.
 * 
 * @example
 * ```tsx
 * <StepSetup 
 *   steps={[
 *     { id: 's1', title: 'First Step', subtitle: 'Optional description' },
 *     { id: 's2', title: 'Second Step' }
 *   ]}
 *   defaultCurrent={0}
 *   onChange={(index) => console.log('Step changed:', index)}
 * />
 * ```
 */
const StepSetup: React.FC<StepSetupProps> = (props) => {
  const {
    steps,
    orientation = 'horizontal',
    clickable = true,
    size = 'md',
    animated = true,
    className = ''
  } = props;
  
  const {
    currentStep,
    goToStep
  } = useStepSetup(props);
  
  const listId = useId();
  const shouldAnimate = animated && !prefersReducedMotion();
  const sizeClasses = getSizeClasses(size);
  
  // Fallback für leere Steps
  if (!steps || steps.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center p-4 text-gray-500 ${className}`}
        role="status"
        aria-live="polite"
      >
        No steps available
      </div>
    );
  }
  
  // Tastatur-Navigation Handler
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>, 
    stepIndex: number
  ) => {
    if (!clickable) return;
    
    const isHorizontal = orientation === 'horizontal';
    
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        goToStep(stepIndex);
        break;
        
      case 'ArrowRight':
      case 'ArrowDown':
        if ((isHorizontal && event.key === 'ArrowRight') || 
            (!isHorizontal && event.key === 'ArrowDown')) {
          event.preventDefault();
          const nextStep = Math.min(stepIndex + 1, steps.length - 1);
          goToStep(nextStep);
        }
        break;
        
      case 'ArrowLeft':
      case 'ArrowUp':
        if ((isHorizontal && event.key === 'ArrowLeft') || 
            (!isHorizontal && event.key === 'ArrowUp')) {
          event.preventDefault();
          const prevStep = Math.max(stepIndex - 1, 0);
          goToStep(prevStep);
        }
        break;
        
      case 'Home':
        event.preventDefault();
        goToStep(0);
        break;
        
      case 'End':
        event.preventDefault();
        goToStep(steps.length - 1);
        break;
    }
  };
  
  // Container-Klassen basierend auf Ausrichtung
  const containerClasses = `
    flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} 
    ${orientation === 'horizontal' ? 'items-center justify-center gap-8' : 'gap-6'}
    ${className}
  `;
  
  const StepContent = shouldAnimate ? motion.div : 'div';
  
  return (
    <MotionConfig reducedMotion={prefersReducedMotion() ? "always" : "user"}>
      <nav 
        className={containerClasses.trim()}
        aria-label="Progress steps"
        role="tablist"
      >
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = clickable && (isCompleted || isCurrent || step.optional);
          
          // Für horizontale Ausrichtung: flex-col mit zentrierten Items
          const stepClasses = `
            flex flex-col items-center
            gap-3
            ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
            transition-colors duration-200
            ${orientation === 'horizontal' ? 'flex-1' : ''}
          `;
          
          const contentClasses = `
            flex flex-col items-center text-center
            ${orientation === 'vertical' ? 'flex-1' : ''}
          `;
          
          // Verbindungslinie nur für horizontale Ausrichtung
          const connectorClasses = `
            flex-1 h-0.5 mt-5
            ${isCompleted ? 'bg-blue-500' : 'bg-gray-200'}
            transition-colors duration-200
            ${orientation === 'horizontal' ? '' : 'hidden'}
          `;
          
          return (
            <React.Fragment key={step.id}>
              <StepContent
                className={stepClasses}
                layout={shouldAnimate ? "position" : false}
                transition={shouldAnimate ? getAnimationConfig(animated).normal : undefined}
              >
                <div className="flex items-center w-full">
                  {/* Verbindungslinie vor dem Step (außer beim ersten) */}
                  {index > 0 && orientation === 'horizontal' && (
                    <div 
                      className={connectorClasses}
                      aria-hidden="true"
                    />
                  )}
                  
                  <button
                    type="button"
                    onClick={() => isClickable && goToStep(index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={!isClickable}
                    className={`
                      flex items-center justify-center
                      focus:outline-none focus:ring-2 
                      focus:ring-blue-500 focus:ring-offset-2 rounded-full
                      ${!isClickable ? 'opacity-50' : ''}
                      ${orientation === 'horizontal' ? 'mx-2' : ''}
                    `}
                    role="tab"
                    aria-selected={isCurrent}
                    aria-controls={`${listId}-${step.id}`}
                    id={`${listId}-tab-${step.id}`}
                    tabIndex={isCurrent ? 0 : -1}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-disabled={!isClickable}
                  >
                    <StepIcon 
                      stepIndex={index}
                      currentStep={currentStep}
                      size={size}
                      animated={animated}
                    />
                  </button>
                  
                  {/* Verbindungslinie nach dem Step (außer beim letzten) */}
                  {index < steps.length - 1 && orientation === 'horizontal' && (
                    <div 
                      className={connectorClasses}
                      aria-hidden="true"
                    />
                  )}
                </div>
                
                {/* Step Titel und Untertitel */}
                <div className={contentClasses}>
                  <span 
                    className={`
                      font-medium
                      ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'}
                      ${sizeClasses.title}
                    `}
                    id={`${listId}-title-${step.id}`}
                  >
                    {step.title}
                    {step.optional && (
                      <span className="text-gray-400 text-sm ml-1">(Optional)</span>
                    )}
                  </span>
                  
                  {step.subtitle && (
                    <span 
                      className={`
                        ${isCurrent ? 'text-gray-700' : 'text-gray-500'} 
                        ${sizeClasses.subtitle}
                      `}
                      id={`${listId}-subtitle-${step.id}`}
                    >
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </StepContent>
            </React.Fragment>
          );
        })}
      </nav>
    </MotionConfig>
  );
};

export default StepSetup;