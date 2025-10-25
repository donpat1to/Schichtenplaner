# Multi-stage build for combined frontend + backend
FROM node:20-bullseye AS backend-builder

WORKDIR /app/backend

# Install Python + OR-Tools
RUN apt-get update && apt-get install -y python3 python3-pip build-essential \
  && pip install --no-cache-dir ortools

# Create symlink so python3 is callable as python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy backend files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source
COPY backend/src/ ./src/

# Build backend
RUN npm run build

# Copy database files manually
RUN cp -r src/database/ dist/database/

# Verify Python and OR-Tools installation
RUN python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Frontend build stage
FROM node:20-bullseye AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
COPY frontend/tsconfig.json ./

# Install frontend dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/src/ ./src/
COPY frontend/public/ ./public/

# Build frontend
RUN npm run build

# Production stage
FROM node:20-bookworm

WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data

# Copy backend built files
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/dist/ ./dist/
COPY --from=backend-builder /app/backend/node_modules/ ./node_modules/

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