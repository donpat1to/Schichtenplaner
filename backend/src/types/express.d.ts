// backend/src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
    interface User {
      // Properties used by JWT auth middleware
      userId: string;
      email: string;
      role: string;

      // Properties used by OIDC/Passport auth
      id?: string;
      username?: string;
      firstname?: string;
      lastname?: string;
      roles?: string[];
      employeeType?: string;
      isActive?: boolean;
      idpId?: string;
      idpSubject?: string;
    }
  }
}

// Extend session for PKCE data
declare module 'express-session' {
  interface SessionData {
    pkce?: {
      codeVerifier: string;
      state: string;
      nonce: string;
    };
  }
}

export { };
