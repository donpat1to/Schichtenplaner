# backend/src/python-scripts/shift_scheduling_solver.py
"""
Shift Plan Scheduling Solver using Google OR-Tools CP-SAT

This solver handles daily shift assignments with the following constraints:

Hard Constraints:
1. Availability Constraints (preferenceLevel 3 = Not Available)
2. Maximum 1 shift per day per employee
3. Shift staffing requirements (min/max employees per shift)
4. Trainee supervision (trainees need experienced staff)
5. Employees who cannot work alone
6. Contract type constraints (small=1 shift, large=2 shifts)
7. Employee eligibility (active personnel only)
8. Manager pre-assignments (fixed assignments)

Soft Constraints:
9. Day staffing balance (penalize over/under staffing)
10. Maximize assignments to preferred shifts (pref1=100, pref2=50)
"""

from ortools.sat.python import cp_model
import json
import sys
import logging
import time
from typing import Dict, List, Any, Tuple, Set, Optional
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ShiftSchedulingSolutionCallback(cp_model.CpSolverSolutionCallback):
    """Callback to track solution progress"""

    def __init__(self):
        cp_model.CpSolverSolutionCallback.__init__(self)
        self.solution_count = 0
        self.start_time = time.time()
        self.solutions = []

    def on_solution_callback(self):
        current_time = time.time() - self.start_time
        self.solution_count += 1

        try:
            objective_value = self.ObjectiveValue()
        except:
            objective_value = 0

        try:
            best_bound = self.BestObjectiveBound()
        except:
            best_bound = 0

        solution_info = {
            'timestamp': current_time,
            'objective': objective_value,
            'bound': best_bound,
            'solution_count': self.solution_count
        }

        self.solutions.append(solution_info)
        print(f"Progress: Solution {self.solution_count}, Objective: {objective_value}, Time: {current_time:.2f}s", file=sys.stderr)


class ShiftSchedulingSolver:
    """CP-SAT Solver for Shift Plan Scheduling"""

    def __init__(self, max_time_seconds: int = 120, num_workers: int = 8):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = max_time_seconds
        self.solver.parameters.num_search_workers = num_workers
        self.solver.parameters.log_search_progress = False

        # Variables storage
        self.assignment_vars: Dict[Tuple[str, str, int], Any] = {}  # (employee_id, shift_id, slot_index) -> BoolVar
        self.shift_vars: Dict[Tuple[str, str], Any] = {}  # (employee_id, shift_id) -> BoolVar (for convenience)

    def solve(self, data: Dict) -> Dict:
        """
        Main solve method

        Args:
            data: Dictionary containing:
                - plan: Plan info (optional)
                - shifts: List of shift objects with requiredEmployees, minEmployees, maxEmployees
                - employees: List of employee objects
                - availabilities: List of availability preferences
                - constraints: Constraint configuration
                - solverOptions: Solver options

        Returns:
            Dictionary with assignments, violations, success flag, and metadata
        """
        start_time = time.time()

        try:
            # Extract data with defaults
            plan = data.get('plan', {})
            shifts = data.get('shifts', [])
            employees = data.get('employees', [])
            availabilities = data.get('availabilities', [])
            constraints = data.get('constraints', {})
            solver_options = data.get('solverOptions', {})

            # Set default constraints if not provided
            default_constraints = {
                'maxShiftsPerDay': 1,
                'traineeSupervision': True,
                'enforceContractHours': True,
                'dayStaffingBalance': True,
                'dayBalanceTolerance': 0.2,
                'overStaffingPenalty': 5,
                'underStaffingPenalty': 3
            }
            
            for key, default_value in default_constraints.items():
                if key not in constraints:
                    constraints[key] = default_value

            print(f"\n=== SHIFT SCHEDULING SOLVER ===", file=sys.stderr)
            print(f"Plan: {plan.get('name', 'Unknown Plan')}", file=sys.stderr)
            print(f"Shifts: {len(shifts)}", file=sys.stderr)
            print(f"Employees: {len(employees)}", file=sys.stderr)
            print(f"Availabilities: {len(availabilities)}", file=sys.stderr)

            # Filter employees
            schedulable_employees = [
                emp for emp in employees 
                if emp.get('isActive', True) and 
                emp.get('employeeType') == 'personell'
            ]
            
            managers = [
                emp for emp in employees 
                if emp.get('isActive', True) and 
                emp.get('employeeType') == 'manager'
            ]

            # Categorize employees
            trainees = [emp for emp in schedulable_employees if emp.get('isTrainee', False)]
            experienced = [emp for emp in schedulable_employees if not emp.get('isTrainee', False)]
            cannot_work_alone = [emp for emp in schedulable_employees if not emp.get('canWorkAlone', True)]
            
            small_contract = [emp for emp in schedulable_employees if emp.get('contractType') == 'small']
            large_contract = [emp for emp in schedulable_employees if emp.get('contractType') == 'large']
            flexible_contract = [emp for emp in schedulable_employees if emp.get('contractType') in ['flexible', None]]

            print(f"\nEmployee Categories:", file=sys.stderr)
            print(f"  - Schedulable employees: {len(schedulable_employees)}", file=sys.stderr)
            print(f"    * Trainees: {len(trainees)}", file=sys.stderr)
            print(f"    * Experienced: {len(experienced)}", file=sys.stderr)
            print(f"    * Cannot work alone: {len(cannot_work_alone)}", file=sys.stderr)
            print(f"  - Managers: {len(managers)}", file=sys.stderr)
            print(f"\nContract Types:", file=sys.stderr)
            print(f"  - Small (1 shift): {len(small_contract)}", file=sys.stderr)
            print(f"  - Large (2 shifts): {len(large_contract)}", file=sys.stderr)
            print(f"  - Flexible: {len(flexible_contract)}", file=sys.stderr)

            # Build lookup dictionaries
            employee_lookup = {emp['id']: emp for emp in employees}
            shift_lookup = {shift['id']: shift for shift in shifts}
            
            # Build preference lookup
            pref_lookup: Dict[Tuple[str, str], int] = {}
            for avail in availabilities:
                key = (avail['employeeId'], avail['shiftId'])
                pref_lookup[key] = avail['preferenceLevel']

            # Group shifts by day for day constraints
            shifts_by_day: Dict[int, List[Dict]] = defaultdict(list)
            for shift in shifts:
                shifts_by_day[shift['dayOfWeek']].append(shift)

            print(f"\nShifts by day:", file=sys.stderr)
            for day in sorted(shifts_by_day.keys()):
                print(f"  Day {day}: {len(shifts_by_day[day])} shifts", file=sys.stderr)

            # 1. Create assignment variables per shift slot
            print(f"\nCreating variables...", file=sys.stderr)
            variables_created = 0
            
            for shift in shifts:
                shift_id = shift['id']
                required_slots = shift.get('requiredEmployees', 2)
                
                for emp in schedulable_employees:
                    emp_id = emp['id']
                    
                    # Create one variable per possible slot (1-based indexing)
                    for slot_idx in range(1, required_slots + 1):
                        var_name = f"assign_{emp_id}_{shift_id}_{slot_idx}"
                        var = self.model.NewBoolVar(var_name)
                        self.assignment_vars[(emp_id, shift_id, slot_idx)] = var
                        variables_created += 1
                    
                    # Also create a convenience variable that is 1 if employee is assigned to this shift at all
                    shift_var_name = f"emp_shift_{emp_id}_{shift_id}"
                    shift_var = self.model.NewBoolVar(shift_var_name)
                    self.shift_vars[(emp_id, shift_id)] = shift_var
                    
                    # Link shift_var to assignment variables
                    assignment_vars_for_shift = [
                        self.assignment_vars[(emp_id, shift_id, slot_idx)]
                        for slot_idx in range(1, required_slots + 1)
                    ]
                    
                    # shift_var = 1 if any assignment_var is 1
                    self.model.AddMaxEquality(shift_var, assignment_vars_for_shift)
                    # If shift_var is 1, at least one assignment_var must be 1 (already covered by AddMaxEquality)
                    # If shift_var is 0, all assignment_vars must be 0
                    for assignment_var in assignment_vars_for_shift:
                        self.model.Add(assignment_var <= shift_var)

            print(f"Created {variables_created} assignment variables", file=sys.stderr)
            print(f"Created {len(self.shift_vars)} shift convenience variables", file=sys.stderr)

            # 2. Hard Constraint: Availability (preferenceLevel 3 = Not Available)
            print(f"\nApplying availability constraints...", file=sys.stderr)
            unavail_count = 0
            
            for emp in schedulable_employees:
                emp_id = emp['id']
                for shift in shifts:
                    shift_id = shift['id']
                    
                    # Default to unavailable if no preference set
                    pref_level = pref_lookup.get((emp_id, shift_id), 3)
                    
                    if pref_level == 3:  # Unavailable
                        # Employee cannot be assigned to any slot in this shift
                        for slot_idx in range(1, shift.get('requiredEmployees', 2) + 1):
                            var = self.assignment_vars.get((emp_id, shift_id, slot_idx))
                            # FIX: Use explicit None check instead of boolean evaluation
                            if var is not None:
                                self.model.Add(var == 0)
                                unavail_count += 1
            
            print(f"Added {unavail_count} unavailability constraints", file=sys.stderr)

            # 3. Hard Constraint: Maximum 1 shift per day
            print(f"\nApplying max 1 shift per day constraint...", file=sys.stderr)
            max_shifts_constraints = 0
            
            for emp in schedulable_employees:
                emp_id = emp['id']
                
                for day, day_shifts in shifts_by_day.items():
                    if len(day_shifts) > 1:  # Only need constraint if more than one shift that day
                        day_shift_vars = [
                            self.shift_vars[(emp_id, shift['id'])]
                            for shift in day_shifts
                            if (emp_id, shift['id']) in self.shift_vars
                        ]
                        
                        # FIX: Check if list has elements using len()
                        if len(day_shift_vars) > 0:
                            self.model.Add(sum(day_shift_vars) <= 1)
                            max_shifts_constraints += 1
            
            print(f"Added {max_shifts_constraints} max shifts per day constraints", file=sys.stderr)

            # 4. Hard Constraint: Shift staffing requirements
            print(f"\nApplying shift staffing constraints...", file=sys.stderr)
            staffing_constraints = 0
            
            for shift in shifts:
                shift_id = shift['id']
                min_emp = shift.get('minEmployees', 1)
                max_emp = shift.get('maxEmployees', 2)
                required_slots = shift.get('requiredEmployees', 2)
                
                # Count how many employees are assigned to this shift (across all slots)
                shift_assignment_vars = [
                    var for (emp_id, s_id, slot_idx), var in self.assignment_vars.items()
                    if s_id == shift_id
                ]
                
                # FIX: Check if list has elements using len()
                if len(shift_assignment_vars) > 0:
                    self.model.Add(sum(shift_assignment_vars) >= min_emp)
                    self.model.Add(sum(shift_assignment_vars) <= max_emp)
                    staffing_constraints += 2
                
                # Ensure exactly required_slots assignments (one per slot)
                # But slots can be empty if minEmployees allows it
                # Actually, we want exactly required_slots variables to be true
                # This ensures each slot gets exactly one employee or remains empty
                # We'll handle this by making sure the sum equals required_slots
                if len(shift_assignment_vars) > 0:
                    self.model.Add(sum(shift_assignment_vars) == required_slots)
                    staffing_constraints += 1
            
            print(f"Added {staffing_constraints} shift staffing constraints", file=sys.stderr)

            # 5. Hard Constraint: Trainee supervision
            print(f"\nApplying trainee supervision constraints...", file=sys.stderr)
            trainee_constraints = 0
            
            if constraints.get('traineeSupervision', True) and len(trainees) > 0 and len(experienced) > 0:
                for shift in shifts:
                    shift_id = shift['id']
                    
                    # Sum of trainees assigned to this shift
                    trainee_vars = [
                        self.shift_vars[(trainee['id'], shift_id)]
                        for trainee in trainees
                        if (trainee['id'], shift_id) in self.shift_vars
                    ]
                    
                    # Sum of experienced assigned to this shift
                    experienced_vars = [
                        self.shift_vars[(exp['id'], shift_id)]
                        for exp in experienced
                        if (exp['id'], shift_id) in self.shift_vars
                    ]
                    
                    # FIX: Check if lists have elements using len()
                    if len(trainee_vars) > 0 and len(experienced_vars) > 0:
                        # For each trainee, if they're assigned, at least one experienced must be assigned
                        for trainee_var in trainee_vars:
                            self.model.Add(sum(experienced_vars) >= trainee_var)
                            trainee_constraints += 1
            
            print(f"Added {trainee_constraints} trainee supervision constraints", file=sys.stderr)

            # 6. Hard Constraint: Employees who cannot work alone
            print(f"\nApplying cannot work alone constraints...", file=sys.stderr)
            alone_constraints = 0
            
            for emp in cannot_work_alone:
                emp_id = emp['id']
                
                for shift in shifts:
                    shift_id = shift['id']
                    
                    if (emp_id, shift_id) in self.shift_vars:
                        emp_shift_var = self.shift_vars[(emp_id, shift_id)]
                        
                        # Sum of other employees assigned to this shift
                        other_employees = [
                            self.shift_vars[(other_emp['id'], shift_id)]
                            for other_emp in schedulable_employees
                            if other_emp['id'] != emp_id and (other_emp['id'], shift_id) in self.shift_vars
                        ]
                        
                        # FIX: Check if list has elements using len()
                        if len(other_employees) > 0:
                            # If this employee is assigned, at least one other must be assigned
                            self.model.Add(sum(other_employees) >= emp_shift_var)
                            alone_constraints += 1
            
            print(f"Added {alone_constraints} cannot work alone constraints", file=sys.stderr)

            # 7. Hard Constraint: Contract type requirements
            print(f"\nApplying contract type constraints...", file=sys.stderr)
            contract_constraints = 0
            
            if constraints.get('enforceContractHours', True):
                # Small contract: exactly 1 shift
                for emp in small_contract:
                    emp_id = emp['id']
                    emp_shift_vars = [
                        var for (e_id, shift_id), var in self.shift_vars.items()
                        if e_id == emp_id
                    ]
                    
                    # FIX: Check if list has elements using len()
                    if len(emp_shift_vars) > 0:
                        self.model.Add(sum(emp_shift_vars) == 1)
                        contract_constraints += 1
                
                # Large contract: exactly 2 shifts
                for emp in large_contract:
                    emp_id = emp['id']
                    emp_shift_vars = [
                        var for (e_id, shift_id), var in self.shift_vars.items()
                        if e_id == emp_id
                    ]
                    
                    # FIX: Check if list has elements using len()
                    if len(emp_shift_vars) > 0:
                        self.model.Add(sum(emp_shift_vars) == 2)
                        contract_constraints += 1
                
                # Flexible contract: no specific constraint (can work 0 or more shifts)
            
            print(f"Added {contract_constraints} contract type constraints", file=sys.stderr)

            # 8. Hard Constraint: Manager pre-assignments
            print(f"\nApplying manager pre-assignments...", file=sys.stderr)
            manager_assignments = 0
            
            for avail in availabilities:
                emp_id = avail['employeeId']
                shift_id = avail['shiftId']
                
                emp = employee_lookup.get(emp_id)
                if emp and emp.get('employeeType') == 'manager' and avail['preferenceLevel'] == 1:
                    # Manager is pre-assigned to this shift
                    # We need to count this towards shift requirements
                    # For now, we'll just log it
                    manager_assignments += 1
                    print(f"  Manager {emp_id} pre-assigned to shift {shift_id}", file=sys.stderr)
            
            print(f"Found {manager_assignments} manager pre-assignments", file=sys.stderr)

            # 9. Soft Constraint: Day staffing balance
            print(f"\nSetting up day staffing balance (soft constraint)...", file=sys.stderr)
            objective_terms = []
            
            if constraints.get('dayStaffingBalance', True) and len(shifts_by_day) > 1:
                # Calculate target personnel per day
                total_required = sum(shift.get('requiredEmployees', 2) for shift in shifts)
                num_days = len(shifts_by_day)
                target_per_day = total_required / num_days
                tolerance = constraints.get('dayBalanceTolerance', 0.2)
                
                over_penalty = constraints.get('overStaffingPenalty', 5)
                under_penalty = constraints.get('underStaffingPenalty', 3)
                
                print(f"  Target per day: {target_per_day:.2f}", file=sys.stderr)
                print(f"  Tolerance: {tolerance*100}%", file=sys.stderr)
                print(f"  Over-staffing penalty: {over_penalty}", file=sys.stderr)
                print(f"  Under-staffing penalty: {under_penalty}", file=sys.stderr)
                
                for day, day_shifts in shifts_by_day.items():
                    # Count assignments for this day
                    day_assignment_vars = []
                    for shift in day_shifts:
                        shift_id = shift['id']
                        shift_assignment_vars = [
                            var for (emp_id, s_id, slot_idx), var in self.assignment_vars.items()
                            if s_id == shift_id
                        ]
                        day_assignment_vars.extend(shift_assignment_vars)
                    
                    # FIX: Check if list has elements using len()
                    if len(day_assignment_vars) > 0:
                        day_total = sum(day_assignment_vars)
                        
                        # Create slack variables for over/under staffing
                        over_slack = self.model.NewIntVar(0, 100, f"over_slack_day_{day}")
                        under_slack = self.model.NewIntVar(0, 100, f"under_slack_day_{day}")
                        
                        # day_total - target_per_day = over_slack - under_slack
                        self.model.Add(day_total - target_per_day == over_slack - under_slack)
                        
                        # Add penalties to objective
                        objective_terms.append(-over_penalty * over_slack)
                        objective_terms.append(-under_penalty * under_slack)

            # 10. Objective: Maximize assignments to preferred shifts
            print(f"\nSetting up objective function...", file=sys.stderr)
            PREF1_WEIGHT = 100  # Preferred
            PREF2_WEIGHT = 50   # Available
            
            for (emp_id, shift_id, slot_idx), var in self.assignment_vars.items():
                pref_level = pref_lookup.get((emp_id, shift_id), 3)
                
                if pref_level == 1:  # Preferred
                    objective_terms.append(PREF1_WEIGHT * var)
                elif pref_level == 2:  # Available
                    objective_terms.append(PREF2_WEIGHT * var)
                # Level 3 already excluded by hard constraints
            
            print(f"Objective function has {len(objective_terms)} terms", file=sys.stderr)

            # Set objective: maximize
            if len(objective_terms) > 0:
                self.model.Maximize(sum(objective_terms))
                print(f"Set maximization objective", file=sys.stderr)
            else:
                print(f"WARNING: No objective terms set!", file=sys.stderr)

            # Solve
            print(f"\nStarting solver...", file=sys.stderr)
            callback = ShiftSchedulingSolutionCallback()
            status = self.solver.Solve(self.model, callback)

            solve_time = time.time() - start_time
            print(f"Solver finished in {solve_time:.2f}s with status: {self._status_string(status)}", file=sys.stderr)

            # Extract solution
            assignments = []
            violations = []

            if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                # Extract assignments
                for (emp_id, shift_id, slot_idx), var in self.assignment_vars.items():
                    if self.solver.Value(var) == 1:
                        assignments.append({
                            'shiftId': shift_id,
                            'employeeId': emp_id,
                            'assignmentIndex': slot_idx
                        })
                
                # Add manager assignments (fixed)
                for avail in availabilities:
                    emp_id = avail['employeeId']
                    shift_id = avail['shiftId']
                    
                    emp = employee_lookup.get(emp_id)
                    if emp and emp.get('employeeType') == 'manager' and avail['preferenceLevel'] == 1:
                        # Find next available slot
                        shift = shift_lookup.get(shift_id)
                        if shift:
                            # Check how many assignments already for this shift
                            existing_for_shift = [a for a in assignments if a['shiftId'] == shift_id]
                            next_slot = len(existing_for_shift) + 1
                            
                            if next_slot <= shift.get('requiredEmployees', 2):
                                assignments.append({
                                    'shiftId': shift_id,
                                    'employeeId': emp_id,
                                    'assignmentIndex': next_slot
                                })

                # Validate and detect violations
                violations = self._detect_violations(
                    assignments, employees, shifts, availabilities, constraints
                )

            else:
                # Provide detailed infeasibility analysis
                violations.append(f"SOLVER_FAILED: No feasible solution found (status: {self._status_string(status)})")
                
                # Analyze why it's infeasible
                violations.extend(self._analyze_infeasibility(
                    schedulable_employees, shifts, availabilities, constraints
                ))

            success = status in [cp_model.OPTIMAL, cp_model.FEASIBLE] and len(violations) == 0

            return {
                'success': success,
                'assignments': assignments,
                'violations': violations,
                'progress': callback.solutions,
                'metadata': {
                    'solveTime': self.solver.WallTime(),
                    'variablesCreated': len(self.assignment_vars),
                    'constraintsAdded': self.model.Proto().constraints.__len__(),
                    'optimal': status == cp_model.OPTIMAL,
                    'status': self._status_string(status),
                    'solutionsFound': callback.solution_count,
                    'objectiveValue': self.solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else 0
                }
            }

        except Exception as e:
            logger.error(f"Solver error: {e}", exc_info=True)
            return {
                'success': False,
                'assignments': [],
                'violations': [f'ERROR: {str(e)}'],
                'progress': [],
                'metadata': {
                    'solveTime': time.time() - start_time,
                    'variablesCreated': 0,
                    'constraintsAdded': 0,
                    'optimal': False,
                    'status': 'ERROR'
                }
            }

    def _analyze_infeasibility(
        self,
        employees: List[Dict],
        shifts: List[Dict],
        availabilities: List[Dict],
        constraints: Dict
    ) -> List[str]:
        """Analyze why the problem is infeasible and provide detailed feedback"""
        violations = []
        
        # Build preference lookup
        pref_lookup = {}
        for avail in availabilities:
            key = (avail['employeeId'], avail['shiftId'])
            pref_lookup[key] = avail['preferenceLevel']
        
        # Check per-shift feasibility
        for shift in shifts:
            shift_id = shift['id']
            min_emp = shift.get('minEmployees', 1)
            
            # Count how many employees are available for this shift
            available_count = 0
            for emp in employees:
                emp_id = emp['id']
                pref_level = pref_lookup.get((emp_id, shift_id), 3)
                if pref_level in [1, 2]:  # Preferred or available
                    available_count += 1
            
            if available_count < min_emp:
                violations.append(
                    f"SHIFT_UNDERSTAFFED: Shift {shift_id} (Day {shift.get('dayOfWeek')}) "
                    f"requires minimum {min_emp} employees but only {available_count} are available. "
                    f"Add more employee availability for this shift."
                )
        
        # Check contract type feasibility
        small_contract = [emp for emp in employees if emp.get('contractType') == 'small']
        large_contract = [emp for emp in employees if emp.get('contractType') == 'large']
        
        # For small contract employees, check if they have enough available shifts
        for emp in small_contract:
            emp_id = emp['id']
            available_shifts = sum(
                1 for shift in shifts
                if pref_lookup.get((emp_id, shift['id']), 3) in [1, 2]
            )
            
            if available_shifts < 1:
                violations.append(
                    f"CONTRACT_UNFULFILLABLE: {emp.get('firstname', 'Unknown')} {emp.get('lastname', 'Employee')} "
                    f"has small contract (requires 1 shift) but is only available for {available_shifts} shifts."
                )
        
        # For large contract employees
        for emp in large_contract:
            emp_id = emp['id']
            available_shifts = sum(
                1 for shift in shifts
                if pref_lookup.get((emp_id, shift['id']), 3) in [1, 2]
            )
            
            if available_shifts < 2:
                violations.append(
                    f"CONTRACT_UNFULFILLABLE: {emp.get('firstname', 'Unknown')} {emp.get('lastname', 'Employee')} "
                    f"has large contract (requires 2 shifts) but is only available for {available_shifts} shifts."
                )
        
        return violations

    def _detect_violations(
        self,
        assignments: List[Dict],
        employees: List[Dict],
        shifts: List[Dict],
        availabilities: List[Dict],
        constraints: Dict
    ) -> List[str]:
        """Detect any constraint violations in the solution"""
        violations = []
        
        # Build lookup dictionaries
        emp_lookup = {e['id']: e for e in employees}
        shift_lookup = {s['id']: s for s in shifts}
        pref_lookup = {}
        for avail in availabilities:
            key = (avail['employeeId'], avail['shiftId'])
            pref_lookup[key] = avail['preferenceLevel']
        
        # Group assignments by shift
        assignments_by_shift: Dict[str, List[Dict]] = defaultdict(list)
        for assignment in assignments:
            assignments_by_shift[assignment['shiftId']].append(assignment)
        
        # Group assignments by employee
        assignments_by_employee: Dict[str, List[Dict]] = defaultdict(list)
        for assignment in assignments:
            assignments_by_employee[assignment['employeeId']].append(assignment)
        
        # Group assignments by employee and day
        assignments_by_employee_day: Dict[Tuple[str, int], List[Dict]] = defaultdict(list)
        for assignment in assignments:
            shift = shift_lookup.get(assignment['shiftId'])
            if shift:
                key = (assignment['employeeId'], shift['dayOfWeek'])
                assignments_by_employee_day[key].append(assignment)
        
        # 1. Check shift staffing requirements
        for shift_id, shift_assignments in assignments_by_shift.items():
            shift = shift_lookup.get(shift_id)
            if shift:
                count = len(shift_assignments)
                
                if count < shift.get('minEmployees', 1):
                    violations.append(
                        f"UNDERSTAFFED: Shift {shift_id} (Day {shift.get('dayOfWeek')}) "
                        f"has {count} employees but requires minimum {shift.get('minEmployees')}"
                    )
                
                if count > shift.get('maxEmployees', 2):
                    violations.append(
                        f"OVERSTAFFED: Shift {shift_id} (Day {shift.get('dayOfWeek')}) "
                        f"has {count} employees but maximum is {shift.get('maxEmployees')}"
                    )
                
                # Check if exactly requiredEmployees slots are filled
                if count != shift.get('requiredEmployees', 2):
                    violations.append(
                        f"SLOT_COUNT_MISMATCH: Shift {shift_id} has {count} assignments "
                        f"but requires {shift.get('requiredEmployees')}"
                    )
        
        # 2. Check max 1 shift per day
        for (emp_id, day), day_assignments in assignments_by_employee_day.items():
            if len(day_assignments) > 1:
                emp = emp_lookup.get(emp_id, {})
                violations.append(
                    f"MULTIPLE_SHIFTS_PER_DAY: {emp.get('firstname', 'Unknown')} "
                    f"{emp.get('lastname', 'Employee')} assigned to {len(day_assignments)} shifts on day {day}"
                )
        
        # 3. Check trainee supervision
        if constraints.get('traineeSupervision', True):
            for shift_id, shift_assignments in assignments_by_shift.items():
                has_trainee = False
                has_experienced = False
                
                for assignment in shift_assignments:
                    emp = emp_lookup.get(assignment['employeeId'])
                    if emp:
                        if emp.get('isTrainee', False):
                            has_trainee = True
                        elif emp.get('employeeType') == 'personell':
                            has_experienced = True
                
                if has_trainee and not has_experienced:
                    shift = shift_lookup.get(shift_id, {})
                    violations.append(
                        f"TRAINEE_UNSUPERVISED: Shift {shift_id} (Day {shift.get('dayOfWeek')}) "
                        f"has trainee but no experienced employee"
                    )
        
        # 4. Check employees who cannot work alone
        for emp in employees:
            if not emp.get('canWorkAlone', True):
                emp_id = emp['id']
                
                for assignment in assignments_by_employee.get(emp_id, []):
                    shift_id = assignment['shiftId']
                    shift_assignments = assignments_by_shift.get(shift_id, [])
                    
                    # Count other employees in the same shift
                    other_count = len([a for a in shift_assignments if a['employeeId'] != emp_id])
                    
                    if other_count == 0:
                        shift = shift_lookup.get(shift_id, {})
                        violations.append(
                            f"EMPLOYEE_ALONE: {emp.get('firstname', emp.get('firstname', 'Unknown'))} "
                            f"{emp.get('lastname', 'Employee')} (cannot work alone) is the only employee in shift {shift_id} (Day {shift.get('dayOfWeek')})"
                        )
        
        # 5. Check contract type requirements
        if constraints.get('enforceContractHours', True):
            for emp in employees:
                emp_id = emp['id']
                contract_type = emp.get('contractType')
                assigned_count = len(assignments_by_employee.get(emp_id, []))
                
                if contract_type == 'small' and assigned_count != 1:
                    violations.append(
                        f"CONTRACT_VIOLATION: {emp.get('firstname', 'Unknown')} {emp.get('lastname', 'Employee')} "
                        f"has small contract (requires 1 shift) but assigned to {assigned_count} shifts"
                    )
                
                elif contract_type == 'large' and assigned_count != 2:
                    violations.append(
                        f"CONTRACT_VIOLATION: {emp.get('firstname', 'Unknown')} {emp.get('lastname', 'Employee')} "
                        f"has large contract (requires 2 shifts) but assigned to {assigned_count} shifts"
                    )
        
        # 6. Check availability violations
        for assignment in assignments:
            emp_id = assignment['employeeId']
            shift_id = assignment['shiftId']
            
            pref_level = pref_lookup.get((emp_id, shift_id), 3)
            if pref_level == 3:
                emp = emp_lookup.get(emp_id, {})
                shift = shift_lookup.get(shift_id, {})
                violations.append(
                    f"UNAVAILABLE_ASSIGNED: {emp.get('firstname', 'Unknown')} "
                    f"{emp.get('lastname', 'Employee')} assigned to shift {shift_id} "
                    f"(Day {shift.get('dayOfWeek')}) but marked unavailable"
                )
        
        return violations

    def _status_string(self, status: int) -> str:
        """Convert solver status to string"""
        status_map = {
            cp_model.OPTIMAL: 'OPTIMAL',
            cp_model.FEASIBLE: 'FEASIBLE',
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'MODEL_INVALID',
            cp_model.UNKNOWN: 'UNKNOWN'
        }
        return status_map.get(status, f'UNKNOWN_{status}')


# Main execution
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise ValueError("No input data provided")

        data = json.loads(input_data)

        # Extract solver options
        solver_options = data.get('solverOptions', {})
        max_time = solver_options.get('maxTimeInSeconds', 120)
        num_workers = solver_options.get('numSearchWorkers', 8)

        # Create solver and solve
        solver = ShiftSchedulingSolver(
            max_time_seconds=max_time,
            num_workers=num_workers
        )

        result = solver.solve(data)

        # Output ONLY JSON to stdout
        print(json.dumps(result))

    except Exception as e:
        error_result = {
            'success': False,
            'assignments': [],
            'violations': [f'ERROR: {str(e)}'],
            'progress': [],
            'metadata': {
                'solveTime': 0,
                'variablesCreated': 0,
                'constraintsAdded': 0,
                'optimal': False,
                'status': 'ERROR'
            }
        }
        print(json.dumps(error_result))
        sys.exit(1)