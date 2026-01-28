// backend/src/auth/services/token.service.ts
import jwt from 'jsonwebtoken';
import { InternalUser } from './user-mapping.service.js';

/**
 * JWT payload structure (compatible with existing auth)
 */
export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  roles?: string[];
  idp?: string; // Identity provider ID (for external auth)
  iat?: number;
  exp?: number;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Token pair returned after successful authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Service for JWT token generation and verification
 * Compatible with existing auth system but adds support for external IdPs
 */
class TokenService {
  private readonly secret: string;
  private readonly accessTokenTTL: number;
  private readonly refreshTokenTTL: number;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key';
    this.accessTokenTTL = parseInt(process.env.JWT_ACCESS_TTL || '86400', 10); // 24 hours (existing default)
    this.refreshTokenTTL = parseInt(process.env.JWT_REFRESH_TTL || '604800', 10); // 7 days

    if (process.env.NODE_ENV === 'production' && this.secret === 'your-secret-key') {
      console.warn('[TokenService] WARNING: Using default JWT secret in production!');
    }
  }

  /**
   * Generate an access token for an internal user
   */
  generateAccessToken(user: InternalUser): string {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.roles[0] || 'user', // Primary role (for backward compatibility)
      roles: user.roles,
      idp: user.idpId,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.accessTokenTTL,
    });
  }

  /**
   * Generate a refresh token
   */
  generateRefreshToken(user: InternalUser): string {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenTTL,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(user: InternalUser): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      expiresIn: this.accessTokenTTL,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.secret) as TokenPayload;

    // Validate required fields
    if (!decoded.id || !decoded.email) {
      throw new Error('Invalid token structure');
    }

    return decoded;
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = jwt.verify(token, this.secret) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  }

  /**
   * Check if a token is expired (without throwing)
   */
  isTokenExpired(token: string): boolean {
    try {
      jwt.verify(token, this.secret);
      return false;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return true;
      }
      throw error;
    }
  }

  /**
   * Decode a token without verification (for inspection)
   */
  decodeToken(token: string): TokenPayload | null {
    const decoded = jwt.decode(token);
    return decoded as TokenPayload | null;
  }

  /**
   * Get remaining TTL in seconds for a token
   */
  getTokenTTL(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) {
      return 0;
    }
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - now);
  }
}

export const tokenService = new TokenService();
