# backend/src/python-scripts/weekly_scheduling_solver.py
"""
Weekly Plan Scheduling Solver using Google OR-Tools CP-SAT

This solver handles whole-week assignments with the following constraints:

Hard Constraints:
- preferenceLevel 3 = Not Available (employee cannot be assigned)
- Each week requires minEmployees to maxEmployees assignments
- Trainees must have at least one experienced employee in the same week
- Each employee must be assigned exactly their requiredWeeks

Soft Constraints (Optimization):
- Maximize assignments to preferred weeks (preferenceLevel 1)
- Support assignmentStyle: 'consecutive' or 'scattered'
- For consecutive: try to assign weeks in blocks of assignmentStyleConsecutive size
"""

from ortools.sat.python import cp_model
import json
import sys
import logging
import time
from datetime import datetime
from typing import Dict, List, Any, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WeeklySchedulingSolutionCallback(cp_model.CpSolverSolutionCallback):
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


class WeeklySchedulingSolver:
    """CP-SAT Solver for Weekly Plan Scheduling"""

    def __init__(self, max_time_seconds: int = 60, num_workers: int = 8):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = max_time_seconds
        self.solver.parameters.num_search_workers = num_workers
        self.solver.parameters.log_search_progress = False

        # Variables storage
        self.assignment_vars: Dict[Tuple[str, str], Any] = {}  # (employee_id, week_id) -> BoolVar

    def solve(self, data: Dict) -> Dict:
        """
        Main solve method

        Args:
            data: Dictionary containing:
                - plan: Plan info
                - weeks: List of week objects with minEmployees, maxEmployees
                - employees: List of employee objects with isTrainee flag
                - preferences: List of preferences with employeeId, weekId, preferenceLevel
                - requirements: List of requirements with employeeId, requiredWeeks, assignmentStyle, assignmentStyleConsecutive

        Returns:
            Dictionary with assignments, violations, success flag, and metadata
        """
        start_time = time.time()

        try:
            # Extract data
            weeks = data.get('weeks', [])
            employees = data.get('employees', [])
            preferences = data.get('preferences', [])
            requirements = data.get('requirements', [])

            # Log all employee types for debugging
            emp_types = {}
            for e in employees:
                t = e.get('employeeType', 'unknown')
                emp_types[t] = emp_types.get(t, 0) + 1
            print(f"Employee types distribution: {emp_types}", file=sys.stderr)

            # Filter schedulable employees (personell only, managers handled separately)
            schedulable_employees = [e for e in employees if e.get('employeeType') == 'personell']
            managers = [e for e in employees if e.get('employeeType') == 'manager']

            trainees = [e for e in schedulable_employees if e.get('isTrainee', False)]
            experienced = [e for e in schedulable_employees if not e.get('isTrainee', False)]

            # Build preference lookup
            pref_lookup = {}
            for p in preferences:
                key = (p['employeeId'], p['weekId'])
                pref_lookup[key] = p['preferenceLevel']

            # Build requirement lookup
            req_lookup = {}
            for r in requirements:
                req_lookup[r['employeeId']] = r

            print(f"\n=== WEEKLY SCHEDULING SOLVER ===", file=sys.stderr)
            print(f"Weeks: {len(weeks)}", file=sys.stderr)
            print(f"Schedulable employees: {len(schedulable_employees)}", file=sys.stderr)
            print(f"  - Trainees: {len(trainees)}", file=sys.stderr)
            print(f"  - Experienced: {len(experienced)}", file=sys.stderr)
            print(f"  - Managers (auto-assign): {len(managers)}", file=sys.stderr)
            print(f"Preferences: {len(preferences)}", file=sys.stderr)
            print(f"Requirements: {len(requirements)}", file=sys.stderr)

            # Feasibility check: total required weeks vs available slots
            total_required = 0
            for emp in schedulable_employees:
                req = req_lookup.get(emp['id'])
                if req:
                    total_required += req.get('requiredWeeks', 0)

            total_min_slots = sum(w.get('minEmployees', 2) for w in weeks)
            total_max_slots = sum(w.get('maxEmployees', 3) for w in weeks)

            print(f"\n=== FEASIBILITY CHECK ===", file=sys.stderr)
            print(f"Total required weeks (schedulable employees): {total_required}", file=sys.stderr)
            print(f"Total min slots (sum of minEmployees): {total_min_slots}", file=sys.stderr)
            print(f"Total max slots (sum of maxEmployees): {total_max_slots}", file=sys.stderr)

            if total_required > total_max_slots:
                print(f"WARNING: INFEASIBLE! Employees require {total_required} week-slots but only {total_max_slots} available!", file=sys.stderr)
            elif total_required < total_min_slots:
                print(f"WARNING: INFEASIBLE! Employees require {total_required} week-slots but minimum needed is {total_min_slots}!", file=sys.stderr)
            else:
                print(f"Feasibility OK: {total_min_slots} <= {total_required} <= {total_max_slots}", file=sys.stderr)

            # Sort weeks by weekNumber for consecutive constraint logic
            weeks_sorted = sorted(weeks, key=lambda w: w.get('weekNumber', 0))
            week_ids_ordered = [w['id'] for w in weeks_sorted]
            week_index = {w['id']: i for i, w in enumerate(weeks_sorted)}

            # 1. Create assignment variables
            print(f"\nCreating variables...", file=sys.stderr)
            for emp in schedulable_employees:
                for week in weeks:
                    var_name = f"assign_{emp['id']}_{week['id']}"
                    var = self.model.NewBoolVar(var_name)
                    self.assignment_vars[(emp['id'], week['id'])] = var

            print(f"Created {len(self.assignment_vars)} assignment variables", file=sys.stderr)

            # 2. Hard Constraint: Unavailability (preferenceLevel 3)
            unavail_count = 0
            for emp in schedulable_employees:
                for week in weeks:
                    pref_level = pref_lookup.get((emp['id'], week['id']), 3)  # Default to unavailable if no preference

                    if pref_level == 3:
                        var = self.assignment_vars[(emp['id'], week['id'])]
                        self.model.Add(var == 0)
                        unavail_count += 1

            print(f"Added {unavail_count} unavailability constraints", file=sys.stderr)

            # 3. Hard Constraint: Required weeks per employee
            req_count = 0
            print(f"\nEmployee requirements:", file=sys.stderr)
            for emp in schedulable_employees:
                req = req_lookup.get(emp['id'])
                required_weeks = req.get('requiredWeeks', 0) if req else 0

                # Count available weeks for this employee (pref level 1 or 2)
                available_weeks = sum(1 for w in weeks if pref_lookup.get((emp['id'], w['id']), 3) in [1, 2])

                print(f"  {emp['firstname']} {emp['lastname']}: wants {required_weeks} weeks, available for {available_weeks} weeks", file=sys.stderr)

                if required_weeks > available_weeks:
                    print(f"    WARNING: Cannot fulfill! Wants {required_weeks} but only available for {available_weeks} weeks", file=sys.stderr)

                if required_weeks > 0:
                    emp_vars = [self.assignment_vars[(emp['id'], w['id'])] for w in weeks]
                    self.model.Add(sum(emp_vars) == required_weeks)
                    req_count += 1

            print(f"Added {req_count} required weeks constraints", file=sys.stderr)

            # 4. Hard Constraint: Min/Max employees per week
            print(f"\nWeek constraints:", file=sys.stderr)
            for week in weeks:
                week_vars = [self.assignment_vars[(emp['id'], week['id'])] for emp in schedulable_employees]

                min_emp = week.get('minEmployees', 2)
                max_emp = week.get('maxEmployees', 3)

                # Count how many employees are available for this week
                available_count = sum(1 for emp in schedulable_employees if pref_lookup.get((emp['id'], week['id']), 3) in [1, 2])

                print(f"  Week {week.get('weekNumber')}: min={min_emp}, max={max_emp}, available={available_count}", file=sys.stderr)

                if available_count < min_emp:
                    print(f"    WARNING: Only {available_count} available but need minimum {min_emp}!", file=sys.stderr)

                self.model.Add(sum(week_vars) >= min_emp)
                self.model.Add(sum(week_vars) <= max_emp)

            print(f"Added min/max constraints for {len(weeks)} weeks", file=sys.stderr)

            # 5. Hard Constraint: Trainee supervision
            supervision_count = 0
            for trainee in trainees:
                for week in weeks:
                    trainee_var = self.assignment_vars[(trainee['id'], week['id'])]

                    if experienced:
                        # Sum of experienced employees assigned to this week
                        exp_vars = [self.assignment_vars[(exp['id'], week['id'])] for exp in experienced]
                        # If trainee is assigned, at least one experienced must be assigned
                        self.model.Add(trainee_var <= sum(exp_vars))
                        supervision_count += 1
                    else:
                        # No experienced available, trainee cannot be assigned
                        self.model.Add(trainee_var == 0)

            print(f"Added {supervision_count} trainee supervision constraints", file=sys.stderr)

            # 6. Soft Constraints and Objective Function
            objective_terms = []

            # 6a. Preference satisfaction (high priority)
            PREF_WEIGHT = 100  # Weight for preferred weeks
            AVAIL_WEIGHT = 10  # Small weight for available weeks (break ties)

            for emp in schedulable_employees:
                for week in weeks:
                    var = self.assignment_vars[(emp['id'], week['id'])]
                    pref_level = pref_lookup.get((emp['id'], week['id']), 3)

                    if pref_level == 1:  # Preferred
                        objective_terms.append(PREF_WEIGHT * var)
                    elif pref_level == 2:  # Available
                        objective_terms.append(AVAIL_WEIGHT * var)
                    # Level 3 already excluded by hard constraints

            # 6b. Assignment style constraints (consecutive vs scattered vs flexible)
            # 'flexible' = no preference, ignore this constraint
            # 'consecutive' = bonus for back-to-back weeks in blocks
            # 'scattered' = penalty for adjacent week assignments
            CONSECUTIVE_BONUS = 50  # Bonus for consecutive assignments
            SCATTERED_BONUS = 30    # Penalty for adjacent assignments when scattered

            for emp in schedulable_employees:
                req = req_lookup.get(emp['id'])
                if not req:
                    continue

                assignment_style = req.get('assignmentStyle', 'flexible')
                consecutive_size = req.get('assignmentStyleConsecutive', 1)

                # 'flexible' means no constraint - skip this employee
                if assignment_style == 'flexible':
                    continue

                if assignment_style == 'consecutive' and consecutive_size > 1 and len(weeks_sorted) >= consecutive_size:
                    # Create auxiliary variables for consecutive blocks
                    # Reward when assignments form blocks of the desired size
                    for i in range(len(weeks_sorted) - consecutive_size + 1):
                        block_weeks = weeks_sorted[i:i + consecutive_size]
                        block_vars = [self.assignment_vars[(emp['id'], w['id'])] for w in block_weeks]

                        # Create a variable that is 1 if all weeks in block are assigned
                        block_var = self.model.NewBoolVar(f"block_{emp['id']}_{i}")

                        # block_var = 1 iff all block_vars are 1
                        self.model.Add(sum(block_vars) >= consecutive_size).OnlyEnforceIf(block_var)
                        self.model.Add(sum(block_vars) < consecutive_size).OnlyEnforceIf(block_var.Not())

                        # Bonus for forming a complete block
                        objective_terms.append(CONSECUTIVE_BONUS * block_var)

                elif assignment_style == 'scattered':
                    # Penalize consecutive assignments (or bonus for gaps)
                    # For each pair of adjacent weeks, penalize if both are assigned
                    for i in range(len(weeks_sorted) - 1):
                        week1 = weeks_sorted[i]
                        week2 = weeks_sorted[i + 1]

                        var1 = self.assignment_vars[(emp['id'], week1['id'])]
                        var2 = self.assignment_vars[(emp['id'], week2['id'])]

                        # Create auxiliary variable for "both assigned"
                        both_assigned = self.model.NewBoolVar(f"both_{emp['id']}_{i}")
                        self.model.AddBoolAnd([var1, var2]).OnlyEnforceIf(both_assigned)
                        self.model.AddBoolOr([var1.Not(), var2.Not()]).OnlyEnforceIf(both_assigned.Not())

                        # Penalty for consecutive (negative contribution)
                        objective_terms.append(-SCATTERED_BONUS * both_assigned)

            # Set objective: maximize
            if objective_terms:
                self.model.Maximize(sum(objective_terms))
                print(f"Objective function set with {len(objective_terms)} terms", file=sys.stderr)

            # Solve
            print(f"\nStarting solver...", file=sys.stderr)
            callback = WeeklySchedulingSolutionCallback()
            status = self.solver.Solve(self.model, callback)

            solve_time = time.time() - start_time
            print(f"Solver finished in {solve_time:.2f}s with status: {self._status_string(status)}", file=sys.stderr)

            # Extract solution
            assignments = []
            violations = []

            if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                # Extract assignments for schedulable employees
                for emp in schedulable_employees:
                    for week in weeks:
                        var = self.assignment_vars[(emp['id'], week['id'])]
                        if self.solver.Value(var) == 1:
                            assignments.append({
                                'weekId': week['id'],
                                'employeeId': emp['id']
                            })

                # Add manager assignments based on preference = 1
                for manager in managers:
                    for week in weeks:
                        pref_level = pref_lookup.get((manager['id'], week['id']), 3)
                        if pref_level == 1:  # Preferred
                            assignments.append({
                                'weekId': week['id'],
                                'employeeId': manager['id']
                            })
                            print(f"  Manager {manager['firstname']} {manager['lastname']} auto-assigned to week {week.get('weekNumber')}", file=sys.stderr)

                print(f"\nTotal assignments: {len(assignments)}", file=sys.stderr)

                # Validate and detect violations
                violations = self._detect_violations(
                    assignments, employees, weeks, requirements, pref_lookup
                )

            else:
                violations.append(f"SOLVER_FAILED: No feasible solution found (status: {self._status_string(status)})")

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

    def _detect_violations(
        self,
        assignments: List[Dict],
        employees: List[Dict],
        weeks: List[Dict],
        requirements: List[Dict],
        pref_lookup: Dict
    ) -> List[str]:
        """Detect any constraint violations in the solution"""
        violations = []

        emp_lookup = {e['id']: e for e in employees}
        week_lookup = {w['id']: w for w in weeks}
        req_lookup = {r['employeeId']: r for r in requirements}

        # Check min/max employees per week
        for week in weeks:
            week_assignments = [a for a in assignments if a['weekId'] == week['id']]
            count = len(week_assignments)

            if count < week.get('minEmployees', 2):
                violations.append(f"UNDERSTAFFED: Week {week.get('weekNumber')} has {count} employees but requires minimum {week.get('minEmployees')}")

            if count > week.get('maxEmployees', 3):
                violations.append(f"OVERSTAFFED: Week {week.get('weekNumber')} has {count} employees but maximum is {week.get('maxEmployees')}")

        # Check trainee supervision
        for week in weeks:
            week_assignments = [a for a in assignments if a['weekId'] == week['id']]

            has_trainee = any(
                emp_lookup.get(a['employeeId'], {}).get('isTrainee', False)
                for a in week_assignments
            )

            has_experienced = any(
                not emp_lookup.get(a['employeeId'], {}).get('isTrainee', False)
                and emp_lookup.get(a['employeeId'], {}).get('employeeType') == 'personell'
                for a in week_assignments
            )

            if has_trainee and not has_experienced:
                violations.append(f"TRAINEE_UNSUPERVISED: Week {week.get('weekNumber')} has trainee but no experienced employee")

        # Check required weeks per employee
        for emp in employees:
            req = req_lookup.get(emp['id'])
            if req and req.get('requiredWeeks', 0) > 0:
                assigned_count = len([a for a in assignments if a['employeeId'] == emp['id']])
                required = req['requiredWeeks']

                if assigned_count != required:
                    violations.append(f"WEEK_COUNT_MISMATCH: {emp.get('firstname')} {emp.get('lastname')} assigned {assigned_count} weeks but requires {required}")

        # Check unavailability violations
        for assignment in assignments:
            pref_level = pref_lookup.get((assignment['employeeId'], assignment['weekId']), 3)
            if pref_level == 3:
                emp = emp_lookup.get(assignment['employeeId'], {})
                week = week_lookup.get(assignment['weekId'], {})
                violations.append(f"UNAVAILABLE_ASSIGNED: {emp.get('firstname')} {emp.get('lastname')} assigned to week {week.get('weekNumber')} but marked unavailable")

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
        max_time = solver_options.get('maxTimeInSeconds', 60)
        num_workers = solver_options.get('numSearchWorkers', 8)

        # Create solver and solve
        solver = WeeklySchedulingSolver(
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
