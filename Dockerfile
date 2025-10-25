# Multi-stage build for combined frontend + backend
FROM node:20-bullseye AS backend-builder

WORKDIR /app

# Install Python + OR-Tools
RUN apt-get update && apt-get install -y python3 python3-pip build-essential \
  && pip install --no-cache-dir ortools

# Create symlink so python3 is callable as python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy ALL package files (root + backend)
COPY package*.json ./
COPY backend/package.json ./backend/

# Install dependencies using workspaces
RUN npm ci --workspace=backend

# Copy backend source
COPY backend/src/ ./backend/src/
COPY backend/tsconfig.json ./backend/

# Build backend
RUN npm run build --workspace=backend

# Copy database files manually
RUN cp -r backend/src/database/ backend/dist/database/

# Verify Python and OR-Tools installation
RUN python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Frontend build stage
FROM node:20-bullseye AS frontend-builder

WORKDIR /app

# Copy ALL package files (root + frontend)
COPY package*.json ./
COPY frontend/package.json ./frontend/

# Install dependencies using workspaces
RUN npm ci --workspace=frontend

# Copy frontend source
COPY frontend/src/ ./frontend/src/
COPY frontend/public/ ./frontend/public/
COPY frontend/tsconfig.json ./frontend/

# Build frontend
RUN npm run build --workspace=frontend

# Production stage
FROM node:20-bookworm

WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data

# Copy backend built files
COPY --from=backend-builder /app/backend/dist/ ./dist/
COPY --from=backend-builder /app/node_modules/ ./node_modules/
COPY --from=backend-builder /app/backend/package.json ./

# Copy frontend built files  
COPY --from=frontend-builder /app/frontend/build/ ./frontend-build/

# Copy PM2 configuration
COPY ecosystem.config.cjs ./

# Create a non-root user and group - DEBIAN STYLE
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -s /bin/bash -g nodejs schichtplan && \
    chown -R schichtplan:nodejs /app && \
    chmod 755 /app && \
    chmod 775 /app/data

# Set PM2 to use app directory instead of home directory
ENV PM2_HOME=/app/.pm2

USER schichtplan

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/health || exit 1

CMD ["pm2-runtime", "ecosystem.config.cjs"]