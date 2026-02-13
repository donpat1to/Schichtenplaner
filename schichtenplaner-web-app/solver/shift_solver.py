#!/usr/bin/env python3
"""
Shift Scheduling CP-SAT Solver

Reads JSON input from stdin, solves the shift assignment problem,
and outputs JSON result to stdout.
"""

import json
import sys
from ortools.sat.python import cp_model


def solve_shift_schedule(data):
    """
    Solve the shift scheduling problem using CP-SAT.

    Args:
        data: Dictionary containing plan, employees, shifts, and availabilities

    Returns:
        Dictionary with success status, assignments, violations, and metadata
    """
    model = cp_model.CpModel()

    # Extract data
    employees = data.get('employees', [])
    shifts = data.get('shifts', [])
    availabilities = data.get('availabilities', [])
    solver_options = data.get('solverOptions', {})

    # Build lookup maps
    emp_by_id = {e['id']: e for e in employees}
    shift_by_id = {s['id']: s for s in shifts}

    # Availability map: (employee_id, shift_id) -> preference_level
    avail_map = {}
    for a in availabilities:
        avail_map[(a['employeeId'], a['shiftId'])] = a['preferenceLevel']

    # Filter schedulable employees (personell and apprentice, not managers)
    schedulable = [e for e in employees if e['employeeType'] in ('personell', 'apprentice')]

    # Create decision variables: x[emp_id, shift_id] = 1 if assigned
    x = {}
    for emp in schedulable:
        for shift in shifts:
            pref = avail_map.get((emp['id'], shift['id']), 2)
            # Skip unavailable (pref = 3)
            if pref != 3:
                x[(emp['id'], shift['id'])] = model.NewBoolVar(f"x_{emp['id']}_{shift['id']}")

    # Group shifts by day
    shifts_by_day = {}
    for shift in shifts:
        day = shift['dayOfWeek']
        if day not in shifts_by_day:
            shifts_by_day[day] = []
        shifts_by_day[day].append(shift)

    # HARD CONSTRAINT: Max 1 shift per day per employee
    for emp in schedulable:
        for day, day_shifts in shifts_by_day.items():
            day_vars = [x[(emp['id'], s['id'])] for s in day_shifts
                        if (emp['id'], s['id']) in x]
            if day_vars:
                model.Add(sum(day_vars) <= 1)

    # HARD CONSTRAINT: Min/Max staffing per shift
    for shift in shifts:
        shift_vars = [x[(emp['id'], shift['id'])] for emp in schedulable
                      if (emp['id'], shift['id']) in x]
        if shift_vars:
            model.Add(sum(shift_vars) >= shift['minEmployees'])
            model.Add(sum(shift_vars) <= shift['maxEmployees'])

    # HARD CONSTRAINT: Contract requirements
    for emp in schedulable:
        emp_vars = [x[(emp['id'], s['id'])] for s in shifts
                    if (emp['id'], s['id']) in x]
        if emp_vars:
            contract = emp.get('contractType', 'flexible')
            if contract == 'small':
                model.Add(sum(emp_vars) == 1)
            elif contract == 'large':
                model.Add(sum(emp_vars) == 2)

    # HARD CONSTRAINT: Trainee supervision
    trainees = [e for e in schedulable if e.get('isTrainee', False)]
    experienced = [e for e in schedulable if not e.get('isTrainee', False)]

    for shift in shifts:
        trainee_vars = [x[(t['id'], shift['id'])] for t in trainees
                        if (t['id'], shift['id']) in x]
        exp_vars = [x[(e['id'], shift['id'])] for e in experienced
                    if (e['id'], shift['id']) in x]

        if trainee_vars and exp_vars:
            # If any trainee assigned, at least one experienced must be assigned
            trainee_sum = sum(trainee_vars)
            exp_sum = sum(exp_vars)
            # trainee_sum <= M * (exp_sum >= 1) simplified to trainee_sum <= exp_sum * M
            model.Add(trainee_sum <= len(trainees) * exp_sum)

    # HARD CONSTRAINT: Cannot work alone
    for shift in shifts:
        shift_vars = [(emp['id'], x[(emp['id'], shift['id'])])
                      for emp in schedulable if (emp['id'], shift['id']) in x]

        for emp in schedulable:
            if not emp.get('canWorkAlone', True) and (emp['id'], shift['id']) in x:
                # If this employee is assigned, at least one other must be too
                emp_var = x[(emp['id'], shift['id'])]
                other_vars = [v for eid, v in shift_vars if eid != emp['id']]
                if other_vars:
                    model.Add(emp_var <= sum(other_vars))

    # OBJECTIVE: Maximize preference satisfaction
    objective_terms = []
    for emp in schedulable:
        for shift in shifts:
            if (emp['id'], shift['id']) in x:
                var = x[(emp['id'], shift['id'])]
                pref = avail_map.get((emp['id'], shift['id']), 2)
                if pref == 1:
                    objective_terms.append(100 * var)  # Preferred
                elif pref == 2:
                    objective_terms.append(50 * var)   # Available

    if objective_terms:
        model.Maximize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = solver_options.get('maxTimeInSeconds', 60)
    solver.parameters.num_search_workers = solver_options.get('numSearchWorkers', 4)

    status = solver.Solve(model)

    # Process result
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for (emp_id, shift_id), var in x.items():
            if solver.Value(var) == 1:
                assignments.append({
                    'employeeId': emp_id,
                    'shiftId': shift_id
                })

        # Add manager assignments (managers with preference 1 are auto-added)
        managers = [e for e in employees if e['employeeType'] == 'manager']
        for manager in managers:
            for shift in shifts:
                pref = avail_map.get((manager['id'], shift['id']), 2)
                if pref == 1:
                    assignments.append({
                        'employeeId': manager['id'],
                        'shiftId': shift['id']
                    })

        return {
            'success': True,
            'assignments': assignments,
            'violations': [],
            'metadata': {
                'status': 'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE',
                'objective': solver.ObjectiveValue() if objective_terms else 0
            }
        }
    else:
        status_name = {
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'MODEL_INVALID',
            cp_model.UNKNOWN: 'UNKNOWN'
        }.get(status, 'ERROR')

        return {
            'success': False,
            'assignments': [],
            'violations': [f'Solver status: {status_name}'],
            'metadata': {'status': status_name}
        }


def main():
    try:
        # Read JSON from stdin
        input_data = json.loads(sys.stdin.read())

        # Solve
        result = solve_shift_schedule(input_data)

        # Output JSON to stdout
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'assignments': [],
            'violations': [f'JSON parse error: {str(e)}'],
            'metadata': {'status': 'ERROR'}
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'assignments': [],
            'violations': [f'Solver error: {str(e)}'],
            'metadata': {'status': 'ERROR'}
        }))


if __name__ == '__main__':
    main()
