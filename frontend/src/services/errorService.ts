// frontend/src/services/errorService.ts
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  error: string;
  details?: ValidationError[];
  message?: string;
}

export class ErrorService {
  static extractValidationErrors(error: any): ValidationError[] {
    if (error?.details && Array.isArray(error.details)) {
      return error.details;
    }
    
    // Fallback for different error formats
    if (error.message && typeof error.message === 'string') {
      return [{ field: 'general', message: error.message }];
    }
    
    return [{ field: 'general', message: 'An unknown error occurred' }];
  }

  static getFieldErrors(errors: ValidationError[], fieldName: string): string[] {
    return errors
      .filter(error => error.field === fieldName)
      .map(error => error.message);
  }

  static getFirstFieldError(errors: ValidationError[], fieldName: string): string | null {
    const fieldErrors = this.getFieldErrors(errors, fieldName);
    return fieldErrors.length > 0 ? fieldErrors[0] : null;
  }
}