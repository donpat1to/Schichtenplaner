# backend/python-scripts/scheduling_solver.py
from ortools.sat.python import cp_model
import json
import sys
import re
from collections import defaultdict

class UniversalSchedulingSolver:
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = 30
        self.solver.parameters.num_search_workers = 8
        self.solver.parameters.log_search_progress = False
    
    def solve_from_model_data(self, model_data):
        """Solve from pre-built model data (variables, constraints, objective)"""
        try:
            variables = model_data.get('variables', {})
            constraints = model_data.get('constraints', [])
            objective = model_data.get('objective', None)
            
            # Create CP-SAT variables
            cp_vars = {}
            for var_name, var_info in variables.items():
                if var_info['type'] == 'bool':
                    cp_vars[var_name] = self.model.NewBoolVar(var_name)
                elif var_info['type'] == 'int':
                    min_val = var_info.get('min', 0)
                    max_val = var_info.get('max', 100)
                    cp_vars[var_name] = self.model.NewIntVar(min_val, max_val, var_name)
            
            # Add constraints
            constraints_added = 0
            for constraint in constraints:
                if self._add_constraint(constraint['expression'], cp_vars):
                    constraints_added += 1
            
            # Set objective
            if objective:
                try:
                    if objective['type'] == 'maximize':
                        self.model.Maximize(self._parse_expression(objective['expression'], cp_vars))
                    else:
                        self.model.Minimize(self._parse_expression(objective['expression'], cp_vars))
                except Exception as e:
                    print(f"Objective parsing failed: {e}", file=sys.stderr)
                    # Add a default objective if main objective fails
                    self.model.Maximize(sum(cp_vars.values()))
            
            # Solve
            status = self.solver.Solve(self.model)
            
            result = self._format_solution(status, cp_vars, model_data)
            result['metadata']['constraintsAdded'] = constraints_added
            return result
            
        except Exception as e:
            return self._error_result(str(e))
    
    def _add_constraint(self, expression, cp_vars):
        """Add constraint from expression string with enhanced parsing"""
        try:
            expression = expression.strip()
            
            # Handle implication constraints (=>)
            if '=>' in expression:
                left, right = expression.split('=>', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                
                # A => B is equivalent to (not A) or B
                # In CP-SAT: AddBoolOr([A.Not(), B])
                if hasattr(left_expr, 'Not') and hasattr(right_expr, 'Index'):
                    self.model.AddImplication(left_expr, right_expr)
                else:
                    # Fallback: treat as linear constraint
                    self.model.Add(left_expr <= right_expr)
                return True
            
            # Handle equality
            if ' == ' in expression:
                left, right = expression.split(' == ', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                self.model.Add(left_expr == right_expr)
                return True
            
            # Handle inequalities
            elif ' <= ' in expression:
                left, right = expression.split(' <= ', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                self.model.Add(left_expr <= right_expr)
                return True
            
            elif ' >= ' in expression:
                left, right = expression.split(' >= ', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                self.model.Add(left_expr >= right_expr)
                return True
            
            elif ' < ' in expression:
                left, right = expression.split(' < ', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                self.model.Add(left_expr < right_expr)
                return True
            
            elif ' > ' in expression:
                left, right = expression.split(' > ', 1)
                left_expr = self._parse_expression(left.strip(), cp_vars)
                right_expr = self._parse_expression(right.strip(), cp_vars)
                self.model.Add(left_expr > right_expr)
                return True
            
            else:
                # Single expression - assume it should be true
                expr = self._parse_expression(expression, cp_vars)
                self.model.Add(expr == 1)
                return True
                
        except Exception as e:
            print(f"Constraint skipped: {expression} - Error: {e}", file=sys.stderr)
            return False
    
    def _parse_expression(self, expr, cp_vars):
        """Enhanced expression parser with better error handling"""
        expr = expr.strip()
        
        # Handle parentheses
        if expr.startswith('(') and expr.endswith(')'):
            return self._parse_expression(expr[1:-1], cp_vars)
        
        # Single variable
        if expr in cp_vars:
            return cp_vars[expr]
        
        # Integer constant
        if expr.isdigit() or (expr.startswith('-') and expr[1:].isdigit()):
            return int(expr)
        
        # Sum of expressions
        if ' + ' in expr:
            parts = [self._parse_expression(p.strip(), cp_vars) for p in expr.split(' + ')]
            return sum(parts)
        
        # Multiplication with coefficient
        multiplication_match = re.match(r'^(-?\d+)\s*\*\s*(\w+)$', expr)
        if multiplication_match:
            coef = int(multiplication_match.group(1))
            var_name = multiplication_match.group(2)
            if var_name in cp_vars:
                return coef * cp_vars[var_name]
        
        # Simple multiplication with *
        if ' * ' in expr:
            parts = expr.split(' * ')
            if len(parts) == 2:
                left = self._parse_expression(parts[0].strip(), cp_vars)
                right = self._parse_expression(parts[1].strip(), cp_vars)
                # For CP-SAT, we can only multiply by constants
                if isinstance(left, int):
                    return left * right
                elif isinstance(right, int):
                    return left * right
        
        # Default: try to evaluate as integer, otherwise return 0
        try:
            return int(expr)
        except:
            # If it's a simple variable name without spaces, create a constant 0
            if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', expr):
                print(f"Warning: Variable {expr} not found, using 0", file=sys.stderr)
            return 0
    
    def _format_solution(self, status, cp_vars, model_data):
        """Format the solution for TypeScript with enhanced debugging"""
        assignments = []
        variables = {}
        
        print(f"Debug: Solver status = {status}", file=sys.stderr)
        print(f"Debug: Number of CP variables = {len(cp_vars)}", file=sys.stderr)
        
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            # Extract ALL variable values for debugging
            for var_name, cp_var in cp_vars.items():
                value = self.solver.Value(cp_var)
                variables[var_name] = value
                
                # Create assignments for true boolean variables
                if value == 1 and var_name.startswith('assign_'):
                    parts = var_name.split('_')
                    if len(parts) >= 3:
                        employee_id = parts[1]
                        shift_id = '_'.join(parts[2:])
                        assignments.append({
                            'shiftId': shift_id,
                            'employeeId': employee_id,
                            'assignedAt': '2024-01-01T00:00:00Z',
                            'score': 100
                        })
            
            print(f"Debug: Found {len(assignments)} assignments", file=sys.stderr)
            print(f"Debug: First 5 assignments: {assignments[:5]}", file=sys.stderr)
        else:
            print(f"Debug: Solver failed with status {status}", file=sys.stderr)

        success = (status == cp_model.OPTIMAL or status == cp_model.FEASIBLE)
        
        return {
            'assignments': assignments,
            'violations': [],
            'success': success,
            'variables': variables,  # Include ALL variables for debugging
            'metadata': {
                'solveTime': self.solver.WallTime(),
                'constraintsAdded': len(model_data.get('constraints', [])),
                'variablesCreated': len(cp_vars),
                'optimal': (status == cp_model.OPTIMAL)
            }
        }
    
    def _status_string(self, status):
        """Convert status code to string"""
        status_map = {
            cp_model.OPTIMAL: 'OPTIMAL',
            cp_model.FEASIBLE: 'FEASIBLE',
            cp_MODEL.INFEASIBLE: 'INFEASIBLE',
            cp_MODEL.MODEL_INVALID: 'MODEL_INVALID',
            cp_MODEL.UNKNOWN: 'UNKNOWN'
        }
        return status_map.get(status, f'UNKNOWN_STATUS_{status}')
    
    def _error_result(self, error_msg):
        """Return error result"""
        return {
            'assignments': [],
            'violations': [f'Error: {error_msg}'],
            'success': False,
            'metadata': {
                'solveTime': 0,
                'constraintsAdded': 0,
                'variablesCreated': 0,
                'optimal': False
            }
        }



# Main execution
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise ValueError("No input data provided")
        
        data = json.loads(input_data)
        
        solver = UniversalSchedulingSolver()
        
        # Check if we have model data or raw scheduling data
        if 'modelData' in data:
            # Use the model data approach
            result = solver.solve_from_model_data(data['modelData'])
        else:
            # This script doesn't handle raw scheduling data directly
            result = {
                'assignments': [],
                'violations': ['Error: This solver only supports model data input'],
                'success': False,
                'metadata': {
                    'solveTime': 0,
                    'constraintsAdded': 0,
                    'variablesCreated': 0,
                    'optimal': False
                }
            }
        
        # Output ONLY JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'assignments': [],
            'violations': [f'Error: {str(e)}'],
            'success': False,
            'metadata': {
                'solveTime': 0,
                'constraintsAdded': 0,
                'variablesCreated': 0,
                'optimal': False
            }
        }
        print(json.dumps(error_result))
        sys.exit(1)