# syntax=docker/dockerfile:1

# ── 1. deps: instala dependencias con caché de npm ───────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. builder: compila la app Next.js ───────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ podría no existir en algún checkout (git no versiona carpetas
# vacías); nos aseguramos de que exista para que el COPY de la etapa runner
# no falle.
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1

# A diferencia de next-asistencia, esta app NO usa variables NEXT_PUBLIC_*:
# ODOO_URL y PLANNER_JWT_SECRET se leen en runtime (rutas API server-side),
# así que no hace falta pasarlas como build-arg aquí. Se fijan al arrancar
# el contenedor (ver docker-compose.yml / DEPLOY.md).
RUN npm run build

# ── 3. runner: imagen final, mínima, solo con el output standalone ─────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
