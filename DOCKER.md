# Deploy con Docker

`portal_soltecgroup` es un frontend/backend Next.js (usa sus propias rutas
`/api/*` como proxy server-side hacia Odoo) para el portal del cliente. No
tiene base de datos propia: solo necesita saber a qué Odoo hablar y un
secreto para firmar el SSO.

## Archivos añadidos

- **`Dockerfile`**: build multi-stage (deps → builder → runner) sobre
  `node:20-alpine`, usando [`output: "standalone"`](next.config.ts).
- **`.dockerignore`**
- **`docker-compose.yml`**: build + arranque con `env_file: .env`.

Es el mismo patrón que usa el hermano [`next-asistencia`](../next-asistencia/DOCKER.md),
con una diferencia importante explicada abajo.

## Diferencia clave con next-asistencia: variables en runtime, no en build

Este proyecto **no usa ninguna variable `NEXT_PUBLIC_*`**. Las dos que
existen se leen únicamente en rutas API server-side
(`src/app/api/**/route.ts`), es decir, en código que se ejecuta en el
servidor Node en cada petición — nunca se incrusta en el JavaScript que
llega al navegador:

```
ODOO_URL=https://tu-odoo.example.com
PLANNER_JWT_SECRET=<secreto-largo-y-aleatorio>
```

Por eso, a diferencia de `next-asistencia`, **no hace falta pasarlas como
build-arg**. Basta con:

- Tenerlas en un `.env` junto al `docker-compose.yml` (usa `env_file: .env`).
- O pasarlas con `docker run -e ODOO_URL=... -e PLANNER_JWT_SECRET=...`.

Y lo más importante para el día a día: **puedes cambiar `ODOO_URL` o rotar
`PLANNER_JWT_SECRET` sin reconstruir la imagen**, solo reiniciando el
contenedor con el nuevo `.env`:

```bash
docker compose up -d --no-build
```

`PLANNER_JWT_SECRET` es un secreto (firma tokens de SSO hacia
`/planner` y `/alta`) — no lo commitees en git, no lo pongas en el
`Dockerfile`, y trátalo igual que una contraseña.

## Build y run manual

```bash
docker build -t portal-soltecgrupo:latest .

docker run -d \
  --name portal-soltecgrupo \
  -p 3001:3000 \
  -e ODOO_URL=https://tu-odoo.example.com \
  -e PLANNER_JWT_SECRET=<secreto-largo-y-aleatorio> \
  portal-soltecgrupo:latest
```

## Build y run con docker-compose

```bash
cat > .env <<'EOF'
ODOO_URL=https://tu-odoo.example.com
PLANNER_JWT_SECRET=<secreto-largo-y-aleatorio>
EOF

docker compose up --build -d
```

Por defecto se publica en el puerto **3001** del host (`HOST_PORT` en
`docker-compose.yml`), para no chocar con `next-asistencia` si ambos corren
en el mismo servidor. Cámbialo con:

```bash
HOST_PORT=8080 docker compose up --build -d
```

## Por qué el Dockerfile tiene 3 etapas

Igual razonamiento que en `next-asistencia`:

1. **`deps`**: `npm ci` con `package-lock.json`, cacheable mientras no
   cambien las dependencias.
2. **`builder`**: `next build` con `output: "standalone"`.
3. **`runner`**: solo copia `.next/standalone`, `.next/static` y `public`;
   corre como usuario `nextjs` sin privilegios, escuchando en
   `0.0.0.0:3000` dentro del contenedor.

## Notas para producción real

- **Reverse proxy / HTTPS**: pon esto detrás de Nginx/Traefik/Caddy con TLS
  (ver [DEPLOY.md](DEPLOY.md)).
- **`PLANNER_JWT_SECRET`**: genera uno robusto, por ejemplo:
  ```bash
  openssl rand -hex 32
  ```
  Si lo rotas, cualquier link de SSO firmado con el secreto anterior deja
  de ser válido.
- **CORS**: al ser rutas `/api/*` del propio Next.js (no de Odoo), no
  aplica la config `cors='*'` de `hr_attendance_soltec`; asegúrate de que
  `ODOO_URL` sea accesible desde dentro del contenedor (red del servidor,
  firewall, etc.).
