FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
ARG DATABASE_URL
RUN DATABASE_URL="$DATABASE_URL" npm --workspace apps/api run prisma:generate

FROM base AS api-dev
EXPOSE 3000
CMD ["npm", "--workspace", "apps/api", "run", "start:dev"]

FROM base AS web-dev
EXPOSE 5173
CMD ["npm", "--workspace", "apps/web", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS prod-build
RUN npm --workspace apps/api run build
RUN npm --workspace apps/web run build
RUN npm prune --omit=dev

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-build /app/package.json /app/package-lock.json ./
COPY --from=prod-build /app/node_modules ./node_modules
COPY --from=prod-build /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-build /app/apps/api/dist ./apps/api/dist
COPY --from=prod-build /app/apps/api/prisma ./apps/api/prisma
COPY --from=prod-build /app/apps/web/package.json ./apps/web/package.json
COPY --from=prod-build /app/apps/web/dist ./apps/web/dist
COPY --from=prod-build /app/packages/shared/package.json ./packages/shared/package.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
