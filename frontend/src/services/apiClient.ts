import { ValidationError, ErrorService } from './errorService';

export class ApiError extends Error {
  public validationErrors: ValidationError[];
  public statusCode: number;
  public originalError?: any;

  constructor(message: string, validationErrors: ValidationError[] = [], statusCode: number = 0, originalError?: any) {
    super(message);
    this.name = 'ApiError';
    this.validationErrors = validationErrors;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

export class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '/api';
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async handleApiResponse<T>(response: Response, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    if (!response.ok) {
      let errorData;
      
      try {
        // Try to parse error response as JSON
        const responseText = await response.text();
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch {
        // If not JSON, create a generic error object
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      // Extract validation errors using your existing ErrorService
      const validationErrors = ErrorService.extractValidationErrors(errorData);

      if (validationErrors.length > 0) {
        // Throw error with validationErrors property for useBackendValidation hook
        throw new ApiError(
          errorData.error || 'Validation failed',
          validationErrors,
          response.status,
          errorData
        );
      }

      // Throw regular error for non-validation errors
      throw new ApiError(
        errorData.error || errorData.message || `HTTP error! status: ${response.status}`,
        [],
        response.status,
        errorData
      );
    }

    // Handle blob responses (for file downloads)
    if (responseType === 'blob') {
      return response.blob() as Promise<T>;
    }

    // For successful JSON responses, try to parse as JSON
    try {
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : {} as T;
    } catch (error) {
      // If response is not JSON but request succeeded (e.g., 204 No Content)
      return {} as T;
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      return await this.handleApiResponse<T>(response, responseType);
    } catch (error) {
      // Re-throw the error to be caught by useBackendValidation
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Wrap non-ApiError errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        [],
        0,
        error
      );
    }
  }

  // Standardized HTTP methods
  get = <T>(endpoint: string) => this.request<T>(endpoint);
  
  post = <T>(endpoint: string, data?: any) => 
    this.request<T>(endpoint, { 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined 
    });
  
  put = <T>(endpoint: string, data?: any) => 
    this.request<T>(endpoint, { 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined 
    });
  
  patch = <T>(endpoint: string, data?: any) => 
    this.request<T>(endpoint, { 
      method: 'PATCH', 
      body: data ? JSON.stringify(data) : undefined 
    });
  
  delete = <T>(endpoint: string) => 
    this.request<T>(endpoint, { method: 'DELETE' });
}

export const apiClient = new ApiClient();