// frontend/src/components/PillNav/PillNav.tsx - ELEGANT WHITE DESIGN
import React, { useEffect, useRef } from 'react';

export interface PillNavItem {
  id: string;
  label: string;
}

export interface PillNavProps {
  items: PillNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'solid' | 'outline' | 'ghost';
}

const PillNav: React.FC<PillNavProps> = ({
  items,
  activeId,
  onChange,
  className = '',
  variant = 'solid'
}) => {
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const baseStyles = {
    container: {
      display: 'flex',
      gap: '4px',
      overflowX: 'auto' as const,
      padding: '4px',
      scrollbarWidth: 'none' as const,
      msOverflowStyle: 'none' as const,
      background: 'rgba(22, 23, 24, 0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(22, 23, 24, 0.06)',
    },
    pill: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      whiteSpace: 'nowrap' as const,
      outline: 'none',
      flexShrink: 0,
    }
  };

  const getVariantStyles = (isActive: boolean) => {
    const variants = {
      solid: {
        active: {
          backgroundColor: '#51258f',
          color: '#FBFAF6',
          boxShadow: '0 2px 8px rgba(81, 37, 143, 0.2)',
        },
        inactive: {
          backgroundColor: 'transparent',
          color: '#666',
        }
      },
      outline: {
        active: {
          backgroundColor: '#51258f',
          color: '#FBFAF6',
          boxShadow: '0 2px 8px rgba(81, 37, 143, 0.2)',
        },
        inactive: {
          backgroundColor: 'transparent',
          color: '#666',
          border: '1px solid rgba(22, 23, 24, 0.2)',
        }
      },
      ghost: {
        active: {
          backgroundColor: 'rgba(81, 37, 143, 0.1)',
          color: '#51258f',
          fontWeight: 600,
        },
        inactive: {
          backgroundColor: 'transparent',
          color: '#666',
        }
      }
    };

    return variants[variant][isActive ? 'active' : 'inactive'];
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowLeft': {
        event.preventDefault();
        const prevIndex = (index - 1 + items.length) % items.length;
        onChange(items[prevIndex].id);
        pillRefs.current[prevIndex]?.focus();
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        const nextIndex = (index + 1) % items.length;
        onChange(items[nextIndex].id);
        pillRefs.current[nextIndex]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        onChange(items[0].id);
        pillRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        onChange(items[items.length - 1].id);
        pillRefs.current[items.length - 1]?.focus();
        break;
      }
    }
  };

  // Initialize refs array
  useEffect(() => {
    pillRefs.current = pillRefs.current.slice(0, items.length);
  }, [items.length]);

  const containerStyle = {
    ...baseStyles.container,
  };

  return (
    <div 
      role="tablist" 
      aria-label="Navigation tabs"
      style={containerStyle}
      className={className}
    >
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        const pillStyle = {
          ...baseStyles.pill,
          ...getVariantStyles(isActive),
        };

        return (
          <button
            key={item.id}
            ref={el => {
              pillRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            style={pillStyle}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(81, 37, 143, 0.08)';
                e.currentTarget.style.color = '#51258f';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                Object.assign(e.currentTarget.style, pillStyle);
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillNav;