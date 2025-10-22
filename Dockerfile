# --- Build stage ---
    FROM node:20-slim AS builder
    WORKDIR /app
    
    # Install OpenSSL for Prisma
    RUN apt-get update -y && apt-get install -y openssl
    
    # Copy package files
    COPY package*.json ./
    RUN npm ci --omit=dev
    
    # Copy Prisma schema and generate client
    COPY prisma ./prisma
    RUN npx prisma generate
    
    # Copy source code
    COPY src ./src
    
    # --- Runtime stage ---
    FROM node:20-slim
    WORKDIR /app
    
    # Install OpenSSL, curl, and mysql-client
    RUN apt-get update -y && \
        apt-get install -y openssl curl default-mysql-client && \
        apt-get clean && \
        rm -rf /var/lib/apt/lists/*
    
    ENV NODE_ENV=production
    
    # Copy from builder
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/prisma ./prisma
    COPY --from=builder /app/src ./src
    COPY package*.json ./
    
    # Copy docs if exists
    COPY docs ./docs
    
    # Create uploads directory
    RUN mkdir -p uploads/events uploads/avatars
    
    EXPOSE 8080
    
    # Healthcheck
    HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
        CMD curl -f http://localhost:8080/health || exit 1
    
    CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]