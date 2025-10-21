# backend/python-scripts/scheduling_solver.py
from ortools.sat.python import cp_model
import json
import sys
import re
import os
import logging
import time
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProductionProgressManager:
    def __init__(self, script_dir, max_files=1000, retention_days=7):
        self.script_dir = Path(script_dir)
        self.progress_dir = self.script_dir / "progress_data"
        self.max_files = max_files
        self.retention_days = retention_days
        self._ensure_directory()
        self._cleanup_old_files()
    
    def _ensure_directory(self):
        """Create progress directory if it doesn't exist"""
        try:
            self.progress_dir.mkdir(exist_ok=True)
            # Set secure permissions (read/write for owner only)
            self.progress_dir.chmod(0o700)
        except Exception as e:
            logger.warning(f"Could not create progress directory: {e}")
    
    def _cleanup_old_files(self):
        """Remove old progress files based on retention policy"""
        try:
            cutoff_time = datetime.now() - timedelta(days=self.retention_days)
            files = list(self.progress_dir.glob("run_*.json"))
            
            # Sort by modification time and remove oldest if over limit
            if len(files) > self.max_files:
                files.sort(key=lambda x: x.stat().st_mtime)
                for file_to_delete in files[:len(files) - self.max_files]:
                    file_to_delete.unlink()
                    logger.info(f"Cleaned up old progress file: {file_to_delete}")
            
            # Remove files older than retention period
            for file_path in files:
                if datetime.fromtimestamp(file_path.stat().st_mtime) < cutoff_time:
                    file_path.unlink()
                    logger.info(f"Removed expired progress file: {file_path}")
                    
        except Exception as e:
            logger.warning(f"Progress cleanup failed: {e}")
    
    def save_progress(self, result, progress_data):
        """Safely save progress data with production considerations"""
        try:
            # Check disk space before writing (min 100MB free)
            if not self._check_disk_space():
                logger.warning("Insufficient disk space, skipping progress save")
                return None
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            success_status = "success" if result.get('success', False) else "failure"
            filename = f"run_{timestamp}_{success_status}.json"
            filepath = self.progress_dir / filename
            
            # Prepare safe data (exclude sensitive information)
            safe_data = {
                'timestamp': datetime.now().isoformat(),
                'success': result.get('success', False),
                'metadata': result.get('metadata', {}),
                'progress': progress_data,
                'solution_summary': {
                    'assignments_count': len(result.get('assignments', [])),
                    'violations_count': len(result.get('violations', [])),
                    'variables_count': result.get('metadata', {}).get('variablesCreated', 0),
                    'constraints_count': result.get('metadata', {}).get('constraintsAdded', 0),
                    'solve_time': result.get('metadata', {}).get('solveTime', 0),
                    'optimal': result.get('metadata', {}).get('optimal', False)
                }
                # ❌ REMOVED: 'full_result' containing potentially sensitive data
            }
            
            # Atomic write with temporary file
            temp_filepath = filepath.with_suffix('.tmp')
            with open(temp_filepath, 'w', encoding='utf-8') as f:
                json.dump(safe_data, f, indent=2, ensure_ascii=False)
            
            # Atomic rename
            temp_filepath.rename(filepath)
            # Set secure file permissions
            filepath.chmod(0o600)
            
            logger.info(f"Progress data saved: {filename}")
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Failed to save progress data: {e}")
            return None
    
    def _check_disk_space(self, min_free_mb=100):
        """Check if there's sufficient disk space"""
        try:
            stat = os.statvfs(self.progress_dir)
            free_mb = (stat.f_bavail * stat.f_frsize) / (1024 * 1024)
            return free_mb >= min_free_mb
        except:
            return True  # Continue if we can't check disk space

class SimpleSolutionCallback(cp_model.CpSolverSolutionCallback):
    """A simplified callback that only counts solutions"""
    def __init__(self):
        cp_model.CpSolverSolutionCallback.__init__(self)
        self.__solution_count = 0
        self.start_time = time.time()
        self.solutions = []

    def on_solution_callback(self):
        current_time = time.time() - self.start_time
        self.__solution_count += 1
        
        # Try to get objective value safely
        try:
            objective_value = self.ObjectiveValue()
        except:
            objective_value = 0
            
        # Try to get bound safely  
        try:
            best_bound = self.BestObjectiveBound()
        except:
            best_bound = 0

        solution_info = {
            'timestamp': current_time,
            'objective': objective_value,
            'bound': best_bound,
            'solution_count': self.__solution_count
        }
        
        self.solutions.append(solution_info)
        print(f"Progress: Solution {self.__solution_count}, Objective: {objective_value}, Time: {current_time:.2f}s", file=sys.stderr)

    def solution_count(self):
        return self.__solution_count


class UniversalSchedulingSolver:
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = 30
        self.solver.parameters.num_search_workers = 8
        self.solver.parameters.log_search_progress = False
        
        # 🆕 Initialize production-safe progress manager
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.progress_manager = ProductionProgressManager(
            script_dir=script_dir,
            max_files=1000,  # Keep last 1000 runs
            retention_days=7  # Keep files for 7 days
        )
    
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
            
            # Solve with callback
            callback = SimpleSolutionCallback()
            status = self.solver.SolveWithSolutionCallback(self.model, callback)
            
            result = self._format_solution(status, cp_vars, model_data)
            result['metadata']['constraintsAdded'] = constraints_added
            
            # 🆕 Production-safe progress saving
            if callback.solutions:
                result['progress'] = callback.solutions
                self.progress_manager.save_progress(result, callback.solutions)
            else:
                result['progress'] = []
                self.progress_manager.save_progress(result, [])
            
            return result
            
        except Exception as e:
            error_result = self._error_result(str(e))
            self.progress_manager.save_progress(error_result, [])
            return error_result
    
    def _save_progress_data(self, result, progress_data):
        """Save progress data to file in the same directory as this script"""
        try:
            # Get current script directory
            script_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Create filename with timestamp and success status
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            success_status = "success" if result.get('success', False) else "failure"
            filename = f"run_{timestamp}_{success_status}.json"
            filepath = os.path.join(script_dir, filename)
            
            # Prepare data to save
            data_to_save = {
                'timestamp': datetime.now().isoformat(),
                'success': result.get('success', False),
                'metadata': result.get('metadata', {}),
                'progress': progress_data,
                'solution_summary': {
                    'assignments_count': len(result.get('assignments', [])),
                    'violations_count': len(result.get('violations', [])),
                    'variables_count': result.get('metadata', {}).get('variablesCreated', 0),
                    'constraints_count': result.get('metadata', {}).get('constraintsAdded', 0),
                    'solve_time': result.get('metadata', {}).get('solveTime', 0),
                    'optimal': result.get('metadata', {}).get('optimal', False)
                }
            }
            
            # Write to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data_to_save, f, indent=2, ensure_ascii=False)
            
            print(f"Progress data saved to: {filepath}", file=sys.stderr)
            
        except Exception as e:
            print(f"Failed to save progress data: {e}", file=sys.stderr)
    
    def _add_constraint(self, expression, cp_vars):
        """Add constraint from expression string with enhanced parsing"""
        try:
            expression = expression.strip()
            
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
                            'assignedAt': datetime.now().isoformat() + 'Z',
                            'score': 100
                        })
            
            print(f"Debug: Found {len(assignments)} assignments", file=sys.stderr)
        else:
            print(f"Debug: Solver failed with status {status}", file=sys.stderr)

        success = (status == cp_model.OPTIMAL or status == cp_model.FEASIBLE)
        
        return {
            'assignments': assignments,
            'violations': [],
            'success': success,
            'variables': variables,
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
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'MODEL_INVALID',
            cp_model.UNKNOWN: 'UNKNOWN'
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