// Unified button styles for consistent UI across the application

import React from 'react';

// Color palette
export const BUTTON_COLORS = {
  delete: '#e74c3c',
  add: '#27ae60',
  edit: '#f39c12',
  cancel: '#95a5a6',
  info: '#3498db',
  primary: '#2c3e50',
};

// Icon constants for uniform usage
export const ICONS = {
  delete: '-',
  add: '+',
  edit: '✎',
  close: '✕',
  calendar: '📅',
};

// Base button style
const baseButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'opacity 0.2s ease',
};

// Icon button (small, square) - for inline actions
export const iconButtonStyle = (
  color: string,
  disabled = false
): React.CSSProperties => ({
  ...baseButtonStyle,
  padding: '6px 8px',
  backgroundColor: color,
  color: 'white',
  fontSize: '14px',
  minWidth: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

// Small inline icon button (for table cells, headers)
export const smallIconButtonStyle = (
  color: string,
  disabled = false
): React.CSSProperties => ({
  ...baseButtonStyle,
  padding: '4px 8px',
  backgroundColor: color,
  color: 'white',
  fontSize: '12px',
  minWidth: '24px',
  height: '24px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

// Text button with icon prefix
export const textButtonStyle = (
  color: string,
  disabled = false
): React.CSSProperties => ({
  ...baseButtonStyle,
  padding: '8px 16px',
  backgroundColor: color,
  color: 'white',
  fontSize: '14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

// Outline/dashed button for "add new" actions
export const outlineButtonStyle = (
  color: string,
  disabled = false
): React.CSSProperties => ({
  ...baseButtonStyle,
  padding: '10px 20px',
  backgroundColor: 'transparent',
  color: color,
  border: `2px dashed ${color}`,
  fontSize: '14px',
  width: '100%',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

// Borderless icon button (for minimal UI elements)
export const borderlessIconButtonStyle = (
  color: string,
  disabled = false
): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  color: color,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '16px',
  padding: '4px 8px',
  opacity: disabled ? 0.5 : 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// Preset button styles for common actions
export const deleteIconButton = (disabled = false) =>
  iconButtonStyle(BUTTON_COLORS.delete, disabled);

export const addIconButton = (disabled = false) =>
  iconButtonStyle(BUTTON_COLORS.add, disabled);

export const editIconButton = (disabled = false) =>
  iconButtonStyle(BUTTON_COLORS.edit, disabled);

export const deleteTextButton = (disabled = false) =>
  textButtonStyle(BUTTON_COLORS.delete, disabled);

export const addTextButton = (disabled = false) =>
  textButtonStyle(BUTTON_COLORS.add, disabled);

export const cancelTextButton = (disabled = false) =>
  textButtonStyle(BUTTON_COLORS.cancel, disabled);

export const saveTextButton = (disabled = false) =>
  textButtonStyle(BUTTON_COLORS.primary, disabled);

export const backTextButton = (disabled = false) =>
  textButtonStyle(BUTTON_COLORS.primary, disabled);

export const addOutlineButton = (disabled = false) =>
  outlineButtonStyle(BUTTON_COLORS.add, disabled);

export const smallDeleteButton = (disabled = false) =>
  smallIconButtonStyle(BUTTON_COLORS.delete, disabled);

export const smallAddButton = (disabled = false) =>
  smallIconButtonStyle(BUTTON_COLORS.add, disabled);

export const borderlessDeleteButton = (disabled = false) =>
  borderlessIconButtonStyle(BUTTON_COLORS.delete, disabled);

export const borderlessEditButton = (disabled = false) =>
  borderlessIconButtonStyle(BUTTON_COLORS.edit, disabled);
