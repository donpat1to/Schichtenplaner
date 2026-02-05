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
  delete: '×',
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


/*
{exportType && (
  <button
    onClick={handleExport}
    disabled={exporting}
    style={{
      padding: '10px 20px',
      backgroundColor: '#51258f',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: exporting ? 'not-allowed' : 'pointer',
      fontStyle: 'normal',
      fontVariant: 'small-caps',
      opacity: exporting ? 0.7 : 1,
      transition: 'opacity 0.05s ease',
      minWidth: '100px'
    }}
  >
    {exporting ? '🔄 Exportiert...' : 'Export'}
  </button>
)}


Implementation Example:

        {shiftPlan.status === 'published' && hasRole(['admin', 'maintenance']) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '5px'
          }}>
            {/* Export Dropdown Container *//*}
<div
ref={ dropdownRef }
style = {{
transform: exportType ? `translateX(-${dropdownWidth}px)` : 'translateX(0)',
transition: 'transform 0.05s ease-in-out',
position: 'relative'
}}
>
<select
value={ exportType || '' }
onChange = {(e) => setExportType(e.target.value as 'pdf' | 'excel' | null)}
style = {{
padding: '10px 10px',
backgroundColor: 'white',
border: '1px solid #ddd',
borderRadius: '4px',
cursor: 'pointer',
minWidth: '100px'
}}
>
<option value="" > Export </option>
< option value = "pdf" > PDF </option>
< option value = "excel" > Excel </option>
</select>
</div>

{/* Export Button - erscheint nur wenn eine Option ausgewählt ist *//* }
{
  exportType && (
    <button
                onClick={ handleExport }
  disabled = { exporting }
  style = {{
    padding: '10px 20px',
      backgroundColor: '#51258f',
        color: 'white',
          border: 'none',
            borderRadius: '4px',
              cursor: exporting ? 'not-allowed' : 'pointer',
                fontStyle: 'normal',
                  fontVariant: 'small-caps',
                    opacity: exporting ? 0.7 : 1,
                      transition: 'opacity 0.05s ease',
                        minWidth: '100px'
  }
}
              >
  { exporting? '🔄 Exportiert...': 'Export' }
  </button>
            )}
</div>
        )}
*/
