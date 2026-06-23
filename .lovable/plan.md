## Cambio

En `src/components/dashboard/AeDashboardSection.tsx`, agregar debajo de cada tarjeta de AE una lista pequeña con los deals cerrados (Won + Commit) del quarter filtrado.

## Detalles

- Mantener la lógica de conteo actual (cierres = deals en stage `is_won` o `Commited`, filtrados por fecha de creación dentro del Q seleccionado). No se cambia nada del cálculo de "Won+Commit" ni de la meta.
- En el `useMemo` `perAe`, además de los contadores actuales, exponer `wonDeals` (la lista `won` ya calculada, ordenada por valor descendente).
- Renderizar al final de cada tarjeta de AE — solo si hay deals cerrados y si hay un Q seleccionado distinto de "ALL" — un bloque con:
  - Borde superior sutil (`border-t border-border/60`)
  - Texto pequeño (`text-[11px]`)
  - Una fila por deal con `company_name` truncado a la izquierda y `value` formateado en USD a la derecha
  - Altura máxima con scroll (`max-h-28 overflow-auto`) para no romper el grid
  - `title` con el nombre del deal para mostrar contexto en hover

## Fuera de alcance

- No tocar `WeeklyClosuresCard`.
- No cambiar la lógica de qué cuenta como cierre ni la fecha que se usa para filtrar por Q.
- No modificar el resumen del Equipo.