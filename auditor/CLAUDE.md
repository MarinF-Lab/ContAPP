# ContApp Auditor — Protocolo de trabajo para Claude Code

---

## ⚡ INICIO DE SESIÓN — leer esto primero, siempre

```
1. Leer PLANIFICACION/INTEGRACION_DISENO.md → sección "Pendientes / próximo paso"
2. Ejecutar: node PLANIFICACION/verificar.js
3. Comenzar la tarea indicada
```

No escribas código sin haber leído INTEGRACION_DISENO.md. No asumas el estado del código — verifícalo.

> Nota: `PROGRESO.md` (el doc "vivo" de sprints anteriores) se eliminó a propósito — esos sprints
> ya cumplieron su propósito. Mientras dure la integración de diseño, `INTEGRACION_DISENO.md` es
> el doc vivo de referencia.

---

## 🔁 LOOP DE TRABAJO — repetir tras cada tarea completada

```
[ HACER TAREA ]
      ↓
[ VERIFICAR ]
  node PLANIFICACION/verificar.js
  revisión visual en browser contra PLANIFICACION/diseno/referencia-contapp-consola.html (ver INTEGRACION_DISENO.md)
      ↓
[ ¿Coincide con el diseño? ]
  NO → arreglar y volver a verificar
  SÍ → continuar
      ↓
[ ACTUALIZAR INTEGRACION_DISENO.md ]
  - Marcar paso ✅ con fecha de hoy
  - Actualizar sección "Pendientes / próximo paso"
      ↓
[ INFORMAR AL USUARIO con el próximo paso ]
      ↓
[ ESPERAR CONFIRMACIÓN o continuar al siguiente ítem ]
```

---

## Reglas obligatorias

- **Referencia de diseño (desde 2026-11): `PLANIFICACION/diseno/referencia-contapp-consola.html`** — carcasa visual "ContApp Consola"
  (artefacto aprobado por el usuario). Reemplaza a `new desing.html`, que ya no está en el repo.
  Mientras dure el rediseño tiene prioridad sobre cualquier otra instrucción de planificación previa;
  si migrar el diseño requiere tocar un módulo, se toca.
- **Decisiones de diseño aprobadas (2026-11):** paleta del logo (claro: gris niebla `#DCE3E9`,
  superficie `#EEF2F5`, tinta `#0F1B26`, acero `#8FA5B3`, magenta `#A03A63`; oscuro: navy `#131D2A`,
  rosa neón `#FF5A8A`) con contraste AA verificado · fuentes actuales (Space Grotesk / Manrope /
  IBM Plex Mono) · la consola **"¿Qué quieres hacer hoy?"** va **encima** del centro de mando, no
  lo reemplaza · íconos SVG en vez de emoji.
- **Solo capa visual:** el rediseño no cambia lógica contable; `verificar.js` y
  `test-fase0..3.js` deben seguir pasando en cada etapa.
- **No usar** `alert()`, `confirm()` ni `console.log()` en código nuevo
  - Notificaciones → `mostrarToast(mensaje, tipo)`
  - Confirmaciones destructivas → `mostrarConfirm(mensaje, callback)`
- **No marcar un paso como completado** sin pasar `verificar.js` y sin confirmar visualmente en
  browser que coincide con `PLANIFICACION/diseno/referencia-contapp-consola.html`
- **Si algo no coincide con el diseño**, dejarlo explícito en `INTEGRACION_DISENO.md` en vez de
  darlo por terminado

---

## Stack — no instalar dependencias nuevas

- Vanilla JS ES6+ (sin frameworks)
- jsPDF y SheetJS disponibles globalmente vía CDN
- Firebase Auth + Firestore vía CDN
- CSS: `css/variables.css` para tokens, `css/main.css` para componentes globales

---

## Mapa de archivos

```
js/core/       → helpers, db, parser, plan-cuentas
js/services/   → diario, mayor, balance, dashboard, IA…
js/modules/    → compras, ventas, clientes, activos…
js/auditor/    → hallazgos, informe-auditoria, multi-cliente, licencia
css/           → variables.css, main.css, módulos
PLANIFICACION/ → INTEGRACION_DISENO.md (estado vivo), verificar.js
```

---

## Verificación — comandos exactos

```bash
# 1. Verificación estática + pruebas de conectividad (Fases 0-3)
node PLANIFICACION/verificar.js
for t in 0 1 2 3; do node PLANIFICACION/test-fase$t.js; done

# 2. Servidor local para revisión visual
npx serve . -p 8080
```

> Nota: la suite de Playwright (`PLANIFICACION/tests/`) probaba la navegación anterior (sidebar
> G1-G5) y se eliminó junto con esa arquitectura — ver `INTEGRACION_DISENO.md`. La verificación
> mientras dure el rediseño es `verificar.js` + pruebas de fase + comparación visual contra
> `PLANIFICACION/diseno/referencia-contapp-consola.html` y contra la línea base `PLANIFICACION/diseno/linea-base/` (capturas del antes).

---

## Diseño UI — checklist mientras dure la integración

Comparar visualmente en el browser contra `PLANIFICACION/diseno/referencia-contapp-consola.html` antes de marcar un paso como completo — no
contra una guía de estilo aparte (la referencia misma es la guía). Plan por etapas y estado en
`PLANIFICACION/INTEGRACION_DISENO.md` (sección "Rediseño 2026-11"); hallazgos de la auditoría
inicial en `PLANIFICACION/diseno/LINEA_BASE_DISENO.md`.

Skills de diseño instaladas en el entorno (script de configuración): `frontend-design` (dirección
visual), `ui-ux-pro-max` (contraste, accesibilidad, patrones), `web-design-guidelines` (revisión de
reglas de interfaz), `emil-design-eng` / `review-animations` (interacción y movimiento),
`mobile-native` (uso en celular).

---

## Frase de inicio de sesión estándar

> "Trabaja en ContApp Auditor. Lee INTEGRACION_DISENO.md, identifica el próximo paso pendiente, ejecuta verificar.js y comienza. Sigue el loop de trabajo hasta que el usuario diga stop."

---

## Skill routing — optimización con gstack

Antes de cada tarea, elige el skill correcto. Llamar al skill vía la herramienta Skill ANTES de generar código o análisis.

| Si el usuario pide… | Skill a invocar |
|---------------------|----------------|
| Planificar feature / arquitectura | `/plan-eng-review` |
| Revisar idea de producto / UX | `/office-hours` |
| QA / probar que algo funciona | `/qa` |
| Bug / error inesperado | `/investigate` |
| Revisar diff / PR | `/review` o `/code-review` |
| Revisar diseño visual | `/design-review` |
| Crear spec / issue backlog | `/spec` |
| Guardar contexto antes de cerrar | `/context-save` |
| Retomar sesión anterior | `/context-restore` |
| Pipeline completo (CEO+eng+design) | `/autoplan` |

### Reglas de aplicación

- **Bugs/errores** → invocar `/investigate` antes de leer código. Evita buscar a ciegas.
- **Features nuevas** → invocar `/plan-eng-review` antes de codear. Evita reescrituras.
- **QA de UI** → invocar `/qa` después de implementar. Confirma antes de reportar como completado.
- **Cambios grandes** (>3 archivos o nueva arquitectura) → invocar `/autoplan` primero.
- **Al terminar una sesión larga** → invocar `/context-save` para no perder estado.

### Loop optimizado con skills

```
[ RECIBIR TAREA ]
      ↓
[ ELEGIR SKILL según tabla ]
      ↓
[ EJECUTAR SKILL (plan/investigate/etc.) ]
      ↓
[ IMPLEMENTAR con loop de trabajo de arriba ]
      ↓
[ /qa para verificar ]
      ↓
[ ACTUALIZAR INTEGRACION_DISENO.md ]
```
