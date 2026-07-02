## Objetivo

Eliminar el campo `additional_sdrs` de la base de datos y del código. Actualmente hay 264 empresas que tienen valores ahí, pero ya no se usa en la UI ni se debe seguir manteniendo.

## Cambios

### 1. Base de datos (migración)

- `ALTER TABLE public.companies DROP COLUMN additional_sdrs;`
- Los 264 registros con valores actuales se pierden con la columna (es lo deseado según tu indicación).

### 2. Código frontend

Quitar todas las referencias al campo:

- **`src/types/company.ts`** — eliminar `additional_sdrs?: Sdr[]` de la interfaz `Company`.
- **`src/hooks/useCompanyData.ts`** — eliminar las 3 referencias (tipo de la fila, mapeo al cargar, mapeo al guardar).

### 3. Tipos auto-generados

- **`src/integrations/supabase/types.ts`** se regenera solo cuando aplique la migración. No se edita a mano.

## Lo que NO se hace

- No se toca ninguna lógica de filtros, Kanban, DetailPanel ni dashboards — el campo no se usa en ningún componente visible.
- No se cambia el `sdr` principal de ninguna empresa.

## Verificación

Después de aplicar: build limpio + confirmar con un `rg additional_sdr` que no quedan referencias.