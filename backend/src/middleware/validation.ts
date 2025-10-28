import { body, validationResult, param, query } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// ===== AUTH VALIDATION =====
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .trim()
    .escape()
];

export const validateRegister = [
  body('firstname')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('lastname')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number')
];

// ===== EMPLOYEE VALIDATION =====
export const validateEmployee = [
  body('firstname')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('lastname')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number'),
  
  body('employeeType')
    .isIn(['manager', 'personell', 'apprentice', 'guest'])
    .withMessage('Employee type must be manager, personell, apprentice or guest'),
  
  body('contractType')
    .optional()
    .isIn(['small', 'large', 'flexible'])
    .withMessage('Contract type must be small, large or flexible'),
  
  body('roles')
    .optional()
    .isArray()
    .withMessage('Roles must be an array'),
  
  body('roles.*')
    .optional()
    .isIn(['admin', 'maintenance', 'user'])
    .withMessage('Invalid role. Allowed: admin, maintenance, user'),
  
  body('canWorkAlone')
    .optional()
    .isBoolean()
    .withMessage('canWorkAlone must be a boolean'),
  
  body('isTrainee')
    .optional()
    .isBoolean()
    .withMessage('isTrainee must be a boolean'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const validateEmployeeUpdate = [
  body('firstname')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('lastname')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('employeeType')
    .optional()
    .isIn(['manager', 'personell', 'apprentice', 'guest'])
    .withMessage('Employee type must be manager, personell, apprentice or guest'),
  
  body('contractType')
    .optional()
    .isIn(['small', 'large', 'flexible'])
    .withMessage('Contract type must be small, large or flexible'),
  
  body('roles')
    .optional()
    .isArray()
    .withMessage('Roles must be an array'),
  
  body('roles.*')
    .optional()
    .isIn(['admin', 'maintenance', 'user'])
    .withMessage('Invalid role. Allowed: admin, maintenance, user'),
  
  body('canWorkAlone')
    .optional()
    .isBoolean()
    .withMessage('canWorkAlone must be a boolean'),
  
  body('isTrainee')
    .optional()
    .isBoolean()
    .withMessage('isTrainee must be a boolean'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const validateChangePassword = [
  body('currentPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Current password must be at least 6 characters'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain uppercase, lowercase and number')
];

// ===== SHIFT PLAN VALIDATION =====
export const validateShiftPlan = [
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1-200 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
    .trim()
    .escape(),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean'),
  
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'template'])
    .withMessage('Status must be draft, published, archived or template'),
  
  body('timeSlots')
    .optional()
    .isArray()
    .withMessage('Time slots must be an array'),
  
  body('timeSlots.*.name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Time slot name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('timeSlots.*.startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  
  body('timeSlots.*.endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  
  body('timeSlots.*.description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Time slot description cannot exceed 500 characters')
    .trim()
    .escape(),
  
  body('shifts')
    .optional()
    .isArray()
    .withMessage('Shifts must be an array'),
  
  body('shifts.*.dayOfWeek')
    .isInt({ min: 1, max: 7 })
    .withMessage('Day of week must be between 1-7 (Monday-Sunday)'),
  
  body('shifts.*.timeSlotId')
    .isUUID()
    .withMessage('Time slot ID must be a valid UUID'),
  
  body('shifts.*.requiredEmployees')
    .isInt({ min: 0 })
    .withMessage('Required employees must be a positive integer'),
  
  body('shifts.*.color')
    .optional()
    .isHexColor()
    .withMessage('Color must be a valid hex color')
];

export const validateShiftPlanUpdate = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1-200 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
    .trim()
    .escape(),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'template'])
    .withMessage('Status must be draft, published, archived or template'),
  
  body('timeSlots')
    .optional()
    .isArray()
    .withMessage('Time slots must be an array'),
  
  body('shifts')
    .optional()
    .isArray()
    .withMessage('Shifts must be an array')
];

export const validateCreateFromPreset = [
  body('presetName')
    .isLength({ min: 1 })
    .withMessage('Preset name is required')
    .isIn(['standardWeek', 'extendedWeek', 'weekendFocused', 'morningOnly', 'eveningOnly', 'ZEBRA_STANDARD'])
    .withMessage('Invalid preset name'),
  
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1-200 characters')
    .trim()
    .escape(),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Must be a valid date (ISO format)'),
  
  body('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean')
];

// ===== SCHEDULED SHIFTS VALIDATION =====
export const validateScheduledShiftUpdate = [
  body('assignedEmployees')
    .isArray()
    .withMessage('assignedEmployees must be an array'),
  
  body('assignedEmployees.*')
    .isUUID()
    .withMessage('Each assigned employee must be a valid UUID'),
  
  body('requiredEmployees')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Required employees must be a positive integer')
];

// ===== SETUP VALIDATION =====
export const validateSetupAdmin = [
  body('firstname')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('lastname')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1-100 characters')
    .trim()
    .escape(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number')
];

// ===== SCHEDULING VALIDATION =====
export const validateSchedulingRequest = [
  body('shiftPlan')
    .isObject()
    .withMessage('Shift plan is required'),
  
  body('shiftPlan.id')
    .isUUID()
    .withMessage('Shift plan ID must be a valid UUID'),
  
  body('employees')
    .isArray({ min: 1 })
    .withMessage('At least one employee is required'),
  
  body('employees.*.id')
    .isUUID()
    .withMessage('Each employee must have a valid UUID'),
  
  body('availabilities')
    .isArray()
    .withMessage('Availabilities must be an array'),
  
  body('constraints')
    .optional()
    .isArray()
    .withMessage('Constraints must be an array')
];

// ===== AVAILABILITY VALIDATION =====
export const validateAvailabilities = [
  body('planId')
    .isUUID()
    .withMessage('Plan ID must be a valid UUID'),
  
  body('availabilities')
    .isArray()
    .withMessage('Availabilities must be an array'),
  
  body('availabilities.*.shiftId')
    .isUUID()
    .withMessage('Each shift ID must be a valid UUID'),
  
  body('availabilities.*.preferenceLevel')
    .isInt({ min: 0, max: 2 })
    .withMessage('Preference level must be 0 (unavailable), 1 (available), or 2 (preferred)'),
  
  body('availabilities.*.notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
    .trim()
    .escape()
];

// ===== COMMON VALIDATORS =====
export const validateId = [
  param('id')
    .isUUID()
    .withMessage('Must be a valid UUID')
];

export const validateEmployeeId = [
  param('employeeId')
    .isUUID()
    .withMessage('Must be a valid UUID')
];

export const validatePlanId = [
  param('planId')
    .isUUID()
    .withMessage('Must be a valid UUID')
];

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean')
];

// ===== MIDDLEWARE TO CHECK VALIDATION RESULTS =====
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : error.type,
      message: error.msg,
      value: error.msg
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages
    });
  }
  
  next();
};