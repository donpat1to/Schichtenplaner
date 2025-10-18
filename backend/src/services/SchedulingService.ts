// src/services/schedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { Employee, ShiftPlan } from '../models/Employee.js';

export interface ScheduleRequest {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
}

export interface ScheduleResult {
  assignments: Assignment[];
  violations: Violation[];
  success: boolean;
  resolutionReport: string[];
  processingTime: number;
}

export class SchedulingService {
  async generateOptimalSchedule(request: ScheduleRequest): Promise<ScheduleResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.resolve(__dirname, '../workers/scheduler-worker.js'), {
        workerData: request
      });
      
      // Timeout nach 110 Sekunden
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Scheduling timeout after 110 seconds'));
      }, 110000);
      
      worker.on('message', (result: ScheduleResult) => {
        clearTimeout(timeout);
        resolve(result);
      });
      
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}