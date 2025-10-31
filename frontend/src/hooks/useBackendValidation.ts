// frontend/src/hooks/useBackendValidation.ts
import { useState, useCallback } from 'react';
import { ValidationError } from '../services/errorService';
import { useNotification } from '../contexts/NotificationContext';

export const useBackendValidation = () => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const getFieldError = useCallback((fieldName: string): string | null => {
    const error = validationErrors.find(error => error.field === fieldName);
    return error ? error.message : null;
  }, [validationErrors]);

  const hasErrors = useCallback((fieldName?: string): boolean => {
    if (fieldName) {
      return validationErrors.some(error => error.field === fieldName);
    }
    return validationErrors.length > 0;
  }, [validationErrors]);

  const executeWithValidation = useCallback(
    async <T>(apiCall: () => Promise<T>): Promise<T> => {
      setIsSubmitting(true);
      clearErrors();

      try {
        const result = await apiCall();
        return result;
      } catch (error: any) {
        if (error.validationErrors && Array.isArray(error.validationErrors)) {
          setValidationErrors(error.validationErrors);

          // Show specific validation error messages from backend
          error.validationErrors.forEach((validationError: ValidationError, index: number) => {
            setTimeout(() => {
              showNotification({
                type: 'error',
                title: 'Validierungsfehler',
                message: `${validationError.field ? `${validationError.field}: ` : ''}${validationError.message}`
              });
            }, index * 500); // Stagger the notifications
          });
        } else {
          // Show notification for other errors
          showNotification({
            type: 'error',
            title: 'Fehler',
            message: error.message || 'Ein unerwarteter Fehler ist aufgetreten'
          });
        }
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearErrors, showNotification]
  );

  return {
    validationErrors,
    isSubmitting,
    clearErrors,
    getFieldError,
    hasErrors,
    executeWithValidation,
  };
};