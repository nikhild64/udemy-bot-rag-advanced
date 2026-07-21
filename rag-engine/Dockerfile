# Builder Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package management files
# (Note: pnpm-workspace.yaml might not exist in single project, but copied if exists)
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

# Install all dependencies (including devDependencies) for build
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the TypeScript code
RUN pnpm run build

# Runtime Stage
FROM node:22-alpine AS runtime

WORKDIR /app

# Set node environment
ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package management files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.js"]
