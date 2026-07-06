# ContApp Auditor — Protocolo de trabajo para Codex

---

## ⚡ INICIO DE SESIÓN — leer esto primero, siempre

```
1. Leer PLANIFICACION/PROGRESO.md → sección "PRÓXIMO PASO"
2. Leer el archivo del sprint activo indicado ahí
3. Ejecutar: node PLANIFICACION/verificar.js
4. Comenzar la tarea indicada
```

No escribas código sin haber leído PROGRESO.md. No asumas el estado del código — verifícalo.

---

## 🔁 LOOP DE TRABAJO — repetir tras cada tarea completada

```
[ HACER TAREA ]
      ↓
[ VERIFICAR ]
  node PLANIFICACION/verificar.js
  npx playwright test PLANIFICACION/tests/sprint-N.spec.js --config PLANIFICACION/tests/playwright.config.js
      ↓
[ ¿Pasan los tests? ]
  NO → arreglar y volver a verificar
  SÍ → continuar
      ↓
[ ACTUALIZAR PROGRESO.md ]
  - Marcar tarea ✅ con fecha de hoy
  - Actualizar barra de progreso del sprint
  - Actualizar sección "PRÓXIMO PASO"
      ↓
[ INFORMAR AL USUARIO ]
  "Tarea X.Xn completada ✅. Próximo paso: [nombre tarea]"
      ↓
[ ESPERAR CONFIRMACIÓN o continuar al siguiente ítem ]
```

---

## Reglas obligatorias

- **No agregar features nuevas** hasta que el sprint activo esté al 100%
- **No modificar** módulos marcados como "production-ready" en PLAN_MAESTRO.md salvo que el sprint lo indique
- **No usar** `alert()`, `confirm()` ni `console.log()` en código nuevo
  - Notificaciones → `mostrarToast(mensaje, tipo)`
  - Confirmaciones destructivas → `mostrarConfirm(mensaje, callback)`
- **No marcar ✅** sin pasar verificar.js Y los tests de Playwright
- **Si un test falla**, dejar estado en 🔄 y describir en PROGRESO.md qué falta

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
PLANIFICACION/ → PROGRESO.md (estado vivo), sprints, tests
```

---

## Verificación — comandos exactos

```bash
# 1. Verificación estática
node PLANIFICACION/verificar.js

# 2. Servidor local (necesario para Playwright)
npx serve . -p 8080

# 3. Tests del sprint activo (reemplazar N con número)
npx playwright test PLANIFICACION/tests/sprint-N.spec.js --config PLANIFICACION/tests/playwright.config.js

# 4. Todos los sprints a la vez
npx playwright test PLANIFICACION/tests/ --config PLANIFICACION/tests/playwright.config.js
```

---

## Bugs activos — resolver antes de avanzar en sus sprints

| Bug | Sprint | Descripción |
|-----|--------|-------------|
| BUG-2 | S2 | `mayor.js` truncado — `generarLibroMayor()` sin tabla HTML |
| BUG-3 | S1 | `audAbrirCrearHallazgo()` llamada en HTML pero no existe |
| BUG-4 | S1 | Vista `view-informe` sin enlace en sidebar |
| BUG-5 | S5 | `siiMostrarGuiaProxy()` usa `alert()` nativo |

---

## Módulos production-ready — NO tocar

Libro de Compras y Ventas · Clientes/Proveedores · Dashboard · Balance · Estado de Resultados · Auth y roles · Multi-empresa Firebase · Exportación PDF/Excel · Búsqueda global Ctrl+K · PWA · Indicadores económicos · Multi-cliente

---

## Diseño UI — checklist tras cada sprint

Leer `PLANIFICACION/DISEÑO_UI.md` y verificar visualmente en el browser antes de marcar el sprint como completo:
- Tablas con hover
- Botones con jerarquía visual (primario/secundario/destructivo)
- Paneles laterales con sombra
- Empty states consistentes
- Sidebar font-size ≥ 11px

---

## Frase de inicio de sesión estándar

> "Trabaja en ContApp Auditor. Lee PROGRESO.md, identifica el PRÓXIMO PASO, ejecuta verificar.js y comienza. Sigue el loop de trabajo hasta que el usuario diga stop."

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
[ ACTUALIZAR PROGRESO.md ]
```
