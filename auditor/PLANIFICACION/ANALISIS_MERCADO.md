# Análisis de mercado — ContApp Auditor vs competencia
> Fecha: 2026-06-25 | Objetivo: evaluación honesta, sin autoengaño

---

## Resumen ejecutivo

ContApp Auditor tiene **3 ventajas reales y únicas** frente al mercado chileno. Tiene también **2 brechas críticas** que los competidores cubren y que son expectativa mínima del mercado. El resto del README sobreestima el estado actual de algunas features.

---

## Ventajas genuinas (conservar y potenciar)

### 1. Glosa en lenguaje natural → asiento contable
**Esto no lo tiene nadie.** Defontana, Siigo, SoftwareUno, ContaCloud — todos requieren que el contador elija cuenta, subclasificación y monto manualmente. ContApp procesa "pagué 50.000 de arriendo" y genera el asiento completo.

Es el feature más difícil de copiar porque requiere IA entrenada en contabilidad chilena. Es el diferenciador central del producto. Hay que protegerlo y mejorarlo antes que cualquier otra cosa.

**Riesgo:** actualmente solo funciona en Electron (no en la versión web/PWA). Si el contador usa el browser, la IA no existe. Esto limita gravemente el diferencial.

### 2. Orientado al contador, no a la empresa
**Modelo de negocio correcto.** Todos los competidores venden por empresa: el cliente paga y el contador es solo un usuario. ContApp vende al contador (multi-cliente): el contador paga una vez y gestiona todas sus empresas.

Esto es una ventaja comercial y de modelo, no solo técnica. Un estudio contable de 50 clientes paga una sola suscripción. En Defontana pagarían 50 suscripciones.

**Riesgo:** el modelo de pago no está conectado (ver deuda técnica). Actualmente nadie paga nada.

### 3. Offline-first real
**Diferenciador práctico.** En Chile, especialmente fuera de Santiago, hay problemas de conectividad. Un software que sigue funcionando sin internet y sincroniza cuando hay conexión es una ventaja real.

**Riesgo:** localStorage no escala. Con 2+ años de datos de un cliente activo, puede colapsar. La migración a IndexedDB es necesaria antes de que esto sea un problema real.

---

## Brechas críticas frente al mercado (resolver en Fase 3)

### Brecha 1 — Sin DTE (Factura Electrónica)
**Estado del mercado:** Defontana, Siigo, SoftwareUno, ContaCloud — todos emiten DTE. En Chile desde 2017 la factura electrónica es obligatoria para empresas. Esto significa que ningún cliente grande puede prescindir de otro software de facturación.

**Impacto comercial:** El contador usa ContApp para la contabilidad y otro software para facturar. Esto hace que ContApp sea complementario, no principal. Para ser el software principal del estudio, debe emitir DTE.

**Honestidad:** el README dice "🔜 Fase 3" para DTE. Correcto. Pero es la brecha más grande del producto.

### Brecha 2 — Sin integración real con SII
**Estado del mercado:** descarga automática de RCV, libros electrónicos en XML, prellenado de F29 — esto es expectativa mínima en el mercado chileno en 2026.

**Impacto:** el contador debe descargar el RCV del SII manualmente y subirlo al sistema. Esto duplica el trabajo exactamente donde el software debería ahorrar tiempo.

**Honestidad:** `sii-rcv.js` existe y tiene un parser, pero sin el proxy backend para saltar CORS, es manual. La "integración SII" del README es aspiracional, no real todavía.

---

## Afirmaciones del README que se deben revisar

### "IA integrada ✅ Funcional"
**Parcialmente correcto.** La IA funciona en Electron (desktop). En la versión web/PWA, `ia.js` muestra: "IA solo disponible en la app de escritorio." Si el contador usa el browser (que es la mayoría), no hay IA. El README debería aclarar esto.

### "Búsqueda global ✅ Funcional"
**Correcto.** Ctrl+K funciona. Pero busca solo en los datos del cliente activo. No busca entre todos los clientes del estudio. Para un contador con 50 clientes buscando un RUT específico, esto es una limitación.

### "Exportación ✅ Funcional"
**Correcto, con asterisco.** PDF y Excel funcionan para la mayoría de los módulos. Pero la DJ 1879 no tiene exportación (Sprint 4 la agrega). El estado del README sobreestima esto.

### "Clientes / Proveedores — consulta SII ✅ Funcional"
**Incorrecto.** `consultarSII()` intenta hacer una búsqueda que falla por CORS en la versión web. El botón existe pero no funciona de forma fiable. Debería marcarse como 🔜 o eliminarse hasta tener el proxy.

---

## Comparación honesta con competencia directa

| Característica | ContApp | Defontana | SoftwareUno | ContaCloud |
|---|---|---|---|---|
| Glosa lenguaje natural | ✅ Único | ❌ | ❌ | ❌ |
| Multi-cliente desde una cuenta | ✅ | ❌ | ❌ | Limitado |
| Offline-first | ✅ | ❌ | ❌ | ❌ |
| IA integrada (web) | ❌ Solo desktop | ❌ | ❌ | ❌ |
| DTE / Factura electrónica | ❌ Fase 3 | ✅ | ✅ | ✅ |
| Integración SII (descarga RCV) | 🔜 Con proxy | ✅ | ✅ | ✅ |
| Libros electrónicos XML | ❌ Fase 3 | ✅ | ✅ | ✅ |
| F29 auto desde libros | ❌ Fase 3 | ✅ | ✅ | Parcial |
| Panel del estudio (Kanban/agenda) | 🔜 Fase 2 | ❌ | ❌ | ❌ |
| Depreciación acelerada SII | ✅ | ✅ | ✅ | Parcial |
| Remuneraciones completo | ✅ | ✅ (Buk) | ✅ | Parcial |
| Precio | Sin conectar | $60-150 USD/mes | $20-50 USD/mes | $30-80 USD/mes |

---

## Posicionamiento recomendado

**No competir en todo.** El mercado ya tiene software con DTE y SII. ContApp no va a ganar por ser "otro Defontana más barato".

**El nicho ganador:** estudios contables pequeños y medianos (1-5 contadores, 10-100 clientes) que:
- Hacen todo en Excel + un software caro que no los considera como usuario principal
- Necesitan gestionar muchos clientes desde un solo lugar
- Quieren IA que procese glosas, no ingresar datos a mano
- No tienen tiempo para la burocracia de configurar software enterprise

**El mensaje correcto para ese nicho:**
> "El único software pensado para el contador, no para la empresa."

**Lo que hay que tener para ese nicho:**
1. ✅ Sprints 1-5 (completitud básica)
2. ✅ Fase 2 (panel del estudio = diferenciador)
3. 🔜 IA en web (sin Electron)
4. 🔜 Modelo de pago activo
5. Eventualmente: DTE básico (solo para no ser excluido de conversaciones)

---

## Riesgos del producto

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| localStorage se satura con datos de un cliente grande | Alta (>12 meses de uso) | Alto | Migrar a IndexedDB antes de Fase 3 |
| Claude API cambia precios o disponibilidad | Media | Alto | Diseñar abstracción de proveedor IA |
| SII cambia esquema XML/protocolo DTE | Alta (histórico) | Alto | Usar API de terceros para DTE |
| Competidor agrega IA de glosas | Baja (difícil) | Alto | Mantener ventaja con más features IA |
| Modelo de pago nunca se conecta | Alta (riesgo actual) | Muy alto | Definir fecha límite para conectar webhook |
