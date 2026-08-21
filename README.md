# 🧟 Project Zomboid Build 42 - Local Dedicated Server Dashboard (con Auth & RBAC)

Un panel de control web moderno, intuitivo y modular diseñado para **Windows 11** para instalar, configurar, iniciar, detener, reiniciar y administrar de forma 100% automatizada un servidor dedicado de **Project Zomboid Build 42**, ahora con un sistema completo de **Autenticación segura de usuarios y Autorización basada en roles (RBAC)**.

---

## 🚀 Características Principales

- **Seguridad & Control de Acceso Basado en Roles (RBAC)**:
  - Base de datos relacional SQLite embebida con sistema de migraciones automáticas.
  - Hashing seguro de contraseñas con `bcryptjs` (salt rounds = 12).
  - Sesiones seguras en el servidor con cookies `HttpOnly`, `SameSite` y flags configurables.
  - Protección contra ataques de fuerza bruta (Rate Limiting en login y registro).
  - Control granular de permisos con soporte de comodines jerárquicos (ej. `mods.*`, `*`).
  - Validación de identidad y permisos tanto en llamadas REST (`/api/*`) como en el WebSocket (`/ws`).
  - Registro de auditoría para rastrear acciones operativas y de seguridad.

- **Dashboard Web Moderno y Responsive**:
  - Diseño Glassmorphism Dark Mode optimizado.
  - Interfaz reactiva a permisos: oculta o desactiva botones y secciones no permitidas para el rol del usuario autenticado.
  - Indicadores de estado en tiempo real (*Detenido*, *Iniciando*, *En Ejecución*, *Deteniendo*, *Instalando*, *Actualizando*, *Error*).
  - Monitoreo en vivo de recursos del sistema (Uso de CPU, RAM total y RAM consumida por el proceso de Project Zomboid).
  - Acciones rápidas en cabecera: Iniciar, Detener de forma segura (`save` & `quit`), Reiniciar y Forzar Cierre.

- **Gestión de Cuentas y Auditoría**:
  - Panel visual de gestión de usuarios para administradores.
  - Creación, modificación de roles/permisos, activación/desactivación y eliminación de usuarios.
  - Protección activa para evitar eliminar o desactivar al último administrador del sistema.
  - Visor en vivo de registros de auditoría de seguridad.

- **Instalación y Actualización Automatizada**:
  - Descarga y configuración automática de **SteamCMD** portable si no está presente en el sistema.
  - Instalación y actualización con un solo clic del servidor dedicado de Project Zomboid (Steam App ID `380870`).
  - Soporte para ramas beta (ej. rama `unstable` de **Build 42** o rama pública).

- **Consola Interactiva en Vivo & WebSocket Seguro**:
  - Transmisión continua de logs por WebSocket autenticado.
  - Envío interactivo de comandos de consola del juego (`help`, `players`, `save`, `reloadoptions`, etc.) sujeto a permisos RBAC (`server.command`).

---

## 🔒 Roles y Matriz de Permisos

El sistema incluye 4 roles base preconfigurados:

| Rol | Descripción | Permisos Principales |
| :--- | :--- | :--- |
| **`admin`** | Administrador con control total del sistema | `*` (Acceso completo sin restricciones) |
| **`operator`** | Operador de infraestructura del servidor | `server.view`, `server.start`, `server.stop`, `server.restart`, `server.command`, `server.install`, `server.config.*`, `mods.*`, `files.*`, `logs.view` |
| **`analyst`** | Analista de métricas y observabilidad | `server.view`, `logs.view` (Solo lectura de telemetría y logs) |
| **`viewer`** | Visualizador básico | `server.view` (Solo lectura de estado general del servidor) |

### Lista de Permisos Disponibles

- `*`: Acceso total sin restricciones.
- `server.view`: Ver estado y telemetría del servidor.
- `server.start`: Iniciar el proceso del servidor.
- `server.stop`: Detener o forzar el apagado del servidor.
- `server.restart`: Reiniciar el servidor.
- `server.command`: Enviar comandos por consola/RCON.
- `server.install`: Instalar o actualizar con SteamCMD.
- `server.config.read`: Leer configuración de PZ y dashboard.
- `server.config.write`: Guardar cambios en la configuración.
- `mods.view`: Ver mods y workshop items instalados.
- `mods.manage`: Agregar, actualizar, parsear y remover mods.
- `files.read`: Leer archivos `.ini`, `.lua` y sandbox.
- `files.write`: Modificar archivos de configuración.
- `logs.view`: Ver transmisión de logs en vivo.
- `logs.clear`: Limpiar buffer de logs.
- `users.view`: Listar y consultar usuarios del sistema.
- `users.manage`: Crear, editar, activar/desactivar y borrar usuarios.
- `roles.view`: Consultar roles y permisos.
- `roles.manage`: Crear y editar roles personalizados.
- `audit.view`: Consultar el registro de auditoría.

---

## ⚡ Inicio Rápido

### 1. Instalación de Dependencias
```bash
npm install
```

### 2. Crear el Usuario Administrador Inicial
Ejecuta el script interactivo para crear tu primera cuenta de administrador:
```bash
npm run create-admin
```
*También puedes proporcionar credenciales mediante argumentos o variables de entorno:*
```bash
node scripts/create-admin.js --username admin --email admin@pzserver.local --password TuPasswordSeguro123!
```

### 3. Iniciar el Servidor
```bash
npm start
```
Abre tu navegador en `http://127.0.0.1:3000` e inicia sesión con las credenciales creadas.

---

## ⚙️ Variables de Entorno (`.env`)

Copia `.env.example` a `.env` si deseas personalizar la configuración:

```env
# Puerto y Host del Dashboard
PORT=3000
HOST=127.0.0.1

# Ubicación de la Base de Datos SQLite
DB_PATH=data/dashboard.db

# Configuración de Cookies
COOKIE_SECURE=false

# Tiempo de Expiración de Sesión (7 días en ms)
SESSION_MAX_AGE_MS=604800000

# Permitir Registro Público (true/false)
# Si es false, solo los administradores pueden crear nuevos usuarios.
ALLOW_REGISTRATION=false
```

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias que cubren hashing, autenticación, expiración de sesiones, permisos RBAC, soporte de comodines y garantías de seguridad:

```bash
npm test
```

---

## 🛠️ Guía de Desarrollo: Cómo Proteger Nuevas Rutas

Para proteger un nuevo endpoint en el backend, utiliza los middlewares disponibles en `src/middleware/authMiddleware.js`:

```javascript
const { requireAuth, requirePermission, requireRole } = require('../middleware/authMiddleware');

// 1. Exigir solo autenticación
router.get('/mi-ruta-privada', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// 2. Exigir un permiso específico (Recomendado)
router.post('/mi-accion', requirePermission('server.start'), (req, res) => {
  // Solo ejecutado si el usuario tiene 'server.start' o '*'
});

// 3. Exigir un rol específico
router.delete('/mi-recurso', requireRole('admin'), (req, res) => {
  // Solo administradores
});
```

---

## 📁 Estructura del Proyecto

```
pzserver/
├── config/
│   └── settings.json             # Configuración persistente del servidor PZ
├── data/                         # Base de datos SQLite y datos locales
│   └── dashboard.db
├── logs/                         # Registros diarios de servidor y SteamCMD
├── public/                       # Frontend SPA (HTML5, CSS3 Glassmorphism, JS)
│   ├── css/
│   │   ├── styles.css            # Sistema de diseño, layout responsive y estilos RBAC
│   │   └── terminal.css          # Estilos de la terminal
│   ├── js/
│   │   ├── api.js                # Cliente REST API con manejo de sesiones y 401/403
│   │   ├── app.js                # Orquestador general de la aplicación
│   │   ├── auth.js               # Gestor de estado de autenticación y RBAC en cliente
│   │   ├── configView.js         # Formulario de configuración
│   │   ├── console.js            # Consola en tiempo real
│   │   ├── fileEditor.js         # Editor de archivos .ini y scripts Lua
│   │   ├── modView.js            # Gestor de mods
│   │   ├── userManagement.js     # Panel de gestión de usuarios y auditoría
│   │   └── websocket.js          # Cliente WebSocket autenticado
│   └── index.html                # Interfaz de usuario con soporte RBAC
├── scripts/
│   ├── create-admin.js           # CLI interactivo para crear o restablecer el admin inicial
│   ├── install_dependencies.bat  # Script para instalar paquetes npm
│   ├── run.ps1                   # Script para PowerShell
│   └── start_dashboard.bat       # Script principal de lanzamiento en Windows
├── src/
│   ├── db/
│   │   ├── database.js           # Conector SQLite nativo y helpers transaccionales
│   │   ├── migrator.js           # Ejecutor automático de migraciones SQL
│   │   └── migrations/
│   │       └── 001_initial_schema.sql # Esquema base y seeds
│   ├── middleware/
│   │   ├── authMiddleware.js     # Middlewares requireAuth, requirePermission, requireRole
│   │   └── rateLimiter.js        # Limitador de tasa contra fuerza bruta
│   ├── routes/
│   │   ├── api.js                # Enrutador principal protegido con RBAC
│   │   ├── authRoutes.js         # /api/auth/login, /register, /logout, /me
│   │   ├── userRoutes.js         # /api/users CRUD
│   │   ├── roleRoutes.js         # /api/roles y permisos
│   │   └── auditRoutes.js        # /api/audit-logs
│   ├── services/
│   │   ├── authService.js        # Manejo de sesiones y tokens server-side
│   │   ├── userService.js        # CRUD de usuarios y hashing de passwords
│   │   ├── roleService.js        # Consulta y configuración de roles/permisos
│   │   ├── auditService.js       # Registro estructurado de eventos auditables
│   │   ├── logService.js         # Ring-buffer de logs y emisión WebSocket
│   │   ├── modService.js         # Parser y gestor de Workshop y Mods
│   │   ├── pzConfigService.js    # Parser bidireccional de .ini y SandboxVars.lua
│   │   ├── pzProcessService.js   # Manejo de procesos Java
│   │   ├── steamcmdService.js    # Gestor y descargador de SteamCMD
│   │   └── systemService.js      # Monitoreo de recursos de Windows (CPU/RAM)
│   └── websocket/
│       └── wsHandler.js          # Servidor WebSocket autenticado con control de acceso
├── tests/
│   ├── auth.test.js              # Tests de login, registro, sesiones y expiración
│   ├── rbac.test.js              # Tests de matriz de permisos y comodines
│   └── security.test.js          # Tests de sanitización y protección de admin
├── .env.example                  # Plantilla de variables de entorno
├── package.json                  # Dependencias y scripts del proyecto
├── server.js                     # Servidor HTTP/WebSocket principal
├── start.bat                     # Acceso directo para Windows 11
└── README.md                     # Documentación completa
```

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia MIT.
