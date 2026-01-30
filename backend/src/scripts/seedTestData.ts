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
    weekly_plan: {
        plan_name: string;
        description: string;
        period: string;
        employee_preferences: {
            [employeeName: string]: {
                required_weeks: number;
                assignment_style: 'consecutive' | 'flexible' | 'scattered';
                assignment_style_consecutive: number;
                preferences: { [weekNumber: string]: number };
            };
        };
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

// Helper function to get ISO week number (Kalenderwoche) - copied from controller
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper function to generate weeks from date range - copied from controller
function generateWeeksFromDateRange(startDate: string, endDate: string): Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    minEmployees: number;
    maxEmployees: number;
}> {
    const weeks: Array<{
        weekNumber: number;
        startDate: string;
        endDate: string;
        minEmployees: number;
        maxEmployees: number;
    }> = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
    }

    // Adjust to Monday of the week containing start date
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayOffset);

    // Adjust end date to Sunday of the week containing end date
    const endDayOfWeek = end.getDay();
    const sundayOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    const adjustedEnd = new Date(end);
    adjustedEnd.setDate(end.getDate() + sundayOffset);

    let currentWeekStart = new Date(start);

    while (currentWeekStart <= adjustedEnd) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);

        // Get calendar week number (Kalenderwoche)
        const weekNumber = getWeekNumber(currentWeekStart);

        weeks.push({
            weekNumber,
            startDate: currentWeekStart.toISOString().split('T')[0],
            endDate: weekEnd.toISOString().split('T')[0],
            minEmployees: 2,
            maxEmployees: 4,
        });

        // Move to next week
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeks;
}

export async function seedTestData(): Promise<void> {
    try {
        console.log('🌱 Starting test data seeding...');

        // Read test.json file
        const testDataPath = path.resolve(__dirname, './test.json');
        console.log('🔍 Looking for test.json at:', testDataPath);

        if (!fs.existsSync(testDataPath)) {
            console.log('❌ test.json file not found at:', testDataPath);
            const alternativePaths = [
                path.resolve(__dirname, '../../test.json'),
                path.resolve(__dirname, '../test.json')
            ];

            for (const altPath of alternativePaths) {
                console.log('🔍 Trying alternative path:', altPath);
                if (fs.existsSync(altPath)) {
                    console.log('✅ Found test.json at:', altPath);
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
            days: Object.keys(testData.shifts).length,
            hasWeeklyPlan: !!testData.weekly_plan
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
                const username = firstname.toLowerCase();
                const email = generateEmail(firstname, lastname || 'Test');
                const passwordHash = await bcrypt.hash('ZebraAux123!', 10);

                const contractType = mapContractType(testData.employee_info.contract_sizes[name]);
                const employeeType = testData.employee_info.employee_types[name];
                const role = testData.employee_info.roles[name];
                const isTrainee = testData.employee_info.trainees[name];
                const canWorkAlone = testData.employee_info.can_work_alone[name];

                // Insert employee
                await db.run(
                    `INSERT INTO employees (
                        id, username, email, password, firstname, lastname,
                        employee_type, contract_type, can_work_alone,
                        is_trainee, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employeeId,
                        username,
                        email,
                        passwordHash,
                        firstname,
                        lastname || null,
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

                console.log(`✅ Created employee: ${name} (@${username}, ${email})`);
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
                    testData.status,
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

            // 5. Create employee availabilities
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

            // 6. Create weekly plan
            if (testData.weekly_plan) {
                console.log('📊 Creating weekly plan...');
                await seedWeeklyPlanData(testData.weekly_plan, employeeMap, createdBy);
            }

            await db.run('COMMIT');

            console.log('🎉 Test data seeded successfully!');
            console.log('📊 Summary:');
            console.log(`   - Employees: ${employeeNames.length}`);
            console.log(`   - Shift Plan: ${testData.plan_name}`);
            console.log(`   - Time Slots: ${Object.keys(timeSlotMap).length}`);
            console.log(`   - Shifts: ${Object.keys(shiftMap).length}`);
            console.log(`   - Period: ${testData.period}`);

            if (testData.weekly_plan) {
                console.log(`   - Weekly Plan: ${testData.weekly_plan.plan_name}`);
                console.log(`   - Period: ${testData.weekly_plan.period}`);
                console.log(`   - Employees with preferences: ${Object.keys(testData.weekly_plan.employee_preferences).length}`);
            }

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

async function seedWeeklyPlanData(
    weeklyPlanData: TestData['weekly_plan'],
    employeeMap: { [name: string]: string },
    creatorId: string
): Promise<void> {
    if (!weeklyPlanData) return;

    const weeklyPlanId = uuidv4();
    const [startDate, endDate] = weeklyPlanData.period.split(' bis ');

    console.log(`📅 Creating weekly plan: ${weeklyPlanData.plan_name}`);

    // 1. Insert weekly plan
    await db.run(
        `INSERT INTO weekly_plans (
            id, name, description, start_date, end_date, 
            status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            weeklyPlanId,
            weeklyPlanData.plan_name,
            weeklyPlanData.description,
            startDate.trim(),
            endDate.trim(),
            'draft',
            creatorId
        ]
    );

    // 2. Generate weeks from date range
    console.log(`📆 Generating weeks from date range...`);
    const weeks = generateWeeksFromDateRange(startDate.trim(), endDate.trim());
    const weekMap: { [weekNumber: string]: string } = {};

    for (const week of weeks) {
        const weekId = uuidv4();
        weekMap[week.weekNumber.toString()] = weekId;

        await db.run(
            `INSERT INTO plan_weeks (
                id, plan_id, week_number, start_date, end_date,
                min_employees, max_employees
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                weekId,
                weeklyPlanId,
                week.weekNumber,
                week.startDate,
                week.endDate,
                week.minEmployees,
                week.maxEmployees
            ]
        );

        console.log(`   Week ${week.weekNumber}: ${week.startDate} - ${week.endDate}`);
    }

    // 3. Create employee work requirements and preferences
    console.log('👥 Setting employee requirements and preferences...');

    for (const [employeeName, data] of Object.entries(weeklyPlanData.employee_preferences)) {
        const employeeId = employeeMap[employeeName];

        if (!employeeId) {
            console.warn(`⚠️  Employee not found: ${employeeName}`);
            continue;
        }

        // Insert work requirement with new fields
        await db.run(
            `INSERT INTO weekly_work_requirements (
                id, employee_id, plan_id, required_weeks,
                assignment_style, assignment_style_consecutive
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                employeeId,
                weeklyPlanId,
                data.required_weeks,
                data.assignment_style,
                data.assignment_style_consecutive
            ]
        );

        // Insert preferences for each week
        for (const [weekNumberStr, preferenceLevel] of Object.entries(data.preferences)) {
            const weekId = weekMap[weekNumberStr];

            if (!weekId) {
                console.warn(`⚠️  Week ${weekNumberStr} not found for ${employeeName}`);
                continue;
            }

            await db.run(
                `INSERT INTO weekly_preferences (
                    id, employee_id, plan_id, week_id, preference_level
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    uuidv4(),
                    employeeId,
                    weeklyPlanId,
                    weekId,
                    preferenceLevel
                ]
            );
        }

        console.log(`   ${employeeName}: ${data.required_weeks} weeks, ${data.assignment_style} style (consecutive size: ${data.assignment_style_consecutive})`);
    }

    console.log(`✅ Weekly plan created with ID: ${weeklyPlanId}`);
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