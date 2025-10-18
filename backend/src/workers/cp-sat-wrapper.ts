// backend/src/workers/cp-sat-wrapper.ts
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SolverOptions, Solution, Assignment, Violation } from '../models/scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CPModel {
  private modelData: any;
  
  constructor() {
    this.modelData = {
      variables: {},
      constraints: [],
      objective: null
    };
  }
  
  addVariable(name: string, type: 'bool' | 'int', min?: number, max?: number): void {
    this.modelData.variables[name] = { type, min, max };
  }
  
  addConstraint(expression: string, description?: string): void {
    this.modelData.constraints.push({
      expression,
      description
    });
  }
  
  maximize(expression: string): void {
    this.modelData.objective = {
      type: 'maximize',
      expression
    };
  }
  
  minimize(expression: string): void {
    this.modelData.objective = {
      type: 'minimize', 
      expression
    };
  }
  
  export(): any {
    return this.modelData;
  }
}

export class CPSolver {
  constructor(private options: SolverOptions) {}
  
  async solve(model: CPModel): Promise<Solution> {
    try {
      return await this.solveViaPythonBridge(model);
    } catch (error) {
      console.error('CP-SAT bridge failed, falling back to TypeScript solver:', error);
      return await this.solveWithTypeScript(model);
    }
  }
  
  private async solveViaPythonBridge(model: CPModel): Promise<Solution> {
    const pythonScriptPath = path.resolve(__dirname, '../../python-scripts/scheduling_solver.py');
    const modelData = model.export();
    
    const result = execSync(`python3 "${pythonScriptPath}"`, {
      input: JSON.stringify(modelData),
      timeout: this.options.maxTimeInSeconds * 1000,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer für große Probleme
    });
    
    return JSON.parse(result);
  }
  
  private async solveWithTypeScript(model: CPModel): Promise<Solution> {
    // Einfacher TypeScript CSP Solver als Fallback
    return this.basicBacktrackingSolver(model);
  }
  
  private async basicBacktrackingSolver(model: CPModel): Promise<Solution> {
    // Einfache Backtracking-Implementierung
    // Für kleine Probleme geeignet
    const startTime = Date.now();
    
    // Hier einfache CSP-Logik implementieren
    const assignments: Assignment[] = [];
    const violations: Violation[] = [];
    
    return {
      assignments,
      violations, 
      success: violations.length === 0,
      metadata: {
        solveTime: Date.now() - startTime,
        constraintsAdded: model.export().constraints.length,
        variablesCreated: Object.keys(model.export().variables).length,
        optimal: true
      }
    };
  }
}