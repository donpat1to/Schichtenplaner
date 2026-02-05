# backend/src/python-scripts/shift_scheduling_solver.py
import json
import sys
import math
from typing import Dict, List, Tuple, Set, Optional, Any
from ortools.sat.python import cp_model
import time

# ============================================================================
# DATA MODEL CLASSES
# ============================================================================

class Employee:
    def __init__(self, data: Dict):
        self.id = data['id']
        self.firstname = data.get('firstname', '')
        self.lastname = data.get('lastname', '')
        self.employee_type = data['employeeType']  # 'manager', 'personell', 'apprentice', 'guest'
        self.contract_type = data.get('contractType', 'large')  # 'small', 'large', 'flexible' - DEFAULT: 'large'
        self.can_work_alone = data.get('canWorkAlone', True)
        self.is_trainee = data.get('isTrainee', False)
        self.is_active = data.get('isActive', True)
        
    @property
    def name(self) -> str:
        return f"{self.firstname} {self.lastname}".strip() or f"Employee {self.id}"
    
    @property
    def is_schedulable(self) -> bool:
        return self.is_active and self.employee_type == 'personell'
    
    @property
    def is_manager(self) -> bool:
        return self.employee_type == 'manager'
    
    @property
    def required_shifts(self) -> int:
        """Get required number of shifts based on contract type"""
        if self.contract_type == 'small':
            return 1
        elif self.contract_type == 'large':
            return 2
        elif self.contract_type == 'flexible':
            return 0  # No fixed requirement
        else:
            # DEFAULT: 'large' (2 shifts) to match TypeScript
            return 2
    
    @property
    def cannot_work_alone(self) -> bool:
        """Check if employee cannot work alone (canWorkAlone=false)"""
        return not self.can_work_alone

class Shift:
    def __init__(self, data: Dict):
        self.id = data['id']
        self.plan_id = data['planId']
        self.time_slot_id = data['timeSlotId']
        self.day_of_week = data['dayOfWeek']  # 1=Monday, 7=Sunday
        self.min_employees = data.get('minEmployees', 1)
        self.max_employees = data.get('maxEmployees', 2)
        self.color = data.get('color', '#3498db')
        
        # Time slot details
        time_slot = data.get('timeSlot', {})
        self.time_slot_name = time_slot.get('name', '')
        self.start_time = time_slot.get('startTime', '')
        self.end_time = time_slot.get('endTime', '')

class Availability:
    def __init__(self, data: Dict):
        self.id = data.get('id', '')
        self.employee_id = data['employeeId']
        self.shift_id = data['shiftId']
        self.preference_level = data['preferenceLevel']  # 1=Preferred, 2=Available, 3=Unavailable
        self.notes = data.get('notes')

# ============================================================================
# SOLVER IMPLEMENTATION
# ============================================================================

class ShiftSchedulingSolver:
    def __init__(self, data: Dict):
        # Parse input data
        self.plan = data['plan']
        self.employees = {e['id']: Employee(e) for e in data['employees']}
        self.shifts = {s['id']: Shift(s) for s in data['shifts']}
        self.availabilities = [Availability(a) for a in data['availabilities']]
        self.constraints = data.get('constraints', {})
        self.solver_options = data.get('solverOptions', {
            'maxTimeInSeconds': 105,
            'numSearchWorkers': 8
        })
        
        # Filter schedulable employees
        self.schedulable_employees = [
            emp for emp in self.employees.values() 
            if emp.is_schedulable
        ]
        
        # Filter managers
        self.managers = [
            emp for emp in self.employees.values() 
            if emp.is_manager
        ]
        # Initialize CP-SAT model
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.variables = {}  # (employee_id, shift_id) -> IntVar
        self.slack_variables = {}  # For soft constraints
        
        # Set solver parameters
        self.solver.parameters.max_time_in_seconds = self.solver_options.get('maxTimeInSeconds', 105)
        self.solver.parameters.num_search_workers = self.solver_options.get('numSearchWorkers', 8)
        self.solver.parameters.log_search_progress = False
        
        # Statistics
        self.stats = {
            'variables_created': 0,
            'constraints_added': 0,
            'hard_constraints': 0,
            'soft_constraints': 0
        }
    
    # ------------------------------------------------------------------------
    # FEASIBILITY CHECKS - CORRECTED
    # ------------------------------------------------------------------------
    
    def check_feasibility(self) -> Tuple[bool, List[str]]:
        """Check if the problem is mathematically feasible"""
        issues = []
        
        # 1. Calculate total required slots
        total_required_slots = sum(s.min_employees for s in self.shifts.values())
        
        # 2. Calculate employee capacity based on contract requirements
        employee_capacity = 0
        small_contract = 0
        large_contract = 0

               
        
        for emp in self.schedulable_employees:
            employee_capacity += 1 if emp.can_work_alone else 0 
            required = emp.required_shifts
            if required > 0:
                employee_capacity += required
            else:
                # Flexible employees: can work up to total shifts available to them
                # Count how many shifts they're available for
                available_shifts = 0
                for shift_id in self.shifts:
                    for avail in self.availabilities:
                        if (avail.employee_id == emp.id and 
                            avail.shift_id == shift_id and 
                            avail.preference_level in [1, 2]):
                            available_shifts += 1
                            break
                employee_capacity += available_shifts
        
        #Check if we have enough employee capacity
        if employee_capacity < total_required_slots:
            issues.append(
                f"Insufficient employee capacity: {employee_capacity} < {total_required_slots}"
            )
        
        # 3. Check per-shift availability and "cannot work alone" feasibility
        for shift_id, shift in self.shifts.items():
            # Count employees available for this shift (preference 1 or 2)
            available_employees = []
            cannot_work_alone_employees = []
            
            for avail in self.availabilities:
                if avail.shift_id == shift_id and avail.preference_level in [1, 2]:
                    emp = self.employees.get(avail.employee_id)
                    if emp and emp.is_schedulable:
                        available_employees.append(emp)
                        if emp.cannot_work_alone:
                            cannot_work_alone_employees.append(emp)
            
            # Check minimum staffing
            if len(available_employees) < shift.min_employees:
                issues.append(
                    f"Shift {shift_id} (Day {shift.day_of_week}, {shift.time_slot_name}): "
                    f"Only {len(available_employees)} employees available, "
                    f"but min required is {shift.min_employees}"
                )
            
            # Check "cannot work alone" feasibility
            # If ALL available employees cannot work alone AND shift.min_employees == 1, it's impossible
            cannot_work_alone_count = len(cannot_work_alone_employees)
            if (shift.min_employees == 1 and 
                len(available_employees) > 0 and 
                cannot_work_alone_count == len(available_employees)):
                issues.append(
                    f"Shift {shift_id}: All {len(available_employees)} available employees "
                    f"cannot work alone (canWorkAlone=false)"
                )
        
        # 4. Check trainee supervision feasibility
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        experienced = [emp for emp in self.schedulable_employees if not emp.is_trainee]
        
        if trainees:
            # For each shift, check if there's at least one experienced available
            for shift_id, shift in self.shifts.items():
                experienced_available = False
                for avail in self.availabilities:
                    if avail.shift_id == shift_id and avail.preference_level in [1, 2]:
                        emp = self.employees.get(avail.employee_id)
                        if emp and emp.is_schedulable and not emp.is_trainee:
                            experienced_available = True
                            break
                
                # If no experienced available, check if any trainees want this shift
                if not experienced_available:
                    trainee_wants_shift = False
                    for avail in self.availabilities:
                        if (avail.shift_id == shift_id and 
                            avail.preference_level in [1, 2] and
                            avail.employee_id in [t.id for t in trainees]):
                            trainee_wants_shift = True
                            break
                    
                    if trainee_wants_shift:
                        issues.append(
                            f"Shift {shift_id}: Trainees want to work but no experienced employees available"
                        )
        
        return len(issues) == 0, issues
    
    # ------------------------------------------------------------------------
    # VARIABLE CREATION
    # ------------------------------------------------------------------------
    
    def create_variables(self):
        """Create decision variables for the CP-SAT model"""
        
        # Create assignment variables: x[employee_id, shift_id] = 1 if assigned
        for emp in self.schedulable_employees:
            for shift_id, shift in self.shifts.items():
                # Check if employee is available for this shift
                is_available = False
                preference = None
                
                for avail in self.availabilities:
                    if avail.employee_id == emp.id and avail.shift_id == shift_id:
                        if avail.preference_level == 3:
                            # Unavailable - don't create variable
                            break
                        else:
                            # Available (preference 1 or 2)
                            is_available = True
                            preference = avail.preference_level
                            break
                else:
                    # No availability record found - treat as unavailable
                    continue
                
                if is_available:
                    var_name = f"x_{emp.id}_{shift_id}"
                    var = self.model.NewBoolVar(var_name)
                    self.variables[(emp.id, shift_id)] = var
                    self.stats['variables_created'] += 1
        
    
    # ------------------------------------------------------------------------
    # HARD CONSTRAINT IMPLEMENTATIONS
    # ------------------------------------------------------------------------
    
    def add_availability_constraints(self):
        """Add constraints for employee availability (HARD)"""
        
        # Variables for unavailable employees are not created, so no constraint needed
        
        self.stats['hard_constraints'] += 1
    
    def add_max_shifts_per_day_constraint(self):
        """Add maximum 1 shift per day constraint (HARD)"""
        
        for emp in self.schedulable_employees:
            # Group shifts by day
            shifts_by_day = {}
            for shift_id, shift in self.shifts.items():
                if (emp.id, shift_id) in self.variables:
                    shifts_by_day.setdefault(shift.day_of_week, []).append(
                        self.variables[(emp.id, shift_id)]
                    )
            
            # Add constraint for each day: at most 1 shift
            for day, vars_list in shifts_by_day.items():
                if len(vars_list) > 1:
                    self.model.Add(sum(vars_list) <= 1)
                    self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_shift_staffing_constraints(self):
        """Add minimum and maximum staffing constraints (HARD)"""
        
        for shift_id, shift in self.shifts.items():
            # Get all variables for this shift
            shift_vars = []
            for emp in self.schedulable_employees:
                if (emp.id, shift_id) in self.variables:
                    shift_vars.append(self.variables[(emp.id, shift_id)])
            
            if shift_vars:
                total_assigned = sum(shift_vars)
                
                # Minimum staffing requirement
                if shift.min_employees > 0:
                    self.model.Add(total_assigned >= shift.min_employees)
                    self.stats['constraints_added'] += 1
                
                # Maximum staffing limit
                self.model.Add(total_assigned <= shift.max_employees)
                self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_trainee_supervision_constraints(self):
        """Add trainee supervision constraints (HARD)"""
        
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        
        if not trainees:
            return
        
        for shift_id, shift in self.shifts.items():
            # Get trainee variables for this shift
            trainee_vars = []
            for trainee in trainees:
                if (trainee.id, shift_id) in self.variables:
                    trainee_vars.append(self.variables[(trainee.id, shift_id)])
            
            if trainee_vars:
                # Get experienced employee variables for this shift
                experienced_vars = []
                for emp in self.schedulable_employees:
                    if not emp.is_trainee and (emp.id, shift_id) in self.variables:
                        experienced_vars.append(self.variables[(emp.id, shift_id)])
                
                if experienced_vars:
                    # If any trainee is assigned, at least one experienced must be assigned
                    # Using big-M formulation: sum(trainee_vars) <= M * sum(experienced_vars)
                    M = len(trainee_vars)
                    self.model.Add(sum(trainee_vars) <= M * sum(experienced_vars))
                    self.stats['constraints_added'] += 1
                else:
                    # No experienced available for this shift, trainees cannot work
                    for var in trainee_vars:
                        self.model.Add(var == 0)
                        self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_cannot_work_alone_constraints(self):
        """HARD: Employees with canWorkAlone=false must never be scheduled alone"""

        for shift_id in self.shifts:
            for emp in self.schedulable_employees:
                if not emp.cannot_work_alone:
                    continue

                # Variable for this employee on this shift
                key = (emp.id, shift_id)
                if key not in self.variables:
                    continue

                # All OTHER schedulable employees on this shift
                others = [
                    self.variables[(other.id, shift_id)]
                    for other in self.schedulable_employees
                    if other.id != emp.id and (other.id, shift_id) in self.variables
                ]

                if others:
                    # If emp works → at least one other must work
                    self.model.Add(self.variables[key] <= sum(others))
                else:
                    # Nobody else available → emp can never work this shift
                    self.model.Add(self.variables[key] == 0)

                self.stats['constraints_added'] += 1

        self.stats['hard_constraints'] += 1

    
    def add_contract_type_constraints(self):
        """Add contract type constraints (HARD - EXACT requirements)"""
        
        for emp in self.schedulable_employees:
            # Get all variables for this employee
            emp_vars = []
            for shift_id in self.shifts:
                if (emp.id, shift_id) in self.variables:
                    emp_vars.append(self.variables[(emp.id, shift_id)])
            
            if not emp_vars:
                continue  # Employee has no available shifts
            
            total_shifts = sum(emp_vars)
            required_shifts = emp.required_shifts
            
            if required_shifts > 0:
                # HARD: Exactly required_shifts
                self.model.Add(total_shifts == required_shifts)
                self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_manager_post_assignments(self):
        """Add manager assignments after solving for schedulable employees (POST-PROCESSING)"""
        
        # Only managers with preference level 1 are auto-assigned
        manager_availabilities = {}
        for avail in self.availabilities:
            if avail.preference_level == 1:
                emp = self.employees.get(avail.employee_id)
                if emp and emp.is_manager:
                    manager_availabilities.setdefault(avail.shift_id, []).append(
                        (emp.id, avail.preference_level)
                    )
        
        manager_assignments = []
        
        # For each shift, check if we can add managers
        for shift_id, shift in self.shifts.items():
            # Get current assignments for this shift (from schedulable employees)
            current_assignment_count = 0
            for (emp_id, s_id), var in self.variables.items():
                if s_id == shift_id and self.solver.Value(var) == 1:
                    current_assignment_count += 1
            
            # Skip check if there's room for managers 
            
            # Get available managers for this shift (only preference 1)
            available_managers = manager_availabilities.get(shift_id, [])
            
            # Add managers until we reach max_employees
            for manager_id, preference in available_managers:
                # Dont check if max_employees has been exceeded
                
                manager_assignments.append({
                    'shiftId': shift_id,
                    'employeeId': manager_id,
                    'assignmentIndex': current_assignment_count + 1,
                    'isManager': True,
                    'preferenceLevel': preference
                })
                current_assignment_count += 1
        
        return manager_assignments
    
    # ------------------------------------------------------------------------
    # SOFT CONSTRAINT IMPLEMENTATIONS
    # ------------------------------------------------------------------------
    
    def add_day_staffing_balance(self):
        """Add day staffing balance as soft constraint with penalties"""
        
        # Get days in the schedule
        days_in_schedule = set(shift.day_of_week for shift in self.shifts.values())
        if len(days_in_schedule) <= 1:
            return
        
        # Calculate total personnel needed
        total_personnel_needed = sum(s.max_employees for s in self.shifts.values())
        
        # Count assigned managers (pre-assigned with preference 1)
        assigned_managers = 0
        for avail in self.availabilities:
            emp = self.employees.get(avail.employee_id)
            if emp and emp.is_manager and avail.preference_level == 1:
                assigned_managers += 1
        
        personnel_needed = total_personnel_needed - assigned_managers
        
        if personnel_needed <= 0:
            return
        
        total_shifts = len(self.shifts)
        
        # Create slack variables for each day
        for day in days_in_schedule:
            # Get shifts for this day
            day_shifts = [s for s in self.shifts.values() if s.day_of_week == day]
            shifts_in_day = len(day_shifts)
            
            # Get all personnel (non-manager) variables for this day
            day_vars = []
            for emp in self.schedulable_employees:
                for shift_id, shift in self.shifts.items():
                    if shift.day_of_week == day and (emp.id, shift_id) in self.variables:
                        day_vars.append(self.variables[(emp.id, shift_id)])
            
            if day_vars and total_shifts > 0:
                total_day = sum(day_vars)
                
                # Calculate target using proportional method
                target_for_day = personnel_needed * (shifts_in_day / total_shifts)
                
                # Create slack variables
                over_var = self.model.NewIntVar(0, 100, f'over_day_{day}')
                under_var = self.model.NewIntVar(0, 100, f'under_day_{day}')
                
                # Constraint: total_day + under_var - over_var = target_for_day
                self.model.Add(
                    total_day + under_var - over_var == round(target_for_day)
                )
                
                # Store for objective function
                self.slack_variables[f'over_day_{day}'] = (over_var, 5)
                self.slack_variables[f'under_day_{day}'] = (under_var, 3)
                
                self.stats['variables_created'] += 2
                self.stats['constraints_added'] += 1
        
        self.stats['soft_constraints'] += 1
    
    # ------------------------------------------------------------------------
    # OBJECTIVE FUNCTION
    # ------------------------------------------------------------------------
    
    def setup_objective_function(self):
        """Set up the objective function to maximize preferences"""
        
        objective_terms = []
        
        # 1. Maximize preference satisfaction
        for (emp_id, shift_id), var in self.variables.items():
            # Find preference level
            preference = None
            for avail in self.availabilities:
                if avail.employee_id == emp_id and avail.shift_id == shift_id:
                    preference = avail.preference_level
                    break
            
            if preference == 1:
                # Preferred: 100 points
                objective_terms.append(100 * var)
            elif preference == 2:
                # Available: 50 points
                objective_terms.append(50 * var)
        
        # 2. Penalties for day staffing imbalance
        for var, penalty in self.slack_variables.values():
            objective_terms.append(-penalty * var)
        
        # Set objective
        if objective_terms:
            self.model.Maximize(sum(objective_terms))
    
    # ------------------------------------------------------------------------
    # SOLVING AND SOLUTION EXTRACTION
    # ------------------------------------------------------------------------
    
    def solve(self) -> Dict[str, Any]:
        """Solve the CP-SAT model and return results"""
        
        start_time = time.time()
        
        # Add all constraints in order
        self.create_variables()
        self.add_availability_constraints()
        self.add_max_shifts_per_day_constraint()
        self.add_shift_staffing_constraints()
        self.add_trainee_supervision_constraints()
        self.add_cannot_work_alone_constraints()
        self.add_contract_type_constraints()
        self.add_day_staffing_balance()
        self.setup_objective_function()
        
        # Solve for schedulable employees
        status = self.solver.Solve(self.model)
        solve_time = time.time() - start_time
        
        # Process results
        result = {
            'success': False,
            'assignments': [],
            'violations': [],
            'metadata': {
                'solveTime': solve_time,
                'variablesCreated': self.stats['variables_created'],
                'constraintsAdded': self.stats['constraints_added'],
                'status': self.solver.StatusName(status),
                'optimal': status == cp_model.OPTIMAL,
                'feasible': status == cp_model.FEASIBLE or status == cp_model.OPTIMAL,
                'infeasible': status == cp_model.INFEASIBLE,
                'objectiveValue': self.solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None
            }
        }
        
        if status == cp_model.INFEASIBLE:
            result['violations'] = ['INFEASIBLE: No solution satisfies all hard constraints']
            return result
        
        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            result['violations'] = [f'SOLVER_ERROR: Solver status {self.solver.StatusName(status)}']
            return result
        
        # Extract assignments for schedulable employees
        assignments = self.extract_assignments()
        
        # Verify solution against hard constraints
        violations = self.verify_solution(assignments)
        
        if violations:
            result['assignments'] = assignments
            result['violations'] = violations
            return result
        
        # Add manager assignments (post-processing)
        manager_assignments = self.add_manager_post_assignments()
        
        # Combine assignments
        all_assignments = assignments + manager_assignments
        
        # Skip final verification with managers cause can extend max_employees of shift
        #final_violations = self.verify_solution(all_assignments)
        final_violations = violations

        result['assignments'] = all_assignments
        result['violations'] = final_violations
        result['success'] = len(final_violations) == 0
        
        return result
    
    def extract_assignments(self) -> List[Dict]:
        """Extract assignments from solver solution"""
        assignments = []
        assignment_slots = {}
        
        for (emp_id, shift_id), var in self.variables.items():
            if self.solver.Value(var) == 1:
                if shift_id not in assignment_slots:
                    assignment_slots[shift_id] = 1
                else:
                    assignment_slots[shift_id] += 1
                
                assignments.append({
                    'shiftId': shift_id,
                    'employeeId': emp_id,
                    'assignmentIndex': assignment_slots[shift_id],
                    'isManager': False
                })
        
        return assignments
    
    def verify_solution(self, assignments: List[Dict]) -> List[str]:
        """Verify solution satisfies all hard constraints"""
        violations = []
        
        # Group assignments by employee
        emp_assignments = {}
        for assign in assignments:
            emp_assignments.setdefault(assign['employeeId'], []).append(assign['shiftId'])
        
        # Check each employee
        for emp_id, assigned_shifts in emp_assignments.items():
            emp = self.employees.get(emp_id)
            if not emp:
                continue
            
            # Skip managers for certain checks
            if emp.is_manager:
                continue
            
            # 1. Check max 1 shift per day
            shifts_by_day = {}
            for shift_id in assigned_shifts:
                shift = self.shifts.get(shift_id)
                if shift:
                    shifts_by_day.setdefault(shift.day_of_week, []).append(shift_id)
            
            for day, day_shifts in shifts_by_day.items():
                if len(day_shifts) > 1:
                    violations.append(
                        f'MULTIPLE_SHIFTS_PER_DAY: {emp.name} assigned to {len(day_shifts)} shifts on day {day}'
                    )
            
            # 2. Check contract constraints
            if emp.is_schedulable:
                required_shifts = emp.required_shifts
                if required_shifts > 0 and len(assigned_shifts) != required_shifts:
                    violations.append(
                        f'CONTRACT_VIOLATION: {emp.name} has {emp.contract_type} contract '
                        f'(requires {required_shifts} shifts) but assigned to {len(assigned_shifts)} shifts'
                    )
            
            # 3. Check availability
            for shift_id in assigned_shifts:
                available = False
                for avail in self.availabilities:
                    if avail.employee_id == emp_id and avail.shift_id == shift_id:
                        if avail.preference_level == 3:
                            violations.append(
                                f'AVAILABILITY_VIOLATION: {emp.name} assigned to shift '
                                f'{shift_id} but marked as unavailable'
                            )
                        available = True
                        break
                
                if not available:
                    violations.append(
                        f'AVAILABILITY_VIOLATION: {emp.name} assigned to shift '
                        f'{shift_id} but no availability set'
                    )
        
        # 4. Check shift staffing
        for shift_id, shift in self.shifts.items():
            assigned_to_shift = [a for a in assignments if a['shiftId'] == shift_id]
            
            if len(assigned_to_shift) < shift.min_employees:
                violations.append(
                    f'MIN_STAFFING_VIOLATION: Shift {shift_id} has {len(assigned_to_shift)} '
                    f'assignments but requires at least {shift.min_employees}'
                )
            
            if len(assigned_to_shift) > shift.max_employees:
                violations.append(
                    f'MAX_STAFFING_VIOLATION: Shift {shift_id} has {len(assigned_to_shift)} '
                    f'assignments but maximum is {shift.max_employees}'
                )
        
        # 5. Check trainee supervision
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        if trainees:
            for shift_id, shift in self.shifts.items():
                trainee_count = 0
                experienced_count = 0
                
                for assign in assignments:
                    if assign['shiftId'] == shift_id:
                        emp = self.employees.get(assign['employeeId'])
                        if emp and emp.is_schedulable:
                            if emp.is_trainee:
                                trainee_count += 1
                            else:
                                experienced_count += 1
                
                if trainee_count > 0 and experienced_count == 0:
                    violations.append(
                        f'TRAINEE_SUPERVISION_VIOLATION: Shift {shift_id} has '
                        f'{trainee_count} trainee(s) but no experienced employee'
                    )
        
        # 6. Check "cannot work alone"
        for shift_id, shift in self.shifts.items():
            assigned_to_shift = [a for a in assignments if a['shiftId'] == shift_id]
            assigned_employees = [self.employees.get(a['employeeId']) for a in assigned_to_shift]
            
            # Check each assigned employee who cannot work alone
            for emp in assigned_employees:
                if emp and emp.is_schedulable and emp.cannot_work_alone:
                    # Count total schedulable assignments for this shift
                    schedulable_in_shift = len([
                        a for a in assigned_to_shift
                        if self.employees.get(a['employeeId'], Employee({
                            'id': '', 
                            'employeeType': '', 
                            'contractType': ''
                        })).is_schedulable
                    ])
                    
                    if schedulable_in_shift < 2:
                        violations.append(
                            f'CANNOT_WORK_ALONE_VIOLATION: {emp.name} assigned to '
                            f'shift {shift_id} with only {schedulable_in_shift} schedulable employee(s)'
                        )
        
        return violations

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Main entry point for the Python solver"""
    try:
        # Read input data from stdin
        input_data = json.load(sys.stdin)
        
        # Create solver instance
        solver = ShiftSchedulingSolver(input_data)
        
        # Check feasibility first
        is_feasible, feasibility_issues = solver.check_feasibility()
        
        if not is_feasible:           
            result = {
                'success': False,
                'assignments': [],
                'violations': feasibility_issues,
                'metadata': {
                    'solveTime': 0,
                    'variablesCreated': 0,
                    'constraintsAdded': 0,
                    'status': 'INFEASIBLE',
                    'optimal': False,
                    'feasible': False,
                    'infeasible': True,
                    'objectiveValue': None
                }
            }
        else:
            # Solve the problem
            result = solver.solve()
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except json.JSONDecodeError as e:
        error_result = {
            'success': False,
            'assignments': [],
            'violations': [f'JSON parse error: {str(e)}'],
            'metadata': {
                'solveTime': 0,
                'variablesCreated': 0,
                'constraintsAdded': 0,
                'status': 'ERROR',
                'optimal': False,
                'feasible': False,
                'infeasible': False,
                'objectiveValue': None
            }
        }
        print(json.dumps(error_result))
    except Exception as e:
        error_result = {
            'success': False,
            'assignments': [],
            'violations': [f'Solver error: {str(e)}'],
            'metadata': {
                'solveTime': 0,
                'variablesCreated': 0,
                'constraintsAdded': 0,
                'status': 'ERROR',
                'optimal': False,
                'feasible': False,
                'infeasible': False,
                'objectiveValue': None
            }
        }
        print(json.dumps(error_result))
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()