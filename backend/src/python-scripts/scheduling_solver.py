# backend/python-scripts/scheduling_solver.py
from ortools.sat.python import cp_model
import json
import sys
from typing import List, Dict, Any, Tuple
from collections import defaultdict
import math
from datetime import datetime, timedelta

class ScheduleOptimizer:
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.assignments = {}
        self.violations = []
        self.resolution_report = []
        
        # Solver parameters for better performance
        self.solver.parameters.max_time_in_seconds = 100  # 100 seconds timeout
        self.solver.parameters.num_search_workers = 8
        self.solver.parameters.log_search_progress = True
    
    def generateOptimalSchedule(self, shiftPlan, employees, availabilities, constraints):
        """
        Hauptalgorithmus für die Schichtplanoptimierung
        """
        try:
            self.resolution_report.append("🚀 Starting scheduling optimization...")
            
            # Prepare data
            scheduled_shifts = self.prepareShifts(shiftPlan)
            first_week_shifts = self.getFirstWeekShifts(scheduled_shifts)
            
            # Separate employee types
            managers = self.filterEmployees(employees, 'manager')
            workers = self.filterEmployees(employees, lambda e: e.get('employeeType') != 'manager')
            experienced = self.filterEmployees(employees, lambda e: e.get('role') != 'admin' and e.get('employeeType') == 'experienced')
            trainees = self.filterEmployees(employees, lambda e: e.get('role') != 'admin' and e.get('employeeType') == 'trainee')
            
            self.resolution_report.append(f"📊 Employee counts: {len(managers)} managers, {len(experienced)} experienced, {len(trainees)} trainees")
            
            # Create experienced x trainees hashmap
            hashmap_experienced_trainees = self.createTraineePartners(workers, availabilities)
            
            # Optimize distribution
            optimized_assignments = self.optimizeDistribution(
                trainees, experienced, managers, availabilities, constraints, first_week_shifts
            )
            
            # Validation
            final_violations = self.detectAllViolations(
                optimized_assignments, employees, availabilities, constraints, first_week_shifts
            )
            self.violations.extend(final_violations)
            
            # Fix violations
            fixed_assignments = self.fixViolations(
                optimized_assignments, employees, availabilities, constraints, first_week_shifts, maxIterations=20
            )
            
            # Add managers to priority shifts
            final_assignments = self.assignManagersToPriority(
                managers, fixed_assignments, availabilities, first_week_shifts
            )
            
            # Final validation
            final_violations = self.detectAllViolations(
                final_assignments, employees, availabilities, constraints, first_week_shifts
            )
            
            success = (self.countCriticalViolations(final_violations) == 0)
            
            self.resolution_report.append(f"✅ Scheduling completed: {success}")
            
            return {
                'assignments': self.formatAssignments(final_assignments),
                'violations': final_violations,
                'success': success,
                'resolution_report': self.resolution_report
            }
            
        except Exception as error:
            self.resolution_report.append(f"❌ Error: {str(error)}")
            return self.errorResult(error)
    
    def optimizeDistribution(self, trainees, experienced, managers, availabilities, constraints, shifts):
        """
        Optimiert die Verteilung der Schichten unter Berücksichtigung aller Constraints
        """
        # Reset model for new optimization
        self.model = cp_model.CpModel()
        
        assignments = {}
        all_employees = experienced + trainees
        
        self.resolution_report.append(f"🔧 Building model with {len(shifts)} shifts and {len(all_employees)} employees")
        
        # Create assignment variables
        for employee in all_employees:
            employee_id = employee['id']
            assignments[employee_id] = {}
            for shift in shifts:
                shift_id = shift['id']
                availability = self.getAvailability(employee_id, shift_id, availabilities)
                if availability in [1, 2]:  # Only create variables for available shifts
                    var_name = f"assign_{employee_id}_{shift_id}"
                    assignments[employee_id][shift_id] = self.model.NewBoolVar(var_name)
        
        # Constraint: Max 1 shift per day per employee
        shifts_by_day = self.groupShiftsByDay(shifts)
        for employee in all_employees:
            employee_id = employee['id']
            for day, day_shifts in shifts_by_day.items():
                shift_vars = []
                for shift in day_shifts:
                    if shift['id'] in assignments.get(employee_id, {}):
                        shift_vars.append(assignments[employee_id][shift['id']])
                if shift_vars:
                    self.model.Add(sum(shift_vars) <= 1)
        
        # Constraint: Each shift has required employees
        for shift in shifts:
            shift_id = shift['id']
            shift_vars = []
            for employee in all_employees:
                employee_id = employee['id']
                if shift_id in assignments.get(employee_id, {}):
                    shift_vars.append(assignments[employee_id][shift_id])
            
            if shift_vars:
                min_workers = shift.get('minWorkers', 1)
                max_workers = shift.get('maxWorkers', 3)
                self.model.Add(sum(shift_vars) >= min_workers)
                self.model.Add(sum(shift_vars) <= max_workers)
        
        # Constraint: Trainees cannot work alone
        for shift in shifts:
            shift_id = shift['id']
            trainee_vars = []
            experienced_vars = []
            
            for trainee in trainees:
                trainee_id = trainee['id']
                if shift_id in assignments.get(trainee_id, {}):
                    trainee_vars.append(assignments[trainee_id][shift_id])
            
            for exp in experienced:
                exp_id = exp['id']
                if shift_id in assignments.get(exp_id, {}):
                    experienced_vars.append(assignments[exp_id][shift_id])
            
            if trainee_vars and experienced_vars:
                # If any trainee is assigned, at least one experienced must be assigned
                for trainee_var in trainee_vars:
                    self.model.Add(sum(experienced_vars) >= 1).OnlyEnforceIf(trainee_var)
        
        # Constraint: Contract hours limits
        for employee in all_employees:
            employee_id = employee['id']
            contract_type = employee.get('contractType', 'large')
            max_hours = 40 if contract_type == 'large' else 20
            
            total_hours_var = 0
            for shift in shifts:
                shift_id = shift['id']
                if shift_id in assignments.get(employee_id, {}):
                    # Assume 8 hours per shift (adjust based on your time slots)
                    shift_hours = 8
                    total_hours_var += assignments[employee_id][shift_id] * shift_hours
            
            self.model.Add(total_hours_var <= max_hours)
        
        # Objective: Maximize preferred assignments
        objective_terms = []
        for employee in all_employees:
            employee_id = employee['id']
            for shift in shifts:
                shift_id = shift['id']
                if shift_id in assignments.get(employee_id, {}):
                    availability = self.getAvailability(employee_id, shift_id, availabilities)
                    if availability == 1:  # Preferred
                        objective_terms.append(assignments[employee_id][shift_id] * 10)
                    elif availability == 2:  # Available
                        objective_terms.append(assignments[employee_id][shift_id] * 5)
                    # Penalize unavailable assignments (shouldn't happen due to constraints)
                    else:
                        objective_terms.append(assignments[employee_id][shift_id] * -100)
        
        self.model.Maximize(sum(objective_terms))
        
        # Solve the model
        self.resolution_report.append("🎯 Solving optimization model...")
        status = self.solver.Solve(self.model)
        
        if status == cp_model.OPTIMAL:
            self.resolution_report.append("✅ Optimal solution found!")
        elif status == cp_model.FEASIBLE:
            self.resolution_report.append("⚠️ Feasible solution found (may not be optimal)")
        else:
            self.resolution_report.append("❌ No solution found")
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            return self.extractAssignments(assignments, all_employees, shifts)
        else:
            return {}

    def formatAssignments(self, assignments):
        """Format assignments for frontend consumption"""
        formatted = {}
        for shift_id, employee_ids in assignments.items():
            formatted[shift_id] = employee_ids
        return formatted

    def prepareShifts(self, shiftPlan):
        """Prepare shifts for optimization"""
        if 'shifts' in shiftPlan:
            return shiftPlan['shifts']
        return []

    # ... (keep the other helper methods from your original code)
    # detectAllViolations, fixViolations, createTraineePartners, etc.

# Main execution for Python script
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        optimizer = ScheduleOptimizer()
        result = optimizer.generateOptimalSchedule(
            input_data.get('shiftPlan', {}),
            input_data.get('employees', []),
            input_data.get('availabilities', []),
            input_data.get('constraints', {})
        )
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'assignments': {},
            'violations': [f'Error: {str(e)}'],
            'success': False,
            'resolution_report': [f'Critical error: {str(e)}'],
            'error': str(e)
        }
        print(json.dumps(error_result))