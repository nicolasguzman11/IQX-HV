# Portal Gestión de Contratos · Hospital de Villarrica

Notas para retomar el proyecto (por una persona o por Claude en otra conversación o cuenta).
Aquí NO hay claves ni usuarios; esos viven solo en Cloudflare.

## Cómo está armado
- **Datos:** Google Sheets públicos ("cualquiera con el enlace, lector"), leídos en vivo desde el navegador con PapaParse.
- **Paneles:** páginas estáticas en este repositorio, publicadas en GitHub Pages (`https://nicolasguzman11.github.io/IQX-HV/`).
- **Portal con acceso:** Cloudflare Worker `ugc-hv` (`https://ugc-hv.nicolas-guzmancar.workers.dev/`). Su código está en `worker/worker.js` (la copia que corre está pegada en Cloudflare → Edit code; hay que pegar a mano cada vez que cambia este archivo).
- El Worker hace de login y de proxy: trae las páginas desde GitHub Pages sin caché, así los cambios se ven al recargar.

## Paneles
| Ruta del portal | Archivo | Datos |
|---|---|---|
| `/dashboard?view=iqx` | `index.html` | Hoja IQX `132kn3ID25LlgmcCYJ7-gbYcqbFEWhwzcQs4O_OF7lXw` (pestañas gid 80993582 IQX y 964283009 BASE PAGOS) |
| `/dashboard?view=turnos` | `index.html` | Hoja Horas médicas `18ZZWJq-cNAkTFuYD70l8rQl4O3l-2nkkGRan0TOWvPg` (gid 547212557). Menú: "Horas Médicas" |
| `/consultas` | `consultas.html` | Misma hoja de Horas médicas, pestaña "Consultas Medicas" (gid 1811767707) |
| `/contratos` | `contratos.html` | Hoja REGISTRO GESTION DE CONTRATOS `1pUuEg0JYjbqOTqFQPKDncMiy9CHazgYcyWAlTgSJztU` (pestañas VALIDACION Y OC, BD CONTRATOS, INFO CONTRATOS, ESTADO CONTRATOS) |

`index.html` contiene dos paneles (IQX y Turnos); la pestaña visible se elige con `?view=`. Las pestañas superiores están ocultas a propósito.

## Acceso
- **Primer nivel (todo el portal):** secretos de Cloudflare `DASH_USER` y `DASH_PASS`. Cookie `iqx_session`, 8 horas.
- **Segundo nivel (solo Gestión de Contratos, Subdirección Administrativa):** secretos `CONTRATOS_USER` y `CONTRATOS_PASS`. Cookie `iqx_contratos`. Si no están configurados, el panel queda cerrado para todos.
- Rutas del Worker: `/` (login), `/menu`, `/logout`, `/logo.png`, `/dashboard*`, `/consultas*`, `/contratos*`, `/acceso-contratos` (POST).
- Límite conocido: las hojas de Google y GitHub Pages son públicos para quien tenga el enlace directo; la protección es la del portal.

## Decisiones de diseño
- Estilo común: fondo animado tipo portada (manchas turquesa, azul y dorado + luz que sigue el mouse), tarjetas translúcidas, colores de gráficos suaves, modo oscuro compartido entre paneles (`localStorage` clave `mode`).
- Barra superior con logo del hospital (`logo.png`, emblema sin texto), "← Menú" y "Cerrar sesión".
- Indicador de estado: solo "Panel en vivo". Los errores sí se muestran.
- Quitado a propósito: tabla de médicos con nombres y montos (en Horas Médicas queda solo "Turnos por especialidad"); tarjetas K1–K4 de resumen y tarjetas de "Indicadores complementarios" en Contratos.
- Ocultos para usar más adelante (no borrados): gráfico "Etapa de renovación" y tarjetas de indicadores complementarios en Contratos (`#kpi-comp`).
- Intervenciones Quirúrgicas: primero las tarjetas de montos y avance, luego el detalle por licitación con filtros por estado, y el gráfico "Programado vs. Ejecutado" al final.
- Consultas y Controles: licitaciones vigentes 1952-86-LP25 y 1952-89-LP25 (constante `LICS` en `consultas.html`); al hacer clic en una licitación se ve el detalle por orden de compra y el mes que paga.

## Pendientes
- Monto total de la licitación 1952-89-LP25 (hoy `total:null` en `LICS`, por eso no muestra % de avance).
- Atenciones de la 1952-86-LP25 sin orden de compra (aparecen como "Sin OC" y pendientes).
- La hoja REPORTE calcula 12,08 % de avance para la 86 mezclando pagos de la 86 y la 89; el panel calcula por licitación.
- Pedir a TI que desbloquee `github.io` en la red del hospital (el portal en workers.dev funciona).

## Cómo cambiar algo
1. Editar los archivos HTML de este repositorio y subirlos a `main` (GitHub Pages publica en 1–2 minutos).
2. Si cambia `worker/worker.js`: pegarlo en Cloudflare → Edit code → Deploy.
3. Recargar con Ctrl+F5 (o ventana de incógnito) para evitar la caché del navegador.

## Adquisiciones (Subdirección Administrativa)
- Panel `adquisiciones.html`, ruta Worker `/adquisiciones` (solo login de primer nivel).
- Lee 3 planillas Google por gviz CSV (hoja CONSOLIDADO / CONSOLIDADO FARMACIA), columnas por índice (ver `AREAS` en el archivo):
  - Fármacos `1b5KlSHTWlS-XZchD0RywzkBYP3Ew4Wuk2JKyA08mfhs`
  - Insumos médicos `1Ad3G1wxeRn1sO7jOUh6UtGSlhGkw02Af2jZL8nSOElo`
  - Insumos generales `1eU9H-nPvg6gMNcMrt_bsyB-h5lMZR6L56xoblIVq7h4` (sin valor estimado)
- Solo cuentan filas con MES informado; estados normalizados en `nOC()` / `nRec()`.
- Menú (`worker.js`): grupo Subdirección Médica (IQX, Horas Médicas, Consultas y Controles) y Subdirección Administrativa (Gestión de Contratos, Adquisiciones). Tras cambiar worker.js hay que pegarlo en Cloudflare → Edit code → Deploy.

### Fármacos y laboratorio (Adquisiciones)
- La pestaña "Fármacos y laboratorio" une dos hojas del mismo libro Maestra Farmacia 2026 (id 1b5KlSHT…): `CONSOLIDADO FARMACIA` y `LABORATORIO` (gid 1916132163). Sub-pestañas: Todo / Fármacos / Laboratorio.
- Columnas LABORATORIO (base 0): mes 0, producto 1, proveedor 11, N° OC 12 (respaldo 9 = licitación/OC vigente), estado OC 13, recepción 16. No trae valor: en "Laboratorio" y "Todo" el Top 10 se ordena por veces comprado.
- Laboratorio: si ESTADO OC está en blanco pero hay N° OC válido (no cotización) se considera "Enviada a proveedor" (la hoja no llena el estado en los meses antiguos). "COMPRAR" sigue siendo sin avance.

### Menú con dos tarjetas
- `/menu` muestra dos tarjetas (Subdirección Administrativa / Subdirección Médica); al hacer clic se abre la vista con sus paneles (hash `#admin` / `#medica`, botón "← Volver"). Requiere pegar `worker/worker.js` en Cloudflare.

### Gestión de Contratos sin segunda contraseña
- Desde 20-11-2026 `/contratos` solo exige el inicio de sesión general (se quitó el segundo nivel `iqx_contratos`). El código de la ruta `/acceso-contratos` queda sin uso; los secretos CONTRATOS_USER / CONTRATOS_PASS de Cloudflare ya no se necesitan.

### Gantt ejecutivo (Gestión de Contratos · Visión general)
- (Las tarjetas KPI de color se quitaron a pedido: la Visión general muestra solo la carta Gantt.)
- Barras con degradado y glow; las sin aviso que vencen en ≤90 días pulsan. Cada fila muestra fecha y "N días". Encabezado de mes con barra de calor y pastilla sin aviso / todas avisadas.
- Botón "Modo presentación" (pantalla completa) para reuniones.

## Contratos: hoja «Consumo por monto»
- Cuarta vista del panel de Contratos (junto a Visión general, que mantiene la carta Gantt por fecha de vencimiento).
- Cinco tarjetas por nivel de consumo: Sin saldo (ampliar), ≥ 90%, 70–90%, < 70% y Sin consumo (saldo ≥ monto: el contrato aún no se usa; se ordenan por vencimiento más próximo). Consumo = (Monto − Saldo $) ÷ Monto, solo contratos vigentes con monto > 0.
- Al hacer clic en una tarjeta se abre una ventana (se cierra con Esc, clic fuera o «Cerrar») con los contratos de ese nivel como tarjetas (barra de consumo, monto, consumido, saldo, gasto mensual, días al término); buscador y «Ver más» de a 24.
- Usa las columnas de BD CONTRATOS (Monto $, Saldo $, Gasto mensual $); no requiere cambios en el Worker.
- Visión general: carta Gantt más alta (alto mínimo 1150px, ~24 filas a la vez, la página baja para verlo completo; filas compactas, clase vg-wide en <html>). Se ven ~5 meses (nov-2026 a mar-2027) al abrir, pero el calendario llega a dic-2027 y se mueve con la barra de desplazamiento horizontal (--tw en .vg-wide .gt).
