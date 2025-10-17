// frontend/src/design/DesignSystem.tsx
export const designTokens = {
  colors: {
    // Primary Colors
    default_white: '#ddd', //boxes
    white: '#FBFAF6', //background, fonts
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