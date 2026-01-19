import React, { useEffect } from 'react';
import { BUTTON_COLORS } from '../../utils/buttonStyles';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '400px'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    width: width,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #dee2e6',
    backgroundColor: BUTTON_COLORS.primary,
    color: 'white',
    borderRadius: '8px 8px 0 0',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
    opacity: 0.8,
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>{title}</h3>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          >
            &times;
          </button>
        </div>
        <div style={contentStyle}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
