# Single stage build for workspaces
FROM node:20-bullseye AS builder

WORKDIR /app

# Copy root package files first
COPY package*.json ./
COPY tsconfig.base.json ./
COPY ecosystem.config.cjs ./

# Install root dependencies
#RUN npm install --only=production
RUN npm i --package-lock-only
RUN npm ci

# Copy workspace files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Install workspace dependencies individually
RUN npm install --workspace=backend
RUN npm install --workspace=frontend

# Build backend first
RUN npm run build --only=production --workspace=backend

# Build frontend
RUN npm run build --only=production --workspace=frontend

# Production stage
FROM node:20-bullseye

WORKDIR /app

# Install system dependencies including gettext-base for envsubst
RUN apt-get update && apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2
RUN mkdir -p /app/data

# Copy application files
COPY --from=builder /app/backend/dist/ ./dist/
COPY --from=builder /app/backend/package*.json ./

COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/frontend/dist/ ./frontend-build/

COPY --from=builder /app/ecosystem.config.cjs ./

COPY --from=builder /app/backend/src/database/ ./dist/database/
# should be obsolete with the line above
#COPY --from=builder /app/backend/src/database/ ./database/

COPY --from=builder /app/backend/src/python-scripts/ ./python-scripts/

# Install Python + OR-Tools
RUN apt-get update && apt-get install -y python3 python3-pip build-essential \
  && pip install --no-cache-dir ortools

# Create symlink so python3 is callable as python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Verify Python and OR-Tools installation
RUN python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Copy init script and env template
COPY docker-init.sh /usr/local/bin/
COPY .env.template ./

# Set execute permissions for init script
RUN chmod +x /usr/local/bin/docker-init.sh

# Create user and set permissions
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -s /bin/bash -g nodejs schichtplan && \
    chown -R schichtplan:nodejs /app && \
    chmod 755 /app && \
    chmod 775 /app/data

ENV PM2_HOME=/app/.pm2

# Set entrypoint to init script and keep existing cmd
ENTRYPOINT ["/usr/local/bin/docker-init.sh"]
CMD ["pm2-runtime", "ecosystem.config.cjs"]

USER schichtplan
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/health || exit 1