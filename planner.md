# Integración SSO entre Portal Soltec y Planner

Ambas apps comparten la variable `PLANNER_JWT_SECRET`. Toda firma y verificación ocurre en el
servidor (nunca en el navegador).

---

## 1. Secreto compartido

Solicitar al equipo de Portal la cadena `PLANNER_JWT_SECRET` y almacenarla como variable de entorno
segura en el backend del Planner. **No commit, no logs.**

---

## 2. Flujo A — Portal → Planner (ya implementado)

```
Usuario pulsa "Planner" en Portal
        │
        ▼
POST /api/planner/sso  (Next.js, interno)
 • Obtiene email real desde Odoo
 • Genera JWT HS256 (exp 60 s)
        │
        ▼
window.location.href = https://planner.soltecgrupo.es/auth/sso/soltec?t=<JWT>
        │
        ▼
Planner verifica JWT y crea sesión
```

### JWT que recibe el Planner

| Claim    | Valor fijo / dinámico              |
|----------|------------------------------------|
| `iss`    | `"soltec_satellite"`               |
| `aud`    | `"planner"`                        |
| `tenant` | `"soltec"`                         |
| `email`  | email del usuario en Portal/Odoo   |
| `jti`    | UUID v4 único por clic             |
| `iat`    | Unix timestamp de generación       |
| `nbf`    | igual a `iat`                      |
| `exp`    | `iat + 60` segundos                |

### Lo que debe hacer el Planner al recibirlo

```
1. Verificar firma HS256 con PLANNER_JWT_SECRET
2. Comprobar exp > now  →  rechazar si expirado
3. Comprobar iss === "soltec_satellite"
4. Comprobar aud === "planner"
5. Comprobar jti no fue usado antes (replay protection)
6. Usar claims.email para identificar/crear la sesión local
```

---

## 3. Flujo B — Planner → Portal (recién implementado)

```
Usuario pulsa "Portal" en Planner
        │
        ▼
Backend Planner genera JWT HS256 (exp 60 s)  ←  mismo secreto
        │
        ▼
Redireccionar a:
https://portal.soltecgrupo.es/auth/sso?t=<JWT>
        │
        ▼
Portal verifica JWT → llama a Odoo → crea sesión → /dashboard
```

### URL de entrada al Portal

```
https://portal.soltecgrupo.es/auth/sso?t=<JWT>
```

### JWT que debe generar el Planner

```json
{
  "iss": "planner",
  "aud": "soltec_portal",
  "tenant": "soltec",
  "email": "usuario@soltec.com",
  "jti": "<uuid-unico>",
  "iat": 1754470000,
  "nbf": 1754470000,
  "exp": 1754470060
}
```

| Claim    | Valor fijo / dinámico              |
|----------|------------------------------------|
| `iss`    | `"planner"` — **exacto**           |
| `aud`    | `"soltec_portal"` — **exacto**     |
| `tenant` | `"soltec"`                         |
| `email`  | email exacto del usuario en Portal |
| `jti`    | UUID v4 único por clic             |
| `exp`    | `now + 60` segundos — máximo       |

> El `email` debe coincidir exactamente con el registrado en Odoo (campo `email` del partner).
> El Portal lo busca con `.lower()` — usar minúsculas para evitar problemas.

### Ejemplo de generación (Python / Node)

**Python (PyJWT):**
```python
import jwt, uuid, time

payload = {
    "iss": "planner",
    "aud": "soltec_portal",
    "tenant": "soltec",
    "email": user.email.lower(),
    "jti": str(uuid.uuid4()),
    "iat": int(time.time()),
    "nbf": int(time.time()),
    "exp": int(time.time()) + 60,
}
token = jwt.encode(payload, PLANNER_JWT_SECRET, algorithm="HS256")
redirect_url = f"https://portal.soltecgrupo.es/auth/sso?t={token}"
```

**Node.js (jsonwebtoken):**
```js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss:'planner', aud:'soltec_portal', tenant:'soltec',
    email: user.email.toLowerCase(), jti: uuidv4(),
    iat: now, nbf: now, exp: now + 60 },
  process.env.PLANNER_JWT_SECRET,
  { algorithm: 'HS256', noTimestamp: true }
);
res.redirect(`https://portal.soltecgrupo.es/auth/sso?t=${token}`);
```

---

## 4. Checklist de seguridad para el Planner

- [ ] `PLANNER_JWT_SECRET` solo en variables de entorno del servidor, no en frontend
- [ ] Verificar `exp` antes de aceptar cualquier token entrante
- [ ] Implementar replay protection en Flujo A (almacenar `jti` consumidos al menos 2 minutos)
- [ ] `exp` máximo 60 segundos — no alargar
- [ ] HTTPS obligatorio en ambas URLs de redirección
- [ ] El `email` debe pertenecer a un usuario activo en el sistema receptor

---

## 5. Endpoints involucrados

| Dirección         | URL                                                        | Método |
|-------------------|------------------------------------------------------------|--------|
| Portal → Planner  | `https://planner.soltecgrupo.es/auth/sso/soltec?t=<JWT>`  | GET    |
| Planner → Portal  | `https://portal.soltecgrupo.es/auth/sso?t=<JWT>`          | GET    |
| (Interno) API SSO | `https://portal.soltecgrupo.es/api/auth/sso`              | POST   |
