# 🧟 Project Zomboid Build 42 - Local Dedicated Server Dashboard

Un panel de control web moderno, intuitivo y modular diseñado específicamente para **Windows 11** para instalar, configurar, iniciar, detener, reiniciar y administrar de forma 100% automatizada un servidor dedicado standalone de **Project Zomboid Build 42** con soporte completo para mods de Steam Workshop.

---

## 🚀 Características Principales

- **Dashboard Web Moderno y Responsive**:
  - Diseño Glassmorphism Dark Mode optimizado.
  - Indicadores de estado en tiempo real (*Detenido*, *Iniciando*, *En Ejecución*, *Deteniendo*, *Instalando*, *Actualizando*, *Error*).
  - Monitoreo en vivo de recursos del sistema (Uso de CPU, RAM total y RAM consumida por el proceso de Project Zomboid).
  - Acciones rápidas en cabecera: Iniciar, Detener de forma segura (`save` & `quit`), Reiniciar y Forzar Cierre.

- **Instalación y Actualización Automatizada**:
  - Descarga y configuración automática de **SteamCMD** portable si no está presente en el sistema.
  - Instalación y actualización con un solo clic del servidor dedicado de Project Zomboid (Steam App ID `380870`).
  - Soporte para ramas beta (ej. rama `unstable` de **Build 42** o rama pública).
  - Barra de progreso interactiva con porcentaje y bytes descargados en tiempo real.

- **Consola Interactiva en Vivo**:
  - Transmisión continua de logs por WebSocket de baja latencia.
  - Coloración por niveles de log (`stdout`, `stderr`, `system`, `steamcmd`, `warn`, `error`, `success`).
  - Autoscroll conmutable, buscador y filtro de texto en tiempo real.
  - Envío interactivo de comandos de consola del juego (`help`, `players`, `save`, `reloadoptions`, `servermsg`, etc.) con historial navegable (flechas ↑ / ↓) y botones de acceso rápido.
  - Descarga directa del historial de logs en archivo de texto `.txt`.

- **Gestión Integral de Configuración**:
  - Ajuste visual del Nombre del Servidor, Nombre Público, Descripción, Límite de Jugadores y Contraseñas (Servidor y RCON Admin).
  - Asignación de memoria RAM mínima (`-Xms`) y máxima (`-Xmx`).
  - Configuración de puertos de red (`DefaultPort 16261 UDP`, `UDPPort 16262 UDP`, UPnP).
  - Rutas personalizables para instalación, SteamCMD y directorio de datos (`-cachedir`).
  - Persistencia local automática en `config/settings.json` y sincronización bidireccional con el archivo `<servidor>.ini`.

- **Gestor de Mods de Steam Workshop**:
  - Administración visual de IDs de Steam Workshop (`WorkshopItems`) y nombres de mods (`Mods`).
  - **Importador inteligente**: Pega descripciones completas de la Workshop o colecciones y extrae automáticamente los IDs numéricos y nombres de mod.
  - Sincronización instantánea con los archivos de configuración del servidor.

- **Editor de Archivos en Vivo**:
  - Editor de texto integrado en el navegador para modificar directamente `<servidor>.ini` y `<servidor>_SandboxVars.lua`.
  - Creación automática de copias de seguridad (`.bak`) antes de cada guardado para prevenir pérdida de datos.

- **100% Local y Sin Dependencias Externas**:
  - Se ejecuta en `http://127.0.0.1:3000`.
  - Sin Docker ni servicios en la nube requeridos.

---

## 📋 Requisitos del Sistema

- **Sistema Operativo**: Windows 11 (o Windows 10 de 64 bits).
- **Node.js**: Versión 18.x, 20.x o superior ([Descargar Node.js LTS](https://nodejs.org/)).
- **Memoria RAM**: 8 GB de RAM mínimo recomendado (16 GB o más si juegas y hospedas en la misma PC con múltiples mods).
- **Espacio en Disco**: ~10 GB libres para los archivos del servidor de Project Zomboid y mods.

---

## ⚡ Inicio Rápido

1. **Clonar o descargar** esta carpeta en tu equipo (ejemplo: `G:\pzserver`).
2. Haz doble clic en el archivo:
   ```cmd
   start.bat
   ```
   *El script verificará e instalará automáticamente las dependencias si es la primera vez y abrirá el dashboard en tu navegador web en `http://127.0.0.1:3000`.*

3. **Desde el Dashboard**:
   - Haz clic en **"Instalar Servidor"** para que SteamCMD descargue automáticamente los archivos del servidor dedicado de Project Zomboid Build 42.
   - Ajusta tu configuración (Nombre del servidor, RAM, Mods) en la pestaña **"Configuración"** o **"Gestor de Mods"**.
   - Haz clic en **"Iniciar"** para arrancar el servidor.
   - Sigue el arranque en la **"Consola en Vivo"** hasta ver el mensaje `*** SERVER STARTED ****`.

---

## 🌐 Configuración de Red y Puertos en Windows 11

Para que otros jugadores puedan unirse a tu servidor a través de Internet:

1. **Firewall de Windows**:
   - Abre *Seguridad de Windows* -> *Firewall y protección de red* -> *Permitir que una aplicación se comunique a través de Firewall*.
   - Permite el ejecutable `jre64\bin\java.exe` dentro de tu carpeta de servidor (`pz_dedicated_server`).
   - O crea reglas de entrada para los siguientes puertos UDP:
     - **16261 UDP** (Puerto principal del juego)
     - **16262 UDP** (Puerto de conexión directa de clientes)

2. **Reenvío de Puertos en el Router (Port Forwarding)**:
   - Accede al panel de administración de tu router.
   - Redirige los puertos **16261 UDP** y **16262 UDP** hacia la dirección IP local de tu PC en Windows 11 (ej. `192.168.1.XX`).
   - Si tu router soporta **UPnP**, el servidor intentará abrirlos automáticamente si `UPnP=true` está activo en la configuración.

---

## 📁 Estructura del Proyecto

```
pzserver/
├── config/
│   └── settings.json             # Configuración persistente del dashboard y servidor
├── logs/                         # Registros diarios de servidor y SteamCMD
├── public/                       # Frontend SPA (HTML5, CSS3 Glassmorphism, JS)
│   ├── css/
│   │   ├── styles.css            # Sistema de diseño, layout responsive y dark mode
│   │   └── terminal.css          # Estilos de la terminal y comandos
│   ├── js/
│   │   ├── api.js                # Cliente REST API
│   │   ├── app.js                # Orquestador general de la aplicación
│   │   ├── configView.js         # Controlador del formulario de configuración
│   │   ├── console.js            # Controlador de la consola en tiempo real
│   │   ├── fileEditor.js         # Editor de archivos .ini y scripts Lua
│   │   ├── modView.js            # Controlador del gestor de mods
│   │   └── websocket.js          # Cliente WebSocket en tiempo real
│   └── index.html                # Interfaz de usuario principal
├── scripts/
│   ├── install_dependencies.bat  # Script para instalar paquetes npm
│   ├── run.ps1                   # Script para PowerShell 7 / Windows PowerShell
│   └── start_dashboard.bat       # Script principal de lanzamiento en Windows
├── src/
│   ├── config/
│   │   └── configManager.js      # Gestor de persistencia de configuración
│   ├── routes/
│   │   └── api.js                # Definición de rutas y endpoints de la API REST
│   ├── services/
│   │   ├── logService.js         # Ring-buffer de logs y emisión WebSocket
│   │   ├── modService.js         # Parser y gestor de Workshop y Mods
│   │   ├── pzConfigService.js    # Parser bidireccional de .ini y SandboxVars.lua
│   │   ├── pzProcessService.js   # Manejo de procesos Java, stdin/stdout y errores
│   │   ├── steamcmdService.js    # Gestor y descargador automático de SteamCMD
│   │   └── systemService.js      # Monitoreo de recursos de Windows (CPU/RAM)
│   └── websocket/
│       └── wsHandler.js          # Servidor WebSocket y emisión de telemetría
├── package.json                  # Dependencias y scripts del proyecto
├── server.js                     # Servidor HTTP/WebSocket principal
├── start.bat                     # Acceso directo de 1 clic para Windows 11
└── README.md                     # Documentación completa
```

---

## 🧩 Gestión de Mods en Build 42

En Project Zomboid, los mods requieren dos parámetros:
1. **WorkshopItems**: Lista de IDs numéricos de Steam Workshop separados por punto y coma (ej. `2680473910;2460154811`).
2. **Mods**: Lista de los nombres internos de los mods separados por punto y coma (ej. `TrueActionsDancing;AutoLoot`).

El dashboard incluye:
- **Importador Rápido**: Puedes copiar y pegar directamente el texto de la página del mod de Steam Workshop o la lista de mods compartida por tus amigos. El sistema detectará las líneas `Workshop ID: ...` y `Mod ID: ...` y las agregará a las listas correspondientes automáticamente.
- **Sincronización Automática**: Al presionar **"Sincronizar y Guardar Mods"**, los valores se aplican inmediatamente a tu `<servidor>.ini` y a la configuración general.

---

## 🛠️ Extensibilidad y Arquitectura Modular

El backend está estructurado en servicios desacoplados bajo `src/services/`, facilitando expansiones futuras como:
- **Múltiples perfiles de servidor**: Añadir selector de perfiles en `configManager.js` para cambiar rápidamente entre mundos PvE, PvP o Hardcore.
- **Gestor de Backups automáticos**: Añadir un servicio que comprima la carpeta `%USERPROFILE%/Zomboid/Saves/Multiplayer/<servidor>` en archivos `.zip` programados.
- **Lista blanca y administración de jugadores**: Integrar comandos `adduser`, `grantadmin`, `kick` y `ban` con una interfaz de usuarios conectada a SQLite / DB de Zomboid.

---

## ❓ Solución de Problemas Frecuentes

1. **Error: "OutOfMemoryError: Java heap space"**:
   - Dirígete a la pestaña **Configuración** -> **Hardware, Memoria y Red** y aumenta la **RAM Máxima (-Xmx)** a `6144m` (6 GB) o `8192m` (8 GB) según la memoria de tu equipo.
2. **Error: "Address already in use / BindException"**:
   - Otro proceso o servidor anterior sigue utilizando los puertos `16261` o `16262`. Ve a la pestaña **Herramientas** y haz clic en **"Forzar Cierre de Emergencia"** para limpiar cualquier proceso Java huérfano.
3. **SteamCMD se queda congelado o no descarga**:
   - Verifica tu conexión a internet o haz clic en el botón **"Cancelar"** en el banner superior y reintenta la instalación/actualización.
4. **Los jugadores no ven el servidor en la lista pública**:
   - Asegúrate de haber reenviado los puertos UDP 16261 y 16262 en tu router y de que la opción `Public=true` esté activada en la configuración.

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia MIT.
