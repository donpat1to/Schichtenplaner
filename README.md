# Schichtenplaner

A web application for planning and distributing work shifts among employees. Manage your team's schedules, handle employee availability, and automatically generate optimized shift plans.

## Features

- Employee management with availability tracking
- Shift plan creation and management
- Automated scheduling optimization using constraint programming (OR-Tools CP-SAT)
- Excel export functionality
- User authentication with JWT
- Responsive web interface

---

## For Developers

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite 6 (build tool & dev server)
- React Router DOM (routing)
- date-fns (date handling)
- Framer Motion (animations)

**Backend:**
- Express.js with TypeScript
- SQLite3 (database)
- JWT authentication
- Helmet (security headers)
- express-rate-limit (rate limiting)
- OR-Tools CP-SAT (Python - scheduling optimization)
- ExcelJS (Excel exports)

**Infrastructure:**
- npm workspaces (monorepo)
- Docker support

### Prerequisites

- Node.js (v18+)
- Python 3 with OR-Tools (`pip install ortools`)
- npm

### Getting Started

```bash
# Install dependencies
npm install

# Run development server (frontend + backend)
npm run dev

# Build all packages
npm run build:all
```

### Project Structure

```
schichtenplaner/
├── frontend/     # React application
├── backend/      # Express API server
├── premium/      # Premium features (optional)
└── package.json  # Root monorepo config
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:frontend` | Start frontend only |
| `npm run dev:backend` | Start backend only |
| `npm run build:all` | Build frontend and backend |
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Run Docker container |

### Environment Variables

The backend requires these environment variables in production:
- `NODE_ENV` - Set to `production` or `development`
- `JWT_SECRET` - Secret key for JWT token signing
- `TRUST_PROXY_ENABLED` - Enable/disable proxy trust (default: true)
- `TRUSTED_PROXY_IPS` - Comma-separated list of trusted proxy IPs

---

## 🧾 License

This project uses a **dual license model**:

- **Community Edition:** Licensed under [MIT](./LICENSE) for personal and non-commercial use.
- **Commercial Edition:** A [commercial license](./LICENSE-COMMERCIAL) is required for any for-profit or business use.

To obtain a commercial license, contact:  
📧 patrick@mahnke-hartmann.dev

[![License: MIT & Commercial](https://img.shields.io/badge/license-MIT%20%7C%20Commercial-purple)](#license)
