# Single stage build for workspaces
FROM node:20-bullseye AS builder

WORKDIR /app

# Install Python + OR-Tools
RUN apt-get update && apt-get install -y python3 python3-pip build-essential \
  && pip install --no-cache-dir ortools

# Create symlink so python3 is callable as python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy all files
COPY . .

# Install all dependencies (workspaces)
RUN npm install

# Build backend first
RUN npm run build --workspace=backend

# Build frontend with specific workaround for Rollup
RUN cd frontend && npx vite build

# Verify Python and OR-Tools installation
RUN python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Production stage
FROM node:20-bookworm

WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data

# Copy backend built files
COPY --from=builder /app/backend/dist/ ./dist/
COPY --from=builder /app/backend/package*.json ./

# COPY DATABASE FILES - FIXED
COPY --from=builder /app/backend/src/database/ ./dist/database/
COPY --from=builder /app/backend/src/database/ ./database/

# Copy only production dependencies
COPY --from=builder /app/node_modules/ ./node_modules/

# Copy frontend built files
COPY --from=builder /app/frontend/dist/ ./frontend-build/

# Copy PM2 configuration
COPY --from=builder /app/ecosystem.config.cjs ./

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