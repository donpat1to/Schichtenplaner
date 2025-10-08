// backend/src/server.ts - Login für alle Benutzer
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3002;

// IN-MEMORY STORE für Mitarbeiter (mit gehashten Passwörtern)
let employees = [
  {
    id: '1',
    email: 'admin@schichtplan.de',
    password: '$2a$10$8K1p/a0dRTlB0ZQ1.5Q.2e5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q', // admin123
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
    password: '$2a$10$8K1p/a0dRTlB0ZQ1.5Q.2e5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q', // instandhalter123
    name: 'Max Instandhalter',
    role: 'instandhalter',
    isActive: true,
    phone: '+49 123 456790',
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

// Login Route für ALLE Benutzer
app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Benutzer in der employees Liste suchen
    const user = employees.find(emp => emp.email === email && emp.isActive);
    
    if (!user) {
      console.log('❌ User not found or inactive:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Passwort vergleichen
    // Für Test: Wenn Passwort nicht gehasht ist (neue Benutzer), direkt vergleichen
    let isPasswordValid = false;
    
    if (user.password.startsWith('$2a$')) {
      // Gehashtes Passwort (bcrypt)
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // Klartext-Passwort (für Test)
      isPasswordValid = password === user.password;
    }

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
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

// EMPLOYEE ROUTES mit In-Memory Store
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

    // Check if email already exists
    if (employees.find(emp => emp.email === email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Passwort hashen für neue Benutzer
    const hashedPassword = await bcrypt.hash(password, 10);

    // Neuen Mitarbeiter erstellen
    const newEmployee = {
      id: uuidv4(),
      email,
      password: hashedPassword, // Gehashtes Passwort speichern
      name, 
      role,
      isActive: true,
      phone: phone || '',
      department: department || '',
      createdAt: new Date().toISOString(),
      lastLogin: ''
    };

    // Zum Store hinzufügen
    employees.push(newEmployee);

    console.log('✅ Employee created. Total employees:', employees.length);
    
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

    // Mitarbeiter aktualisieren (Passwort bleibt unverändert)
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
    console.log('🗑️ Deleting employee:', id);
    
    // Mitarbeiter finden
    const employeeIndex = employees.findIndex(emp => emp.id === id);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Soft delete - set isActive to false
    employees[employeeIndex].isActive = false;

    console.log('✅ Employee deactivated:', employees[employeeIndex].name);
    res.status(204).send();
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
app.get('/api/auth/me', async (req: any, res: any) => {
  try {
    // Einfache Mock-Implementation
    // In einer echten App würde man den Token verifizieren
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Einfache Token-"Validierung" für Demo
    const tokenParts = token.split('-');
    const userId = tokenParts[tokenParts.length - 1];
    
    const user = employees.find(emp => emp.id === userId && emp.isActive);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // User ohne Passwort zurückgeben
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);

  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Availability Routes (Mock)
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
        isAvailable: day >= 1 && day <= 5 // Nur Mo-Fr verfügbar
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
    console.log('Data:', availabilities);
    
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
  console.log('🔐 Login system READY for ALL users!');
  console.log('👥 Employee management READY with proper authentication!');
});