// backend/src/server.ts - Login für alle Benutzer
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3002;

// IN-MEMORY STORE für Mitarbeiter
let employees = [
  {
    id: '1',
    email: 'admin@schichtplan.de',
    password: 'admin123', // Klartext für Test
    name: 'Admin User',
    role: 'admin',
    isActive: true,
    phone: '+49 123 456789',
    department: 'IT',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    id: '2', 
    email: 'instandhalter@schichtplan.de',
    password: 'instandhalter123',
    name: 'Max Instandhalter',
    role: 'instandhalter',
    isActive: true,
    phone: '+49 123 456790',
    department: 'Produktion',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    id: '3',
    email: 'mitarbeiter1@schichtplan.de', 
    password: 'user123',
    name: 'Anna Müller',
    role: 'user',
    isActive: true,
    phone: '+49 123 456791',
    department: 'Logistik',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    id: '4',
    email: 'mitarbeiter2@schichtplan.de',
    password: 'user123',  
    name: 'Tom Schmidt',
    role: 'user',
    isActive: true,
    phone: '+49 123 456792',
    department: 'Produktion',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  }
];

// CORS und Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health route
app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend läuft!',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt for:', email);
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password?.length);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Benutzer suchen
    const user = employees.find(emp => emp.email === email && emp.isActive);
    
    if (!user) {
      console.log('❌ User not found or inactive:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('🔍 User found:', user.email);
    console.log('💾 Stored password:', user.password);
    console.log('↔️ Password match:', password === user.password);

    // Passwort-Überprüfung
    const isPasswordValid = password === user.password;

    if (!isPasswordValid) {
      console.log('❌ Password invalid for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Last Login aktualisieren
    user.lastLogin = new Date().toISOString();

    console.log('✅ Login successful for:', email);

    // User ohne Passwort zurückgeben
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token: 'jwt-token-' + Date.now() + '-' + user.id,
      expiresIn: '7d'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EMPLOYEE ROUTES
app.get('/api/employees', async (req: any, res: any) => {
  try {
    console.log('📋 Fetching employees - Total:', employees.length);
    
    // Passwörter ausblenden
    const employeesWithoutPasswords = employees.map(emp => {
      const { password, ...empWithoutPassword } = emp;
      return empWithoutPassword;
    });
    
    res.json(employeesWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/employees', async (req: any, res: any) => {
  try {
    const { email, password, name, role, phone, department } = req.body;
    
    console.log('👤 Creating employee:', { email, name, role });

    // Validierung
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Rollen-Validierung
    const validRoles = ['admin', 'instandhalter', 'user'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    // Check if email already exists
    if (employees.find(emp => emp.email === email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // NEUEN Benutzer erstellen
    const newEmployee = {
      id: uuidv4(),
      email,
      password: password, // Klartext speichern für einfachen Test
      name, 
      role,
      isActive: true,
      phone: phone || '',
      department: department || '',
      createdAt: new Date().toISOString(),
      lastLogin: ''
    };

    employees.push(newEmployee);

    console.log('✅ Employee created:', { 
      email: newEmployee.email, 
      name: newEmployee.name, 
      role: newEmployee.role 
    });
    console.log('📊 Total employees:', employees.length);
    
    // Response ohne Passwort
    const { password: _, ...employeeWithoutPassword } = newEmployee;
    res.status(201).json(employeeWithoutPassword);

  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/employees/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, phone, department } = req.body;
    
    console.log('✏️ Updating employee:', id);

    // Mitarbeiter finden
    const employeeIndex = employees.findIndex(emp => emp.id === id);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Mitarbeiter aktualisieren
    employees[employeeIndex] = {
      ...employees[employeeIndex],
      name: name || employees[employeeIndex].name,
      role: role || employees[employeeIndex].role,
      isActive: isActive !== undefined ? isActive : employees[employeeIndex].isActive,
      phone: phone || employees[employeeIndex].phone,
      department: department || employees[employeeIndex].department
    };

    console.log('✅ Employee updated:', employees[employeeIndex].name);
    
    // Response ohne Passwort
    const { password, ...employeeWithoutPassword } = employees[employeeIndex];
    res.json(employeeWithoutPassword);

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/employees/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    console.log('🗑️  Deleting employee:', id);
    
    const employeeIndex = employees.findIndex(emp => emp.id === id);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employeeToDelete = employees[employeeIndex];

    // Admin-Check
    if (employeeToDelete.role === 'admin') {
      const adminCount = employees.filter(emp => 
        emp.role === 'admin' && emp.isActive
      ).length;
      
      if (adminCount <= 1) {
        return res.status(400).json({ 
          error: 'Mindestens ein Administrator muss im System verbleiben' 
        });
      }
    }

    // Perform hard delete
    employees.splice(employeeIndex, 1);
    console.log('✅ Employee permanently deleted:', employeeToDelete.name);

    res.status(204).send();
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Availability Routes
app.get('/api/employees/:employeeId/availabilities', async (req: any, res: any) => {
  try {
    const { employeeId } = req.params;
    console.log('📅 Fetching availabilities for:', employeeId);
    
    // Mock Verfügbarkeiten
    const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    const timeSlots = [
      { name: 'Vormittag', start: '08:00', end: '12:00' },
      { name: 'Nachmittag', start: '12:00', end: '16:00' },
      { name: 'Abend', start: '16:00', end: '20:00' }
    ];
    
    const mockAvailabilities = daysOfWeek.flatMap(day =>
      timeSlots.map((slot, index) => ({
        id: `avail-${employeeId}-${day}-${index}`,
        employeeId,
        dayOfWeek: day,
        startTime: slot.start,
        endTime: slot.end,
        isAvailable: day >= 1 && day <= 5
      }))
    );
    
    res.json(mockAvailabilities);
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/employees/:employeeId/availabilities', async (req: any, res: any) => {
  try {
    const { employeeId } = req.params;
    const availabilities = req.body;
    
    console.log('💾 Saving availabilities for:', employeeId);
    
    // Mock erfolgreiches Speichern
    res.json(availabilities);
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🎉 BACKEND STARTED SUCCESSFULLY!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🔐 SIMPLE LOGIN READY - Plain text passwords for testing!');
  console.log('');
  console.log('📋 TEST ACCOUNTS:');
  console.log('   👑 Admin: admin@schichtplan.de / admin123');
  console.log('   🔧 Instandhalter: instandhalter@schichtplan.de / instandhalter123');
  console.log('   👤 User1: mitarbeiter1@schichtplan.de / user123');
  console.log('   👤 User2: mitarbeiter2@schichtplan.de / user123');
  console.log('   👤 Patrick: patrick@patrick.de / 12345678');
});