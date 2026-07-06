# Fases 2–5 — Roadmap largo plazo
> Prerrequisito: Sprints 1–5 completados al 100%
> Estas fases requieren decisiones de arquitectura antes de implementar.

---

## Fase 2 — Panel del estudio contable
> Prioridad: Alta | Impacto comercial: diferenciador único frente a competencia

Esta fase es lo que convierte ContApp de "software de contabilidad" a "software de gestión del estudio contable". Ningún competidor chileno tiene algo equivalente.

### F2.1 — Panel global de clientes

Vista maestra que reemplaza al selector de empresa actual. Muestra todos los clientes con:
- Estado de avance contable del período (% de módulos con datos ingresados)
- Alertas de vencimientos próximos por cliente
- Último acceso al cliente
- Indicador de sincronización (local/nube)

**Estructura de datos nueva:**
```js
// Por cliente, por período
{
  clienteId, periodo,
  avance: {
    compras: true,    // ¿tiene datos?
    ventas: true,
    diario: false,
    remuneraciones: false,
  },
  ultimaModificacion: ISO,
}
```

### F2.2 — Pipeline Kanban por período

Tablero por cliente/mes con columnas: Pendiente → En Proceso → Por Revisar → Cerrado.
El contador arrastra la tarjeta del cliente al cerrar el mes.

**Lo más importante:** cuando un cliente está en "Cerrado" de un período, el sistema puede generar automáticamente el informe de auditoría del período (integración con Sprint 1).

### F2.3 — Calendario de obligaciones tributarias

Calendario mensual con las fechas fijas del SII chileno:
- F29: día 12/20 de cada mes (depende del giro)
- F22: abril de cada año
- DJ 1879: marzo de cada año
- Cotizaciones previsionales: día 10-13 de cada mes
- IVA: mismo que F29

Las alertas se calculan automáticamente a partir de la fecha actual y se muestran como badges sobre las tarjetas de cada cliente en el panel global.

**Sin backend necesario:** las fechas son fijas y conocidas. Solo requiere lógica de cálculo y almacenamiento en localStorage.

### F2.4 — Time tracking

Registro de tiempo trabajado por cliente:
- Start/Stop timer por cliente activo
- Resumen semanal/mensual de horas
- Tarifa hora configurable por cliente
- Exportación a Excel para facturación

**Estructura simple:**
```js
// localStorage: core_timetrack
[{ clienteId, inicio, fin, descripcion, minutos }]
```

### F2.5 — Honorarios del estudio

Módulo para que el estudio contable emita sus propias facturas a sus clientes, separado de la contabilidad de cada cliente. Integra con time tracking para facturar automáticamente.

---

## Fase 3 — Automatización tributaria SII
> Prioridad: Alta (competidores la tienen) | Complejidad: Muy alta | Requiere: backend

Esta es la brecha más grande frente a Defontana, Siigo y SoftwareUno. Sin SII integration, hay trabajo manual que los competidores ya automatizan.

### F3.1 — Descarga RCV del SII

**Estrategia actual:** `sii-rcv.js` ya existe y tiene lógica de parser. El problema es CORS — el SII no permite requests directos desde el browser.

**Solución necesaria:** un proxy backend (Cloud Function en Firebase o un servidor pequeño) que reciba las credenciales del SII y descargue el RCV en nombre del usuario.

**Decisión de arquitectura previa:** ¿credenciales guardadas en Firestore (riesgo de seguridad) o ingresadas cada vez por el usuario (mejor UX de seguridad)? Definir antes de implementar.

### F3.2 — Generación de libros electrónicos

Exportación de Libro de Compras y Ventas en formato XML validado por el SII (esquema `LCCV`). El XML debe poder subirse directamente al sitio del SII.

**Prerequisito técnico:** conocer el esquema XML actual del SII (puede haber cambiado desde 2024). Verificar en la documentación oficial antes de codificar.

### F3.3 — Prellenado automático del F29

Con los datos del Libro de Compras y Ventas ya en el sistema, el F29 se puede pre-llenar automáticamente. El modelo 29 del SII tiene campos específicos que mapean 1:1 con los datos disponibles.

**No es declaración automática** (eso requiere certificado digital). Es pre-llenado para que el contador solo revise y declare manualmente.

### F3.4 — Timbrado DTE (Factura Electrónica)

La funcionalidad más compleja. Requiere:
- Certificado digital del contribuyente (`.pfx`/`.p12`)
- CAF (Código de Autorización de Folios) del SII
- Firma digital del XML
- Envío al SII y acuse de recibo

**Recomendación:** usar una API de terceros (Bsale, Defontana API, o Haulmer) en lugar de implementar el protocolo DTE completo. El protocolo es complejo y cambia frecuentemente.

---

## Fase 4 — Colaboración y escala
> Prioridad: Media | Prerrequisito: Fase 3

### F4.1 — Notificaciones push
- Vencimiento de obligaciones tributarias (F29, cotizaciones)
- Tarea asignada a un asistente
- Documento nuevo subido por cliente

**Tecnología:** Firebase Cloud Messaging (FCM) ya está disponible en el stack.

### F4.2 — App móvil nativa
Convertir la PWA actual a app nativa con Capacitor. El código JS existente es reutilizable. Los módulos críticos para móvil: ingreso de boletas, ver dashboard, aprobar asientos.

**Advertencia:** la UX actual está optimizada para desktop. Antes de Capacitor, rediseñar las vistas principales para ser mobile-friendly.

### F4.3 — Portal del cliente
Vista de solo lectura para que el propio cliente del estudio revise sus estados financieros. Acceso con email/contraseña separado del acceso del contador. Solo puede ver reportes, no modificar datos.

### F4.4 — API pública REST
Endpoints para integrar ContApp con ERP de los clientes (SAP, Oracle, sistemas propios). Requiere diseño de autenticación OAuth + rate limiting.

---

## Fase 5 — Inteligencia financiera
> Prioridad: Baja | Prerrequisito: Fases 3 y 4 | Depende de volumen de datos

### F5.1 — Análisis predictivo de flujo de caja
Con suficiente historial (12+ meses), proyectar los próximos 3 meses usando el patrón histórico. Mostrar en el dashboard como gráfico de proyección.

**Tecnología:** no necesita ML complejo. Una regresión lineal o promedio móvil sobre los datos históricos ya es útil. Claude API puede ayudar con el análisis narrativo.

### F5.2 — Benchmarking sectorial
Comparar los ratios financieros del cliente (liquidez, endeudamiento, rentabilidad) con promedios del rubro. Requiere base de datos externa de promedios por sector CIIU.

### F5.3 — Alertas inteligentes de IA
Con el historial contable completo, Claude puede detectar:
- Anomalías en gastos (gasto de "Publicidad" triplicado sin aumento en ventas)
- Cambios de tendencia (margen bajando 3 meses consecutivos)
- Inconsistencias tributarias (IVA no coincide con ventas declaradas)

**Integración:** ampliar `ia.js` con un modo de "análisis proactivo" que el contador puede ejecutar antes de cerrar el período.

---

## Deuda técnica a resolver antes de Fase 3

Estos problemas de arquitectura deben resolverse **antes** de escalar a Fase 3:

1. **Migrar localStorage → IndexedDB** — el límite de ~5MB de localStorage no escala con años de datos contables. IndexedDB soporta gigabytes.

2. **Backend proxy para SII** — definir arquitectura (Cloud Functions vs servidor propio), seguridad de credenciales, y costos.

3. **IA en web (sin Electron)** — actualmente `ia.js` solo funciona en Electron. Para la versión web necesita un endpoint propio que llame a Claude API sin exponer la key al cliente.

4. **Modelo de pago** — conectar webhook de Stripe/Transbank. El sistema ya tiene la estructura (`estado: 'pendiente_pago'` en Firestore) pero el webhook nunca cambia ese estado.
