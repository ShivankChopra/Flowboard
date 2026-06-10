FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
ARG DATABASE_URL
RUN DATABASE_URL="$DATABASE_URL" npm --workspace apps/api run prisma:generate

FROM base AS api-dev
EXPOSE 3000
CMD ["npm", "--workspace", "apps/api", "run", "start:dev"]

FROM base AS web-dev
EXPOSE 5173
CMD ["npm", "--workspace", "apps/web", "run", "dev", "--", "--host", "0.0.0.0"]
