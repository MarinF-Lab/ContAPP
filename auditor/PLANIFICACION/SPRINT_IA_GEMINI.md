# Sprint IA — Integración Google Gemini
> Estado: PLANIFICADO | Fecha: 2026-06-26 | Prerrequisito: Sprints 1-5 ✅ + Fase 2 ✅
> Objetivo: reemplazar el código de IA mezclado por una integración limpia de Gemini gratuito.

---

## Problema que resuelve

El código de IA actual tiene dos archivos en conflicto (`ia.js` con Claude/Electron y `ia-gemini.js` con Gemini REST) que se solapan mediante un hack de anulación de funciones. La key almacenada proviene de un proyecto de Google con cuota agotada. El contador no puede usar las funciones de IA.

---

## Objetivo de negocio

Dar al contador acceso a funciones de IA útiles para su trabajo diario, sin costo adicional (Gemini free tier: 60 req/min), integradas directamente en los flujos que ya usa:
- Libro Diario → sugerencia de cuenta para la glosa
- Configuración → gestión de key
- Informe de Auditoría → párrafo de conclusión generado

---

## Paso 0 — Limpieza (hacer antes que nada)

### Archivos a eliminar
- `js/services/ia.js` — archivo Claude/Electron (671 líneas); contiene `iaLeerFactura` (Electron IPC) que no se usa en la UI web
- `js/services/ia-gemini.js` — archivo actual de Gemini (192 líneas); tiene la lógica correcta pero heredada del proceso de prueba/error

### Referencias a limpiar en `index.html`
- Quitar `<script src="js/services/ia.js"></script>`
- Quitar `<script src="js/services/ia-gemini.js"></script>`
- Agregar `<script src="js/services/ia.js"></script>` (el archivo nuevo, limpio)
- La card de configuración IA ya existe — mantener su estructura

### Referencias a limpiar en `js/services/app.js`
- Función `navegarA()` llama a `_iaAdaptarUISegunEntorno` y luego `iaVerificarKeyAlCargar` — simplificar a solo `iaVerificarKeyAlCargar()`

---

## Paso 1 — Arquitectura nueva: un solo archivo

### Archivo: `js/services/ia.js` (reescritura)

Un archivo. Sin dependencias de Electron. Sin duplicaciones. Sin hacks de anulación.

```
js/services/ia.js
├── Constantes
│   ├── _IA_KEY_LS = '_gemini_key'
│   └── _IA_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/...'
│
├── Gestión de key
│   ├── _iaGetKey()              — privado
│   ├── iaGuardarApiKey()        — público, lee #iaApiKeyInput
│   ├── iaBorrarApiKey()         — público, confirma antes de borrar
│   └── iaVerificarKeyAlCargar() — público, actualiza #iaKeyEstado
│
├── Llamada base
│   └── _iaConsultar(prompt)     — privado, fetch + manejo errores
│
├── Funciones de dominio contable
│   ├── iaAlertasTribu()         — obligaciones tributarias del cliente activo
│   ├── iaVerificarConsistencia() — controles entre Diario, Mayor, Balance
│   ├── iaAnalizarGlosa(texto)   — sugiere código de cuenta (retorna JSON)
│   └── iaGenerarTextoInforme(hallazgos) — párrafo de conclusión de auditoría
│
└── UI helpers
    └── _iaMostrarResultado(titulo, texto) — modal con markdown parseado
```

### Modelo Gemini a usar
`gemini-2.0-flash-lite` — más rápido y barato que flash, suficiente para texto contable.
Fallback: `gemini-1.5-flash-latest` si lite no está disponible.

### Autenticación
Header `X-goog-api-key: <key>` (no query param — confirmado que funciona con aistudio keys).

---

## Paso 2 — Integración en módulos existentes

### 2.1 — Libro Diario (`js/services/diario.js`)

**Dónde:** Modal de asiento → campo Glosa → botón "✨ Sugerir cuenta"

**Flujo:**
1. Usuario escribe glosa en el campo de texto
2. Click en botón → llama `iaAnalizarGlosa(glosa)`
3. Si retorna JSON válido → pre-llena el select de cuenta con el código sugerido
4. Toast con "Sugerencia: [código] [nombre]"

**Condición de activación:** solo si hay key guardada (revisar `_iaGetKey()` antes de mostrar el botón).

### 2.2 — Informe de Auditoría (`js/auditor/informe-auditoria.js`)

**Dónde:** Vista informe → sección "Conclusión" → botón "✨ Generar con IA"

**Flujo:**
1. Lee los hallazgos actuales del período
2. Llama `iaGenerarTextoInforme(hallazgos)`
3. Inserta el texto en el textarea de conclusión
4. Usuario puede editar antes de exportar

### 2.3 — Configuración (ya existe en `index.html`)

La card IA ya está en la vista Configuración. Solo necesita apuntar al archivo nuevo.

---

## Paso 3 — UI mínima (sin cambios de diseño nuevos)

La UI ya existe. Solo verificar que funciona:
- `#iaKeyEstado` — div que muestra estado de la key (✅ key configurada / ⚠️ sin key)
- `#iaApiKeyInput` — input password para ingresar key
- Botones "💾 Guardar Key" y "🗑 Eliminar" ya existen en HTML

---

## Tareas ordenadas

| # | Tarea | Archivo | Estimado |
|---|-------|---------|----------|
| IA-1 | Eliminar `ia.js` y `ia-gemini.js` actuales | `js/services/` | 2 min |
| IA-2 | Crear nuevo `js/services/ia.js` limpio | nuevo archivo | 20 min |
| IA-3 | Actualizar `index.html` — scripts + card IA | `index.html` | 5 min |
| IA-4 | Actualizar `app.js` — simplificar hook de navegación | `app.js` | 3 min |
| IA-5 | Integrar `iaAnalizarGlosa` en modal de Diario | `diario.js` | 15 min |
| IA-6 | Integrar `iaGenerarTextoInforme` en informe | `informe-auditoria.js` | 15 min |
| IA-7 | Verificar en browser: guardar key, alertas, consistencia | browser | 10 min |

---

## Criterios de éxito

- [ ] `iaAlertasTribu()` abre modal con texto de Gemini (no error de quota/auth)
- [ ] `iaVerificarConsistencia()` abre modal con lista de controles
- [ ] `iaAnalizarGlosa("Pago arriendo oficina")` retorna `{codigo:"6110000", nombre:"Arriendos"}`
- [ ] `iaGenerarTextoInforme([...])` retorna párrafo coherente
- [ ] Sin referencias a Claude, sk-ant, Electron IPC en el flujo de IA web

---

## Lo que NO entra en este sprint

- Integración con SII (Fase 3 — requiere confirmación explícita)
- Claude API para app desktop (puede volver en Fase 4 si hay monetización)
- IA predictiva / benchmarking (Fase 5 original — complejidad alta)
- Backend proxy para la key (scope futuro si se necesita seguridad adicional)

---

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Key de Gemini agotada por usuario | Alta (pasó) | Instrucciones claras para crear nuevo proyecto en Google AI Studio |
| Modelo `gemini-2.0-flash-lite` no responde en español | Baja | Agregar instrucción de idioma en cada prompt |
| CORS bloqueado desde Electron | Muy baja | Electron corre Chromium sin CORS para localhost |
| Rate limit en free tier (60/min) | Baja para 1 usuario | Suficiente para uso normal de 1 contador |

---

## Decision Audit Trail

| # | Decisión | Principio | Rationale |
|---|----------|-----------|-----------|
| 1 | Un solo archivo ia.js en lugar de ia.js + ia-gemini.js | P5 Explícito > ingenioso | Dos archivos con override hack = deuda técnica; un archivo = 0 ambigüedad |
| 2 | Gemini free tier en lugar de Claude API de pago | P3 Pragmático | El contador chileno típico no pagará $20/mes por API; Gemini free es suficiente para las funciones planificadas |
| 3 | No agregar backend proxy ahora | P3 Pragmático | La key en localStorage es aceptable para MVP; si el producto escala se agrega en Fase 4 |
| 4 | `iaLeerFactura` (Electron IPC) descartada | P3 Pragmático | Función nunca llegó a UX real; reintroducir en Fase 4 si hay demanda |
| 5 | Modelo `gemini-2.0-flash-lite` como primario | P1 Completeness | Más rápido, mismo resultado para texto contable; sin costo diferencial en free tier |

---

## GSTACK REVIEW REPORT

### CEO Review

**Premisa principal:** Los contadores chilenos quieren ayuda de IA para su trabajo diario, pero no pagarán más por ello.  
**Validada:** Sí — Gemini free tier elimina la barrera de precio. El diferencial es zero-friction.

**Alternativas evaluadas:**
- A) Claude API pago en Electron → descartada (barrera de precio, complejidad dual)
- B) Gemini free en web → elegida (simple, funciona, gratuita)
- C) Backend proxy con key del estudio → descartada para MVP (complejidad innecesaria)

**Scope calibration:** Correcto. 4 funciones de dominio + limpieza + integración en 2 módulos.

**6-month trajectory:** Si la key de Gemini funciona y las funciones son útiles, el contador la usa diariamente. Si no, es code debt que no pesa (un archivo, sin dependencias).

### Eng Review

**Architecture:**
```
index.html
  └── <script> js/services/ia.js (único punto de entrada IA)
        ├── _iaGetKey() → localStorage['_gemini_key']
        ├── _iaConsultar() → fetch Gemini API
        ├── iaAlertasTribu() → prompt con core_config (empresa, rut, giro)
        ├── iaVerificarConsistencia() → prompt genérico de auditoría
        ├── iaAnalizarGlosa() → prompt → JSON parse → return object
        └── iaGenerarTextoInforme() → prompt con lista de hallazgos
```

**Coupling:** Bajo. ia.js no importa nada del proyecto — lee localStorage y llama a la API. Diario.js llama `iaAnalizarGlosa()` opcionalmente.

**Test coverage:** Manual — llamar las 4 funciones con key válida y verificar respuesta.

**Security:** La key en localStorage está visible en DevTools. Aceptable para MVP usuario-único. No se envía a ningún servidor del proyecto.

**Error paths:**
- Sin key → toast informativo, no error
- API down → toast "Error de red"
- Quota exceeded → toast con mensaje de Google
- JSON inválido en `iaAnalizarGlosa` → retorna null, no rompe el flujo

### Design Review

**Estado UI:** La card de configuración ya existe y está bien diseñada. No hay cambios de diseño nuevos requeridos.

**Missing states especificados:**
- Sin key: `⚠️ Sin API key — ingresa tu key de Google AI Studio`
- Con key: `✅ Key configurada: AIza••••••••••••XXXX`
- Loading: toast "Consultando Gemini…"
- Error: toast con mensaje de error

**Integración Diario:** Botón "✨ Sugerir cuenta" visible solo si hay key. No rompe el flujo existente si no hay key.
