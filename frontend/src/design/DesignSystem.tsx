// frontend/src/design/DesignSystem.tsx
import React, { createContext, useContext, ReactNode } from 'react';

// Design Tokens
export const designTokens = {
  colors: {
    // Primary Colors
    white: '#FBFAF6',
    black: '#161718',
    
    // Purple Gradients
    purple: {
      1: '#1a1325',
      2: '#24163a',
      3: '#301c4d',
      4: '#3e2069',
      5: '#51258f',
      6: '#642ab5',
      7: '#854eca',
      8: '#ab7ae0',
      9: '#cda8f0',
      10: '#ebd7fa',
    },
    
    // Semantic Colors
    primary: '#51258f',
    secondary: '#642ab5',
    accent: '#854eca',
    background: '#FBFAF6',
    text: {
      primary: '#161718',
      secondary: '#666666',
      light: '#999999',
      inverted: '#FBFAF6',
    },
    border: {
      light: 'rgba(22, 23, 24, 0.1)',
      medium: 'rgba(22, 23, 24, 0.2)',
      dark: 'rgba(22, 23, 24, 0.3)',
    },
    state: {
      hover: 'rgba(81, 37, 143, 0.08)',
      active: 'rgba(81, 37, 143, 0.12)',
      focus: 'rgba(81, 37, 143, 0.16)',
    }
  },
  
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    fontSizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
    },
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
  },
  
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(22, 23, 24, 0.05)',
    base: '0 1px 3px 0 rgba(22, 23, 24, 0.1), 0 1px 2px 0 rgba(22, 23, 24, 0.06)',
    md: '0 4px 6px -1px rgba(22, 23, 24, 0.1), 0 2px 4px -1px rgba(22, 23, 24, 0.06)',
    lg: '0 10px 15px -3px rgba(22, 23, 24, 0.1), 0 4px 6px -2px rgba(22, 23, 24, 0.05)',
    xl: '0 20px 25px -5px rgba(22, 23, 24, 0.1), 0 10px 10px -5px rgba(22, 23, 24, 0.04)',
  },
  
  transitions: {
    default: 'all 0.2s ease-in-out',
    slow: 'all 0.3s ease-in-out',
    fast: 'all 0.15s ease-in-out',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// Context for Design System
interface DesignSystemContextType {
  tokens: typeof designTokens;
  getColor: (path: string) => string;
  getSpacing: (size: keyof typeof designTokens.spacing) => string;
}

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(undefined);

// Design System Provider
interface DesignSystemProviderProps {
  children: ReactNode;
}

export const DesignSystemProvider: React.FC<DesignSystemProviderProps> = ({ children }) => {
  const getColor = (path: string): string => {
    const parts = path.split('.');
    let current: any = designTokens.colors;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        console.warn(`Color path "${path}" not found in design tokens`);
        return designTokens.colors.primary;
      }
      current = current[part];
    }
    
    return current;
  };

  const getSpacing = (size: keyof typeof designTokens.spacing): string => {
    return designTokens.spacing[size];
  };

  const value: DesignSystemContextType = {
    tokens: designTokens,
    getColor,
    getSpacing,
  };

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
    </DesignSystemContext.Provider>
  );
};

// Hook to use Design System
export const useDesignSystem = (): DesignSystemContextType => {
  const context = useContext(DesignSystemContext);
  if (context === undefined) {
    throw new Error('useDesignSystem must be used within a DesignSystemProvider');
  }
  return context;
};

// Utility Components
export interface BoxProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  p?: keyof typeof designTokens.spacing;
  px?: keyof typeof designTokens.spacing;
  py?: keyof typeof designTokens.spacing;
  m?: keyof typeof designTokens.spacing;
  mx?: keyof typeof designTokens.spacing;
  my?: keyof typeof designTokens.spacing;
  bg?: string;
  color?: string;
  borderRadius?: keyof typeof designTokens.borderRadius;
}

export const Box: React.FC<BoxProps> = ({ 
  children, 
  className, 
  style,
  p,
  px,
  py,
  m,
  mx,
  my,
  bg,
  color,
  borderRadius,
  ...props 
}) => {
  const { tokens, getColor } = useDesignSystem();

  const boxStyle: React.CSSProperties = {
    padding: p && tokens.spacing[p],
    paddingLeft: px && tokens.spacing[px],
    paddingRight: px && tokens.spacing[px],
    paddingTop: py && tokens.spacing[py],
    paddingBottom: py && tokens.spacing[py],
    margin: m && tokens.spacing[m],
    marginLeft: mx && tokens.spacing[mx],
    marginRight: mx && tokens.spacing[mx],
    marginTop: my && tokens.spacing[my],
    marginBottom: my && tokens.spacing[my],
    backgroundColor: bg && getColor(bg),
    color: color && getColor(color),
    borderRadius: borderRadius && tokens.borderRadius[borderRadius],
    fontFamily: tokens.typography.fontFamily,
    ...style,
  };

  return (
    <div className={className} style={boxStyle} {...props}>
      {children}
    </div>
  );
};

export interface TextProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  weight?: keyof typeof designTokens.typography.fontWeights;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: keyof typeof designTokens.typography.lineHeights;
  letterSpacing?: keyof typeof designTokens.typography.letterSpacing;
}

export const Text: React.FC<TextProps> = ({
  children,
  className,
  style,
  variant = 'base',
  weight = 'normal',
  color = 'text.primary',
  align = 'left',
  lineHeight = 'normal',
  letterSpacing = 'normal',
  ...props
}) => {
  const { tokens, getColor } = useDesignSystem();

  const textStyle: React.CSSProperties = {
    fontSize: tokens.typography.fontSizes[variant],
    fontWeight: tokens.typography.fontWeights[weight],
    color: getColor(color),
    textAlign: align,
    lineHeight: tokens.typography.lineHeights[lineHeight],
    letterSpacing: tokens.typography.letterSpacing[letterSpacing],
    fontFamily: tokens.typography.fontFamily,
    ...style,
  };

  return (
    <span className={className} style={textStyle} {...props}>
      {children}
    </span>
  );
};

// Global Styles Component
export const GlobalStyles: React.FC = () => {
  const { tokens } = useDesignSystem();

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html {
      font-family: ${tokens.typography.fontFamily};
      font-size: 16px;
      line-height: ${tokens.typography.lineHeights.normal};
      color: ${tokens.colors.text.primary};
      background-color: ${tokens.colors.background};
    }
    
    body {
      font-family: ${tokens.typography.fontFamily};
      font-weight: ${tokens.typography.fontWeights.normal};
      line-height: ${tokens.typography.lineHeights.normal};
      color: ${tokens.colors.text.primary};
      background-color: ${tokens.colors.background};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: ${tokens.typography.fontFamily};
      font-weight: ${tokens.typography.fontWeights.bold};
      line-height: ${tokens.typography.lineHeights.tight};
      color: ${tokens.colors.text.primary};
    }
    
    h1 {
      font-size: ${tokens.typography.fontSizes['4xl']};
      letter-spacing: ${tokens.typography.letterSpacing.tight};
    }
    
    h2 {
      font-size: ${tokens.typography.fontSizes['3xl']};
      letter-spacing: ${tokens.typography.letterSpacing.tight};
    }
    
    h3 {
      font-size: ${tokens.typography.fontSizes['2xl']};
    }
    
    h4 {
      font-size: ${tokens.typography.fontSizes.xl};
    }
    
    h5 {
      font-size: ${tokens.typography.fontSizes.lg};
    }
    
    h6 {
      font-size: ${tokens.typography.fontSizes.base};
    }
    
    p {
      font-size: ${tokens.typography.fontSizes.base};
      line-height: ${tokens.typography.lineHeights.relaxed};
      color: ${tokens.colors.text.primary};
    }
    
    a {
      color: ${tokens.colors.primary};
      text-decoration: none;
      transition: ${tokens.transitions.default};
    }
    
    a:hover {
      color: ${tokens.colors.secondary};
    }
    
    button {
      font-family: ${tokens.typography.fontFamily};
      transition: ${tokens.transitions.default};
    }
    
    input, textarea, select {
      font-family: ${tokens.typography.fontFamily};
    }
    
    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: ${tokens.colors.background};
    }
    
    ::-webkit-scrollbar-thumb {
      background: ${tokens.colors.border.medium};
      border-radius: ${tokens.borderRadius.full};
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: ${tokens.colors.border.dark};
    }
  `;

  return <style>{globalStyles}</style>;
};

export default designTokens;