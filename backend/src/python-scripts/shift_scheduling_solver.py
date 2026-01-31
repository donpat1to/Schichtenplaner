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
        self.contract_type = data.get('contractType')  # 'small', 'large', 'flexible'
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
            return 0  # Default for managers, apprentices, guests

class Shift:
    def __init__(self, data: Dict):
        self.id = data['id']
        self.plan_id = data['planId']
        self.time_slot_id = data['timeSlotId']
        self.day_of_week = data['dayOfWeek']  # 1=Monday, 7=Sunday
        self.required_employees = data['requiredEmployees']
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
            'maxTimeInSeconds': 120,
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
        self.solver.parameters.max_time_in_seconds = self.solver_options.get('maxTimeInSeconds', 120)
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
    # FEASIBILITY CHECKS
    # ------------------------------------------------------------------------
    
    def check_feasibility(self) -> Tuple[bool, List[str]]:
        """Check if the problem is mathematically feasible"""
        issues = []
        
        # 1. Calculate total required slots
        total_required_slots = sum(s.required_employees for s in self.shifts.values())
        
        # 2. Calculate employee capacity
        employee_capacity = 0
        small_contract = 0
        large_contract = 0
        
        for emp in self.schedulable_employees:
            if emp.contract_type == 'small':
                employee_capacity += 1
                small_contract += 1
            elif emp.contract_type == 'large':
                employee_capacity += 2
                large_contract += 1
            elif emp.contract_type == 'flexible':
                # Flexible employees can work up to total required
                employee_capacity += total_required_slots
        
        if employee_capacity > total_required_slots:
            issues.append(
                f"Too much employee capacity: {employee_capacity} < {total_required_slots}"
            )
        
        # 3. Check per-shift availability
        for shift_id, shift in self.shifts.items():
            # Count employees available for this shift (preference 1 or 2)
            available_employees = set()
            for avail in self.availabilities:
                if avail.shift_id == shift_id and avail.preference_level in [1, 2]:
                    emp = self.employees.get(avail.employee_id)
                    if emp and emp.is_schedulable:
                        available_employees.add(emp.id)
            
            if len(available_employees) < shift.min_employees:
                issues.append(
                    f"Shift {shift_id} (Day {shift.day_of_week}, {shift.time_slot_name}): "
                    f"Only {len(available_employees)} employees available, "
                    f"but min required is {shift.min_employees}"
                )
        
        # 4. Check trainee supervision feasibility
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        experienced = [emp for emp in self.schedulable_employees if not emp.is_trainee]
        
        if trainees and not experienced:
            issues.append("No experienced employees available to supervise trainees")
        
        # 5. Check "cannot work alone" feasibility
        cannot_work_alone = [emp for emp in self.schedulable_employees if not emp.can_work_alone]
        if cannot_work_alone and len(self.schedulable_employees) < 2:
            issues.append("Employees who cannot work alone, but not enough employees for pairing")
        
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
        # For preference level 3, we simply don't create the variable
        
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
                self.model.Add(total_assigned >= shift.min_employees)
                self.stats['constraints_added'] += 1
                
                # Maximum staffing limit
                self.model.Add(total_assigned <= shift.max_employees)
                self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_trainee_supervision_constraints(self):
        """Add trainee supervision constraints (HARD)"""
        
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        experienced = [emp for emp in self.schedulable_employees if not emp.is_trainee]
        
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
                for exp in experienced:
                    if (exp.id, shift_id) in self.variables:
                        experienced_vars.append(self.variables[(exp.id, shift_id)])
                
                # Constraint: If any trainee is assigned, at least one experienced must be assigned
                # Using big-M formulation: sum(trainee_vars) <= M * sum(experienced_vars)
                M = len(trainee_vars)  # Maximum possible trainees in this shift
                
                if experienced_vars:
                    self.model.Add(
                        sum(trainee_vars) <= M * sum(experienced_vars)
                    )
                    self.stats['constraints_added'] += 1
                else:
                    # No experienced employees available for this shift
                    # Trainees cannot work this shift at all
                    for var in trainee_vars:
                        self.model.Add(var == 0)
                        self.stats['constraints_added'] += 1
        
        self.stats['hard_constraints'] += 1
    
    def add_cannot_work_alone_constraints(self):
        """Add constraints for employees who cannot work alone (HARD)"""
        
        cannot_work_alone = [emp for emp in self.schedulable_employees if not emp.can_work_alone]
        
        if not cannot_work_alone:
            return
        
        for emp in cannot_work_alone:
            for shift_id, shift in self.shifts.items():
                if (emp.id, shift_id) in self.variables:
                    # Get all variables for this shift (including this employee)
                    all_shift_vars = []
                    for other_emp in self.schedulable_employees:
                        if (other_emp.id, shift_id) in self.variables:
                            all_shift_vars.append(self.variables[(other_emp.id, shift_id)])
                    
                    # If this employee is assigned (var = 1), then total assignments must be >= 2
                    # Formulation: total_assigned >= 2 * var_emp
                    var_emp = self.variables[(emp.id, shift_id)]
                    self.model.Add(sum(all_shift_vars) >= 2 * var_emp)
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
            
            if emp.contract_type == 'small':
                # HARD: Exactly 1 shift
                self.model.Add(total_shifts == 1)
                self.stats['constraints_added'] += 1
            elif emp.contract_type == 'large':
                # HARD: Exactly 2 shifts
                self.model.Add(total_shifts == 2)
                self.stats['constraints_added'] += 1
            # 'flexible' has no hard constraint
        
        self.stats['hard_constraints'] += 1
    
    def add_manager_post_assignments(self):
        """Add manager assignments after solving for schedulable employees (POST-PROCESSING)"""
        
        # This method is called after we have assignments for schedulable employees
        # Managers are added to shifts where they are available and where there is space
        
        # First, get all manager availability records
        manager_availabilities = {}
        for avail in self.availabilities:
            emp = self.employees.get(avail.employee_id)
            if emp and emp.is_manager:
                manager_availabilities.setdefault(avail.shift_id, []).append(
                    (emp.id, avail.preference_level)
                )
        
        # We'll return a list of manager assignments to be added to the final result
        manager_assignments = []
        
        # For each shift, check if we can add managers
        for shift_id, shift in self.shifts.items():
            # Get current assignments for this shift (from schedulable employees)
            current_assignment_count = 0
            for (emp_id, s_id), var in self.variables.items():
                if s_id == shift_id and self.solver.Value(var) == 1:
                    current_assignment_count += 1
            
            # Check if there's room for managers
            if current_assignment_count >= shift.max_employees:
                continue  # No room for managers
            
            # Get available managers for this shift
            available_managers = manager_availabilities.get(shift_id, [])
            
            # Sort by preference (preferred first)
            available_managers.sort(key=lambda x: x[1])
            
            # Add managers until we reach max_employees or run out of available managers
            for manager_id, preference in available_managers:
                if current_assignment_count >= shift.max_employees:
                    break
                
                # Add manager assignment
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
        
        # Calculate target personnel per day (excluding managers)
        total_personnel_needed = sum(
            s.required_employees for s in self.shifts.values()
        )
        
        # Count assigned managers (pre-assigned with preference 1)
        assigned_managers = 0
        for avail in self.availabilities:
            emp = self.employees.get(avail.employee_id)
            if emp and emp.is_manager and avail.preference_level == 1:
                assigned_managers += 1
        
        target_per_day = (total_personnel_needed - assigned_managers) / len(days_in_schedule)
        tolerance = self.constraints.get('dayBalanceTolerance', 0.2)  # 20%
        over_penalty = self.constraints.get('overStaffingPenalty', 5)
        under_penalty = self.constraints.get('underStaffingPenalty', 3)
        
        # Create slack variables for each day
        for day in days_in_schedule:
            # Get all personnel (non-manager) variables for this day
            day_vars = []
            for emp in self.schedulable_employees:
                for shift_id, shift in self.shifts.items():
                    if shift.day_of_week == day and (emp.id, shift_id) in self.variables:
                        day_vars.append(self.variables[(emp.id, shift_id)])
            
            if day_vars:
                total_day = sum(day_vars)
                
                # Create slack variables
                over_var = self.model.NewIntVar(0, 100, f'over_day_{day}')
                under_var = self.model.NewIntVar(0, 100, f'under_day_{day}')
                
                # Constraint: total_day = target + over - under
                self.model.Add(
                    total_day - over_var + under_var == round(target_per_day)
                )
                
                # Store for objective function
                self.slack_variables[f'over_day_{day}'] = (over_var, over_penalty)
                self.slack_variables[f'under_day_{day}'] = (under_var, under_penalty)
                
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
            # preference == 3 not in variables
        
        # 2. Penalties for day staffing imbalance
        for var, penalty in self.slack_variables.values():
            objective_terms.append(-penalty * var)  # Negative because we maximize
        
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
        
        # Final verification with managers included
        final_violations = self.verify_solution(all_assignments)
        
        result['assignments'] = all_assignments
        result['violations'] = final_violations
        result['success'] = len(final_violations) == 0
        
        return result
    
    def extract_assignments(self) -> List[Dict]:
        """Extract assignments from solver solution"""
        assignments = []
        assignment_slots = {}  # Track assignment indices per shift
        
        # First pass: collect all assignments
        for (emp_id, shift_id), var in self.variables.items():
            if self.solver.Value(var) == 1:
                # Determine assignment index (slot within shift)
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
            
            # 1. Check max 1 shift per day (only for schedulable employees)
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
            
            # 2. Check contract constraints (for personnel only)
            if emp.is_schedulable:
                if emp.contract_type == 'small' and len(assigned_shifts) != 1:
                    violations.append(
                        f'CONTRACT_VIOLATION: {emp.name} has small contract (requires 1 shift) '
                        f'but assigned to {len(assigned_shifts)} shifts'
                    )
                elif emp.contract_type == 'large' and len(assigned_shifts) != 2:
                    violations.append(
                        f'CONTRACT_VIOLATION: {emp.name} has large contract (requires 2 shifts) '
                        f'but assigned to {len(assigned_shifts)} shifts'
                    )
            
            # 3. Check availability
            for shift_id in assigned_shifts:
                # Find availability record
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
                    # No availability record found
                    violations.append(
                        f'AVAILABILITY_VIOLATION: {emp.name} assigned to shift '
                        f'{shift_id} but no availability set'
                    )
        
        # 4. Check shift staffing (including managers)
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
        
        # 5. Check trainee supervision (only for schedulable employees)
        trainees = [emp for emp in self.schedulable_employees if emp.is_trainee]
        if trainees:
            for shift_id, shift in self.shifts.items():
                # Count trainees and experienced in this shift
                trainee_count = 0
                experienced_count = 0
                
                for assign in assignments:
                    if assign['shiftId'] == shift_id:
                        emp = self.employees.get(assign['employeeId'])
                        if emp and emp.is_schedulable:  # Only check schedulable employees
                            if emp.is_trainee:
                                trainee_count += 1
                            elif not emp.is_trainee:
                                experienced_count += 1
                
                if trainee_count > 0 and experienced_count == 0:
                    violations.append(
                        f'TRAINEE_SUPERVISION_VIOLATION: Shift {shift_id} has '
                        f'{trainee_count} trainee(s) but no experienced employee'
                    )
        
        # 6. Check "cannot work alone" (only for schedulable employees)
        cannot_work_alone = [emp for emp in self.schedulable_employees if not emp.can_work_alone]
        for emp in cannot_work_alone:
            for assign in assignments:
                if assign['employeeId'] == emp.id:
                    shift_id = assign['shiftId']
                    # Count total schedulable assignments for this shift
                    total_in_shift = len([
                        a for a in assignments 
                        if a['shiftId'] == shift_id 
                        and self.employees.get(a['employeeId'], Employee({'id': '', 'employeeType': '', 'contractType': ''})).is_schedulable
                    ])
                    if total_in_shift < 2:
                        violations.append(
                            f'CANNOT_WORK_ALONE_VIOLATION: {emp.name} assigned to '
                            f'shift {shift_id} with only {total_in_shift} schedulable employee(s)'
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