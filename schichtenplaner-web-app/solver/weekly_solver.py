#!/usr/bin/env python3
"""
Weekly Scheduling CP-SAT Solver

Reads JSON input from stdin, solves the weekly assignment problem,
and outputs JSON result to stdout.
"""

import json
import sys
from ortools.sat.python import cp_model


def solve_weekly_schedule(data):
    """
    Solve the weekly scheduling problem using CP-SAT.

    Args:
        data: Dictionary containing plan, weeks, employees, requirements, and preferences

    Returns:
        Dictionary with success status, assignments, violations, and metadata
    """
    model = cp_model.CpModel()

    # Extract data
    weeks = data.get('weeks', [])
    employees = data.get('employees', [])
    requirements = data.get('requirements', [])
    preferences = data.get('preferences', [])
    solver_options = data.get('solverOptions', {})

    # Build lookup maps
    emp_by_id = {e['id']: e for e in employees}
    week_by_id = {w['id']: w for w in weeks}

    # Requirements map: employee_id -> requirement
    req_map = {r['employeeId']: r for r in requirements}

    # Preferences map: (employee_id, week_id) -> preference_level
    pref_map = {}
    for p in preferences:
        pref_map[(p['employeeId'], p['weekId'])] = p['preferenceLevel']

    # Filter schedulable employees
    schedulable = [e for e in employees if e['employeeType'] in ('personell', 'apprentice')]

    # Sort weeks by week number for consecutive constraint
    weeks_sorted = sorted(weeks, key=lambda w: w['weekNumber'])

    # Create decision variables: assign[emp_id, week_id] = 1 if assigned
    assign = {}
    for emp in schedulable:
        for week in weeks:
            pref = pref_map.get((emp['id'], week['id']), 2)
            # Skip unavailable (pref = 3)
            if pref != 3:
                assign[(emp['id'], week['id'])] = model.NewBoolVar(
                    f"assign_{emp['id']}_{week['id']}"
                )

    # HARD CONSTRAINT: Required weeks per employee
    for emp in schedulable:
        emp_vars = [assign[(emp['id'], w['id'])] for w in weeks
                    if (emp['id'], w['id']) in assign]
        req = req_map.get(emp['id'], {})
        required_weeks = req.get('requiredWeeks', 0)

        if emp_vars and required_weeks > 0:
            model.Add(sum(emp_vars) == required_weeks)

    # HARD CONSTRAINT: Min/Max employees per week
    for week in weeks:
        week_vars = [assign[(emp['id'], week['id'])] for emp in schedulable
                     if (emp['id'], week['id']) in assign]
        if week_vars:
            model.Add(sum(week_vars) >= week['minEmployees'])
            model.Add(sum(week_vars) <= week['maxEmployees'])

    # HARD CONSTRAINT: Trainee supervision
    trainees = [e for e in schedulable if e.get('isTrainee', False)]
    experienced = [e for e in schedulable if not e.get('isTrainee', False)]

    for week in weeks:
        trainee_vars = [assign[(t['id'], week['id'])] for t in trainees
                        if (t['id'], week['id']) in assign]
        exp_vars = [assign[(e['id'], week['id'])] for e in experienced
                    if (e['id'], week['id']) in assign]

        if trainee_vars and exp_vars:
            trainee_sum = sum(trainee_vars)
            exp_sum = sum(exp_vars)
            model.Add(trainee_sum <= len(trainees) * exp_sum)

    # OBJECTIVE TERMS
    objective_terms = []

    # Preference satisfaction
    for emp in schedulable:
        for week in weeks:
            if (emp['id'], week['id']) in assign:
                var = assign[(emp['id'], week['id'])]
                pref = pref_map.get((emp['id'], week['id']), 2)
                if pref == 1:
                    objective_terms.append(100 * var)  # Preferred
                elif pref == 2:
                    objective_terms.append(10 * var)   # Available

    # Assignment style bonuses/penalties
    for emp in schedulable:
        req = req_map.get(emp['id'], {})
        style = req.get('assignmentStyle', 'flexible')
        consecutive_size = req.get('assignmentStyleConsecutive', 2)

        emp_week_vars = [(w['weekNumber'], assign[(emp['id'], w['id'])])
                         for w in weeks_sorted if (emp['id'], w['id']) in assign]

        if style == 'consecutive' and len(emp_week_vars) >= consecutive_size:
            # Bonus for consecutive blocks
            for i in range(len(emp_week_vars) - consecutive_size + 1):
                block_vars = [emp_week_vars[i + j][1] for j in range(consecutive_size)]
                block_complete = model.NewBoolVar(f"block_{emp['id']}_{i}")
                # block_complete = 1 if all vars in block are 1
                model.Add(sum(block_vars) == consecutive_size).OnlyEnforceIf(block_complete)
                model.Add(sum(block_vars) < consecutive_size).OnlyEnforceIf(block_complete.Not())
                objective_terms.append(50 * block_complete)

        elif style == 'scattered' and len(emp_week_vars) >= 2:
            # Penalty for adjacent weeks
            for i in range(len(emp_week_vars) - 1):
                wn1, var1 = emp_week_vars[i]
                wn2, var2 = emp_week_vars[i + 1]
                if wn2 == wn1 + 1:  # Adjacent weeks
                    both = model.NewBoolVar(f"both_{emp['id']}_{i}")
                    model.AddBoolAnd([var1, var2]).OnlyEnforceIf(both)
                    model.AddBoolOr([var1.Not(), var2.Not()]).OnlyEnforceIf(both.Not())
                    objective_terms.append(-30 * both)  # Penalty

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
        for (emp_id, week_id), var in assign.items():
            if solver.Value(var) == 1:
                assignments.append({
                    'employeeId': emp_id,
                    'weekId': week_id
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
        input_data = json.loads(sys.stdin.read())
        result = solve_weekly_schedule(input_data)
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
