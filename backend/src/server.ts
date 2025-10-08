const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health route
app.get('/api/health', (req: any, res: any) => {
  console.log('✅ Health check called');
  res.json({ 
    status: 'OK', 
    message: 'Backend läuft!',
    timestamp: new Date().toISOString()
  });
});

// Simple login without bcrypt
app.post('/api/auth/login', (req: any, res: any) => {
  console.log('🔐 Login attempt:', req.body.email);
  
  // Einfache Hardcoded Auth (OHNE Passwort-Hashing für Test)
  if (req.body.email === 'admin@schichtplan.de' && req.body.password === 'admin123') {
    console.log('✅ Login successful');
    res.json({
      user: {
        id: '1',
        email: 'admin@schichtplan.de', 
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      token: 'simple-jwt-token-' + Date.now(),
      expiresIn: '7d'
    });
  } else {
    console.log('❌ Login failed');
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Get shift templates
app.get('/api/shift-templates', (req: any, res: any) => {
  console.log('📋 Fetching shift templates');
  res.json([
    {
      id: '1',
      name: 'Standard Woche',
      description: 'Standard Schichtplan',
      isDefault: true,
      createdBy: '1',
      createdAt: new Date().toISOString(),
      shifts: [
        { id: '1', dayOfWeek: 1, name: 'Vormittag', startTime: '08:00', endTime: '12:00', requiredEmployees: 2 },
        { id: '2', dayOfWeek: 1, name: 'Nachmittag', startTime: '11:30', endTime: '15:30', requiredEmployees: 2 }
      ]
    }
  ]);
});

// Start server
app.listen(PORT, () => {
  console.log('🎉 BACKEND STARTED SUCCESSFULLY!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  console.log(`📍 Ready for login!`);
});

console.log('🚀 Server starting...');