// backend/src/scripts/seedTestData.ts
import { db } from '../services/databaseService.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestData {
    plan_name: string;
    description: string;
    period: string;
    status: string;
    created_by: string;
    shifts: {
        [day: string]: {
            [shiftType: string]: {
                time: string;
                assignments: { [employeeName: string]: number };
            };
        };
    };
    employee_info: {
        contract_sizes: { [name: string]: string };
        employee_types: { [name: string]: string };
        roles: { [name: string]: string };
        trainees: { [name: string]: boolean };
        can_work_alone: { [name: string]: boolean };
    };
    availability_scale: {
        [key: string]: string;
    };
}

function generateEmail(firstname: string, lastname: string): string {
    const convertUmlauts = (str: string): string => {
        return str
            .toLowerCase()
            .replace(/ü/g, 'ue')
            .replace(/ö/g, 'oe')
            .replace(/ä/g, 'ae')
            .replace(/ß/g, 'ss');
    };

    const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
    const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');

    return `${cleanFirstname}.${cleanLastname}@sp.de`;
}

function mapContractType(germanType: string): 'small' | 'large' | 'flexible' {
    switch (germanType) {
        case 'groß': return 'large';
        case 'klein': return 'small';
        case 'flexible': return 'flexible';
        default: return 'small';
    }
}

function mapDayToNumber(day: string): number {
    const dayMap: { [key: string]: number } = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 7
    };
    return dayMap[day.toLowerCase()] || 1;
}

function parseTimeSlot(time: string): { startTime: string; endTime: string } {
    const [start, end] = time.split(' - ');
    return {
        startTime: start.trim(),
        endTime: end.trim()
    };
}

export async function seedTestData(): Promise<void> {
    try {
        console.log('🌱 Starting test data seeding...');

        // Read test.json file - adjust path to be relative to project root
        const testDataPath = path.resolve(process.cwd(), 'test.json');

        console.log('🔍 Looking for test.json at:', testDataPath);

        if (!fs.existsSync(testDataPath)) {
            console.log('❌ test.json file not found at:', testDataPath);

            // Try alternative paths
            const alternativePaths = [
                path.resolve(__dirname, '../../../test.json'),
                path.resolve(process.cwd(), '../test.json'),
                path.resolve(__dirname, '../../test.json')
            ];

            for (const altPath of alternativePaths) {
                console.log('🔍 Trying alternative path:', altPath);
                if (fs.existsSync(altPath)) {
                    console.log('✅ Found test.json at:', altPath);
                    // Continue with the found path
                    break;
                }
            }

            return;
        }

        const testDataRaw = fs.readFileSync(testDataPath, 'utf-8');
        const testData: TestData = JSON.parse(testDataRaw);

        console.log('📊 Loaded test data:', {
            planName: testData.plan_name,
            employeeCount: Object.keys(testData.employee_info.contract_sizes).length,
            days: Object.keys(testData.shifts).length
        });

        // Start transaction
        await db.run('BEGIN TRANSACTION');

        try {
            // 1. Create employees
            console.log('👥 Creating employees...');
            const employeeMap: { [name: string]: string } = {};
            const employeeNames = Object.keys(testData.employee_info.contract_sizes);

            for (const name of employeeNames) {
                const employeeId = uuidv4();
                employeeMap[name] = employeeId;

                const [firstname, lastname = ''] = name.split(' ');
                const email = generateEmail(firstname, lastname || 'Test');
                const passwordHash = await bcrypt.hash('test1234', 10);

                const contractType = mapContractType(testData.employee_info.contract_sizes[name]);
                const employeeType = testData.employee_info.employee_types[name];
                const role = testData.employee_info.roles[name];
                const isTrainee = testData.employee_info.trainees[name];
                const canWorkAlone = testData.employee_info.can_work_alone[name];

                // Insert employee
                await db.run(
                    `INSERT INTO employees (
            id, email, password, firstname, lastname, 
            employee_type, contract_type, can_work_alone, 
            is_trainee, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employeeId,
                        email,
                        passwordHash,
                        firstname,
                        lastname || 'Test',
                        employeeType,
                        contractType,
                        canWorkAlone ? 1 : 0,
                        isTrainee ? 1 : 0,
                        1
                    ]
                );

                // Insert role
                await db.run(
                    `INSERT INTO employee_roles (employee_id, role) VALUES (?, ?)`,
                    [employeeId, role]
                );

                console.log(`✅ Created employee: ${name} (${email})`);
            }

            // 2. Create shift plan
            console.log('📅 Creating shift plan...');
            const planId = uuidv4();
            const [startDate, endDate] = testData.period.split(' bis ');

            // Use the first admin employee as creator
            const adminEmployee = Object.entries(testData.employee_info.roles)
                .find(([_, role]) => role === 'admin');
            const createdBy = adminEmployee ? employeeMap[adminEmployee[0]] : employeeMap[employeeNames[0]];

            await db.run(
                `INSERT INTO shift_plans (
          id, name, description, start_date, end_date, 
          is_template, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    planId,
                    testData.plan_name,
                    testData.description,
                    startDate.trim(),
                    endDate.trim(),
                    0, // is_template = false
                    'published',
                    createdBy
                ]
            );

            // 3. Create time slots
            console.log('⏰ Creating time slots...');
            const timeSlotMap: { [key: string]: string } = {};

            // Extract unique time slots from shifts
            const uniqueTimeSlots = new Set<string>();
            Object.values(testData.shifts).forEach(dayShifts => {
                Object.values(dayShifts).forEach(shift => {
                    uniqueTimeSlots.add(shift.time);
                });
            });

            let timeSlotIndex = 0;
            for (const time of uniqueTimeSlots) {
                const timeSlotId = uuidv4();
                const { startTime, endTime } = parseTimeSlot(time);
                const name = timeSlotIndex === 0 ? 'Vormittag' : 'Nachmittag';

                await db.run(
                    `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [timeSlotId, planId, name, startTime, endTime, `Time slot: ${time}`]
                );

                timeSlotMap[time] = timeSlotId;
                timeSlotIndex++;
            }

            // 4. Create shifts
            console.log('🔄 Creating shifts...');
            const shiftMap: { [dayTime: string]: string } = {};

            for (const [dayName, dayShifts] of Object.entries(testData.shifts)) {
                const dayOfWeek = mapDayToNumber(dayName);

                for (const [shiftType, shiftData] of Object.entries(dayShifts)) {
                    const shiftId = uuidv4();
                    const timeSlotId = timeSlotMap[shiftData.time];

                    await db.run(
                        `INSERT INTO shifts (id, plan_id, time_slot_id, day_of_week, required_employees, color) 
             VALUES (?, ?, ?, ?, ?, ?)`,
                        [shiftId, planId, timeSlotId, dayOfWeek, 2, '#3498db']
                    );

                    shiftMap[`${dayName}_${shiftType}`] = shiftId;
                }
            }

            // 5. Generate scheduled shifts for one week (for template demonstration)
            console.log('📋 Generating scheduled shifts...');
            const start = new Date(startDate.trim());

            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const currentDate = new Date(start);
                currentDate.setDate(start.getDate() + dayOffset);

                const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
                const dayName = Object.keys(testData.shifts).find(day =>
                    mapDayToNumber(day) === dayOfWeek
                );

                if (dayName && testData.shifts[dayName]) {
                    for (const [shiftType, shiftData] of Object.entries(testData.shifts[dayName])) {
                        const scheduledShiftId = uuidv4();
                        const timeSlotId = timeSlotMap[shiftData.time];

                        await db.run(
                            `INSERT INTO scheduled_shifts (id, plan_id, date, time_slot_id, required_employees, assigned_employees) 
               VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                                scheduledShiftId,
                                planId,
                                currentDate.toISOString().split('T')[0],
                                timeSlotId,
                                2,
                                JSON.stringify([])
                            ]
                        );
                    }
                }
            }

            // 6. Create employee availabilities
            console.log('📝 Creating employee availabilities...');

            for (const [dayName, dayShifts] of Object.entries(testData.shifts)) {
                const dayOfWeek = mapDayToNumber(dayName);

                for (const [shiftType, shiftData] of Object.entries(dayShifts)) {
                    const shiftId = shiftMap[`${dayName}_${shiftType}`];

                    for (const [employeeName, preferenceLevel] of Object.entries(shiftData.assignments)) {
                        const employeeId = employeeMap[employeeName];

                        if (employeeId) {
                            const availabilityId = uuidv4();

                            await db.run(
                                `INSERT INTO employee_availability (id, employee_id, plan_id, shift_id, preference_level) 
                 VALUES (?, ?, ?, ?, ?)`,
                                [availabilityId, employeeId, planId, shiftId, preferenceLevel]
                            );
                        }
                    }
                }
            }

            await db.run('COMMIT');

            console.log('🎉 Test data seeded successfully!');
            console.log('📊 Summary:');
            console.log(`   - Employees: ${employeeNames.length}`);
            console.log(`   - Shift Plan: ${testData.plan_name}`);
            console.log(`   - Time Slots: ${Object.keys(timeSlotMap).length}`);
            console.log(`   - Shifts: ${Object.keys(shiftMap).length}`);
            console.log(`   - Period: ${testData.period}`);

        } catch (error) {
            await db.run('ROLLBACK');
            console.error('❌ Error during test data seeding:', error);
            throw error;
        }

    } catch (error) {
        console.error('❌ Failed to seed test data:', error);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedTestData()
        .then(() => {
            console.log('✅ Seed script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seed script failed:', error);
            process.exit(1);
        });
}