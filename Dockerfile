# Single stage build for workspaces
FROM node:20-bullseye AS builder

WORKDIR /app

# Install Python + OR-Tools
RUN apt-get update && apt-get install -y python3 python3-pip build-essential \
  && pip install --no-cache-dir ortools

# Create symlink so python3 is callable as python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy root package files first
COPY package*.json ./
COPY tsconfig.base.json ./

# Install root dependencies
RUN npm install

# Copy workspace files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Install workspace dependencies individually
RUN npm install --workspace=backend
RUN npm install --workspace=frontend

# Build backend first
RUN npm run build --workspace=backend

# Build frontend
RUN npm run build --workspace=frontend

# Verify Python and OR-Tools installation
RUN python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Production stage (same as above)
FROM node:20-bookworm
WORKDIR /app
RUN npm install -g pm2
RUN mkdir -p /app/data
COPY --from=builder /app/backend/dist/ ./dist/
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/frontend/dist/ ./frontend-build/
COPY --from=builder /app/ecosystem.config.cjs ./
COPY --from=builder /app/backend/src/database/ ./dist/database/
COPY --from=builder /app/backend/src/database/ ./database/
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -s /bin/bash -g nodejs schichtplan && \
    chown -R schichtplan:nodejs /app && \
    chmod 755 /app && \
    chmod 775 /app/data
ENV PM2_HOME=/app/.pm2
USER schichtplan
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/health || exit 1
CMD ["pm2-runtime", "ecosystem.config.cjs"]