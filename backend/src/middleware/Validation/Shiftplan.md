## Shift Plan Management

### \[CREATE\] shift plan
* All operations require authentication
* 401 responses trigger automatic logout
* Scheduled shifts array is guaranteed to exist (empty array if none)

### \[CREATE\] shift plan from preset
* presetName must match existing TEMPLATE_PRESETS
* Requires name, startDate, and endDate
* isTemplate is optional (defaults to false)

### \[UPDATE\] shift plan
* Requires valid shift plan ID
* Partial updates allowed
* Authentication required

### \[ACTION: delete shift plan\]
* Requires authentication
* 401 responses trigger automatic logout

### \[ACTION: regenerate scheduled shifts\]
* Requires valid plan ID
* Authentication required
* Fails silently if regeneration fails (logs error but continues)

### \[ACTION: clear assignments\]
* Requires valid plan ID
* Authentication required
* Clears all employee assignments from scheduled shifts

## ShiftPlan

### \[CREATE\] ShiftPlan from template
* `planName` must not be empty
* `startDate` must be set
* `endDate` must be set
* `endDate` must be after `startDate`
* `selectedPreset` must be chosen (template must be selected)
* Only available template presets can be used

### \[ACTION: publish\] ShiftPlan
* Plan must be in 'draft' status
* All active employees must have set their availabilities for the plan
* Only users with roles \['admin', 'maintenance'\] can publish
* Assignment algorithm must not have critical violations (ERROR or ❌ KRITISCH)
* employee && employee.contract_type === small => mind. 1 mal availability === 1 || availability === 2
* employee && employee.contract_type === large => mind. 3 mal availability === 1 || availability === 2

### \[ACTION: recreate assignments\]
* Plan must be in 'published' status
* Only users with roles \['admin', 'maintenance'\] can recreate
* User confirmation required before clearing all assignments

### \[ACTION: delete\] ShiftPlan
* Only users with roles \['admin', 'maintenance'\] can delete
* User confirmation required before deletion

### \[ACTION: edit\] ShiftPlan
* Only users with roles \['admin', 'maintenance'\] can edit
* Can only edit plans in 'draft' status

### \[UPDATE\] ShiftPlan shifts
* `timeSlotId` must be selected from available time slots
* `requiredEmployees` must be at least 1
* `dayOfWeek` must be between 1-7