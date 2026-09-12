# Deploy a producción — paso a paso

Guía de comandos para llevar `portal_soltecgroup` a un servidor remoto con
Docker. Es hermana de [`next-asistencia/DEPLOY.md`](../next-asistencia/DEPLOY.md);
si ya tienes Docker instalado en el servidor por haber desplegado
`next-asistencia`, sáltate el paso 0.

Sustituye los valores entre `<...>` por los tuyos:

- `<usuario>@<ip-servidor>` — o el alias que tengas en `~/.ssh/config`
- `<url-odoo-publica>` — ej. `https://odoo.midominio.com`
- `<dominio-portal>` — ej. `portal.midominio.com`
- `<planner-jwt-secret>` — genera uno con `openssl rand -hex 32`

---

## 0. Requisitos en el servidor (una sola vez, o ya hecho si desplegaste next-asistencia)

```bash
ssh <usuario>@<ip-servidor>
```

**Opción A — script oficial (recomendado, incluye el plugin `docker compose` v2):**

```bash
curl -fsSL https://get.docker.com | sh
```

**Opción B — paquetes de Ubuntu/Debian vía apt:**

```bash
apt update
apt install -y docker.io docker-compose-v2
systemctl enable --now docker
```

Si tu usuario **no** es `root`, añádelo al grupo `docker`:

```bash
usermod -aG docker $USER
exit   # cierra sesión y vuelve a entrar para que el grupo tenga efecto
```

Verifica:

```bash
ssh <usuario>@<ip-servidor>
docker --version
docker compose version
```

---

## 1. Llevar el código al servidor

**Opción A — Git:**

```bash
ssh <usuario>@<ip-servidor>
git clone <url-del-repo> portal_soltecgrupo
cd portal_soltecgrupo/portal_soltecgrupo   # ajusta según la ruta real del proyecto Next.js
```

**Opción B — rsync desde tu Mac:**

```bash
rsync -avz --exclude node_modules --exclude .next \
  ./ <usuario>@<ip-servidor>:~/portal_soltecgrupo/
```

---

## 2. Configurar las variables de entorno

A diferencia de `next-asistencia`, aquí las variables se leen en **runtime**
(rutas API server-side), no en build-time — ver
[DOCKER.md](DOCKER.md#diferencia-clave-con-next-asistencia-variables-en-runtime-no-en-build).
Eso significa que puedes cambiarlas más adelante sin reconstruir la imagen.

```bash
cd ~/portal_soltecgrupo   # ajusta la ruta si usaste git clone con subcarpeta
cat > .env <<'EOF'
ODOO_URL=<url-odoo-publica>
PLANNER_JWT_SECRET=<planner-jwt-secret>
EOF
```

`PLANNER_JWT_SECRET` firma los tokens de SSO hacia `/planner` y `/alta`:
trátalo como una contraseña, no lo subas a git ni lo compartas por chat.

---

## 3. Build y arranque

```bash
docker compose up --build -d
```

Por defecto queda publicado en el puerto **3001** del host (para no chocar
con `next-asistencia` en el 3000, si ambos corren en el mismo servidor).
Para usar otro puerto:

```bash
HOST_PORT=8080 docker compose up --build -d
```

Verifica:

```bash
docker compose ps
docker compose logs -f --tail=100
curl -I http://localhost:3001/login
```

---

## 4. Reverse proxy con TLS (Nginx + Let's Encrypt)

Si ya configuraste Nginx para `next-asistencia`, solo añade un nuevo
server block apuntando al puerto de este contenedor.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx   # si no lo tienes ya
```

Crea `/etc/nginx/sites-available/portal-soltecgrupo`:

```nginx
server {
    listen 80;
    server_name <dominio-portal>;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portal-soltecgrupo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d <dominio-portal>
```

La app queda accesible en `https://<dominio-portal>`.

---

## 5. Acceso a Odoo desde el contenedor

`ODOO_URL` debe ser una URL a la que el contenedor pueda llegar (misma red,
firewall abierto, etc.). Si Odoo corre en el mismo servidor fuera de
Docker, `http://localhost:8069` **no funciona dentro del contenedor** salvo
que uses `network_mode: host` o la IP real de la máquina; usa la URL
pública/interna real de Odoo en `ODOO_URL`.

---

## 6. Redeploy tras un cambio de código

```bash
ssh <usuario>@<ip-servidor>
cd ~/portal_soltecgrupo
git pull            # o repite el rsync desde tu Mac
docker compose up --build -d
```

## 7. Cambiar solo variables de entorno (sin tocar código)

```bash
# edita .env con el nuevo ODOO_URL / PLANNER_JWT_SECRET
docker compose up -d --no-build
```

---

## 8. Rollback rápido

```bash
docker images portal-soltecgrupo
docker tag portal-soltecgrupo:<sha-anterior> portal-soltecgrupo:latest
docker compose up -d --no-build
```

Etiqueta la imagen actual antes de cada `up --build` para poder volver atrás:

```bash
docker tag portal-soltecgrupo:latest portal-soltecgrupo:backup-$(date +%Y%m%d%H%M)
```

---

## 9. Comandos útiles de mantenimiento

```bash
docker compose logs -f
docker compose restart
docker compose down
docker system prune -f
```
