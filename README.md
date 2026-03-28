# DASHBOARD-TERMINAL

Sistema de terminal de autobuses para venta de boletos, control de corridas, administración, historial de ventas, métricas operativas y registro de gastos.

## 1) Características principales

- Login con autenticación JWT.
- Modo vendedor para venta de boletos por asiento.
- Modo administrador con validación adicional de acceso.
- Gestión de corridas: crear, reiniciar y eliminar.
- Historial de ventas con búsqueda y estado de boletos.
- Dashboard con métricas por día, semana, mes y año.
- Módulo de gastos: fijos, variables y pagos de trabajadores.
- Branding personalizable (logo, imágenes hero, textos).

## 2) Stack tecnológico

- Frontend: React + TypeScript + Vite + Tailwind CSS + Motion + Leaflet.
- Backend: Node.js + Express + TypeScript.
- Base de datos: MySQL (compatible con WAMP).
- Seguridad: JWT, bcrypt, protección por roles y rutas autenticadas.

## 3) Arquitectura general

- Cliente web en [src](src).
- API REST en [server/src](server/src).
- Esquema SQL base en [server/sql/schema.sql](server/sql/schema.sql).
- Configuración por entorno en [.env](.env) y [.env.example](.env.example).

## 4) Estructura del proyecto

```text
terminal-de-autobuses-au/
   index.html
   package.json
   vite.config.ts
   tsconfig.json
   .env
   .env.example
   README.md

   src/
      App.tsx
      main.tsx
      index.css
      types.ts
      pages/
         TerminalSystemPage.tsx
      routes/
         AppRoutes.tsx
      lib/
         discounts.ts
      components/
         BusLayout.tsx
         terminal/
            AppHeader.tsx
            LoginScreen.tsx
            SellerView.tsx
            SalesView.tsx
            AdminView.tsx
            SaleModal.tsx
            TicketModal.tsx
            CancelTicketModal.tsx
            AdminAccessModal.tsx
            config.ts

   server/
      tsconfig.json
      sql/
         schema.sql
      src/
         index.ts
         lib/
            auth.ts
            db.ts
            discounts.ts
            discountConfig.ts
            password.ts
         routes/
            auth.ts
            health.ts
            settings.ts
            trips.ts
            tickets.ts
            expenses.ts
```

## 5) Requisitos

- Node.js 18+ (recomendado 20+).
- MySQL 8+ o compatible.
- npm.

## 6) Configuración de entorno

Usa [.env.example](.env.example) como base y define tus valores en [.env](.env).

Variables importantes:

- VITE_API_URL: URL base del backend para el frontend.
- API_PORT: puerto donde corre la API.
- JWT_SECRET: secreto para firma de tokens.
- JWT_EXPIRES_IN: vigencia del token.
- ADMIN_GATE_PASSWORD: clave de acceso al panel administrador.
- ADMIN_SETUP_KEY: clave para setup inicial de admin.
- PASSWORD_PEPPER: pepper usado en hash de contraseñas.
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME: conexión MySQL.

## 7) Instalación y arranque local

1. Instalar dependencias del proyecto.

```bash
npm install
```

2. Crear base de datos y tablas.

- Importar [server/sql/schema.sql](server/sql/schema.sql) en MySQL.

3. Levantar frontend y backend en desarrollo.

Terminal 1:

```bash
npm run dev:client
```

Terminal 2:

```bash
npm run dev:server
```

4. Abrir la app en:

- http://localhost:3000

## 8) Scripts útiles

- npm run dev: frontend Vite en puerto 3000.
- npm run dev:client: frontend Vite.
- npm run dev:server: backend con watch.
- npm run build: build de frontend.
- npm run build:server: compilación TS backend.
- npm run lint: chequeo TypeScript sin emitir archivos.
- npm run preview: preview del build frontend.

## 9) Módulos funcionales

### Venta de boletos

- Selección de corrida.
- Selección de asiento visual por tipo de unidad.
- Emisión de boleto con descuentos por tipo de tarifa.

### Administración

- Dashboard de ingresos, boletos, corridas y tendencias.
- Gestión de corridas.
- Historial y cancelación de boletos.
- Branding y reglas de descuentos.
- Registro de gastos con categorías:
   - Gastos fijos.
   - Gastos variables.
   - Pagos de trabajadores.

## 10) Seguridad y control

- Rutas API protegidas por token bearer.
- Control de roles seller y admin.
- Validación adicional para abrir el modo admin.
- Consultas SQL parametrizadas.
- Variables sensibles fuera del repositorio mediante .env* en .gitignore.

## 11) Endpoints principales (resumen)

- Auth: login, me, reauth.
- Trips: listar, crear, reiniciar, eliminar.
- Tickets: listar, crear, cancelar.
- Settings: leer y actualizar descuentos.
- Expenses: listar, crear, eliminar gastos.

## 12) Flujo recomendado de operación

1. Iniciar sesión.
2. Abrir modo vendedor para emitir boletos.
3. Usar historial para auditoría y cancelaciones.
4. Entrar a admin para métricas, corridas, gastos y branding.

## 13) Solución de problemas rápida

- Si la app no conecta al backend: revisar VITE_API_URL y API_PORT.
- Si hay error de DB: validar DB_HOST, DB_USER, DB_PASSWORD y DB_NAME.
- Si falla login/token: revisar JWT_SECRET y hora del sistema.
- Si no carga admin: verificar rol admin y ADMIN_GATE_PASSWORD.

## 14) Licencia

Proyecto interno de operación de terminal. Define aquí la licencia final si publicarás el código para terceros.
