# USA Latino Prime

PWA mobile-first para organizar documentos migratorios, fechas críticas, automatizaciones administrativas y servicios premium.

## Estructura

- `apps/web`: PWA React con dashboard, bóveda, automatizaciones y utilidades.
- `apps/api`: API Node/Express preparada para PostgreSQL, Stripe y conectores oficiales.
- `packages/shared`: tipos y validaciones compartidas.
- `database/migrations`: esquema PostgreSQL inicial.
- `docs`: arquitectura, investigación y mockups.

## Inicio local

```bash
npm install
npm run dev
```

Web: `http://localhost:5173`

API: `http://localhost:4000`

## Base de datos

```bash
createdb usa_latino_prime
cp .env.example .env
npm run db:migrate
```

El MVP no automatiza presentación legal ante cortes o USCIS. Genera borradores, recordatorios, paquetes de revisión y exportaciones para firma/envío del usuario o revisión humana.
