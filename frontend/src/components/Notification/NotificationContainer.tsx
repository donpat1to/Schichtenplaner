// frontend/src/components/Notification/NotificationContainer.tsx
import React from 'react';
import { useNotification, Notification } from '../../contexts/NotificationContext';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  const getNotificationStyle = (type: Notification['type']) => {
    const baseStyle = {
      padding: '15px 20px',
      marginBottom: '10px',
      borderRadius: '8px',
      border: '1px solid',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      maxWidth: '400px',
      minWidth: '300px'
    };

    const typeStyles = {
      info: {
        backgroundColor: '#e8f4fd',
        borderColor: '#b6d7e8',
        color: '#2c3e50'
      },
      success: {
        backgroundColor: '#d5f4e6',
        borderColor: '#a3e4c1',
        color: '#27ae60'
      },
      warning: {
        backgroundColor: '#fef5e7',
        borderColor: '#fadbd8',
        color: '#f39c12'
      },
      error: {
        backgroundColor: '#fadbd8',
        borderColor: '#f5b7b1',
        color: '#e74c3c'
      }
    };

    return { ...baseStyle, ...typeStyles[type] };
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info': return '💡';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '💡';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '90px', // Changed from 20px to 90px to account for header height
      right: '20px',
      zIndex: 9999 // Increased from 1000 to 9999
    }}>
      {notifications.map(notification => (
        <div
          key={notification.id}
          style={getNotificationStyle(notification.type)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
            <span style={{ fontSize: '18px' }}>
              {getIcon(notification.type)}
            </span>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {notification.title}
              </div>
              <div style={{ fontSize: '14px' }}>
                {notification.message}
              </div>
            </div>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0',
              marginLeft: '10px',
              color: 'inherit'
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;