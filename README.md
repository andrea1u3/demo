# Studio Ops SaaS

MVP comercial para studio boutique de pilates reformer en Mexico.

## Objetivo del piloto

Subir `+10%` la ocupacion real en 60 dias:

```text
ocupacion real = asistencias registradas / cupo total disponible
```

## Stack

- Next.js + React + TypeScript
- Tailwind
- Supabase Postgres/Auth/RLS
- MercadoPago o Stripe despues de validar el flujo base
- WhatsApp provider despues de tener reservas y dashboard

## Inicio local

```bash
npm install
npm run dev
```

En Windows/PowerShell usa:

```powershell
npm.cmd run dev
```

## Estado actual de la app

- La UI ya es interactiva.
- Las operaciones se guardan en `localStorage` del navegador.
- Puedes crear clientes, crear clases, reservar por canal, ajustar cupos, cancelar, hacer check-in y operar waitlist.
- El siguiente paso de producto es reemplazar la persistencia local por Supabase usando la RPC `reserve_spot`.

## Base de datos

La migracion inicial vive en:

```text
supabase/migrations/0001_initial.sql
```

La funcion critica es `reserve_spot`. Usa locks en Postgres y valida:

- cupo global de la clase
- cupo por canal
- cliente duplicado en la misma clase
- cliente bloqueado

No usar Redis como fuente de verdad de cupos.
"# demo" 
"# demo" 
"# demo" 
"# demo" 
"# demo" 
"# demo" 
