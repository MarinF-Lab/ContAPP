# ContApp Auditor

> Sistema de contabilidad SaaS multi-cliente para estudios contables chilenos.

---

## ¿Qué es ContApp Auditor?

ContApp Auditor es una aplicación web progresiva (PWA) que permite a contadores llevar la contabilidad de múltiples clientes desde un solo panel. Funciona offline-first con sincronización automática a Firebase, y cubre tanto **1ª Categoría** (contabilidad completa) como **2ª Categoría** (honorarios / freelancers).

No requiere instalación: abre en el navegador, o instala como PWA de escritorio. Todos los datos se guardan localmente y se sincronizan en la nube cuando hay conexión.

---

## Módulos implementados

### Contabilidad (1ª Categoría)

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Libro Diario** | ✅ Funcional | Procesa glosas en lenguaje natural → asientos contables. Asiento manual con autocompletar. Editar y anular asientos. |
| **Libro Mayor** | ✅ Funcional | Libro T por cuenta con saldos y movimientos acumulados. |
| **Plan de Cuentas** | ✅ Funcional | Catálogo personalizable. Agregar, editar, activar/desactivar cuentas. |
| **Conciliación Bancaria** | ✅ Funcional | Importa extractos bancarios, empareja automáticamente con el diario, liga/desliga manualmente. |
| **Activos Fijos** | ✅ Funcional | Registro de bienes con depreciación lineal y acelerada (SII). Genera asiento de depreciación mensual. |
| **Cartolas Bancarias** | ✅ Funcional | Importa CSV/XLSX de 7 bancos chilenos. Clasifica movimientos a cuentas contables. |

### Reportes Financieros

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Balance de Comprobación** | ✅ Funcional | 8 columnas: sumas del debe/haber, saldos deudores/acreedores, inventario, resultados. |
| **Balance Clasificado** | ✅ Funcional | Balance ordenado por liquidez (activo circulante → no circulante → pasivo → patrimonio). |
| **Estado de Resultados** | ✅ Funcional | Ingresos, costos, gastos, utilidad bruta, utilidad neta con tasa de impuesto configurable. |
| **Flujo de Caja** | ✅ Funcional | Clasificación automática en operacional, inversión, financiamiento. |
| **Dashboard** | ✅ Funcional | KPIs (activos, pasivos, ingresos, resultado), gráficos de barras y donut, liquidez, top cuentas. |

### Comercial / SCM

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Libro de Compras** | ✅ Funcional | Formato SII: factura, NC, ND, guía. CRUD completo. Asiento centralizado mensual. Resumen IVA CF. |
| **Libro de Ventas** | ✅ Funcional | Formato SII: factura, boleta, NC, ND, exentos. CRUD completo. Asiento centralizado. Resumen F29. |
| **Documentación** | ✅ Funcional | Registro de facturas, boletas y honorarios recibidos. Estados: pendiente / pagado / anulado. |
| **Productos y Servicios** | ✅ Funcional | Catálogo con precio costo, precio venta, margen en tiempo real, descripción larga, proveedor habitual. |
| **Clientes / Proveedores** | ✅ Funcional | Directorio CRM con saldo histórico, transacciones, consulta SII. |

### RRHH / HRM

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Remuneraciones** | ✅ Funcional | Nómina completa: liquidaciones, vacaciones, finiquitos, Previred CSV, boleta PDF. |

### Tributario / TAX

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Indicadores Económicos** | ✅ Funcional | UF, UTM, IPC, TPM, tipo de cambio. Tasas AFP/Salud/SIS de Previred. |
| **Resumen IVA / F29** | ✅ Funcional | Cruce débito fiscal vs crédito fiscal. Remanente IVA con reajuste UTM. |

### 2ª Categoría Tributaria (Honorarios / Freelance)

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Libro de Honorarios** | ✅ Funcional | Emisión y registro de boletas de honorarios. |
| **Libro de Ingresos** | ✅ Funcional | Registro de ingresos percibidos. |
| **Libro de Egresos** | ✅ Funcional | Registro de gastos deducibles. |
| **Cotizaciones Previsionales** | ✅ Funcional | Estimación AFP, Salud, SIS (base 80%). |
| **F29** | ✅ Funcional | PPM voluntario + retenciones del período. |
| **F22** | ✅ Funcional | Estimación impuesto anual (IGC). |
| **DJ 1879** | ✅ Funcional | Declaración de honorarios pagados a terceros. |

### Sistema / Infraestructura

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Autenticación** | ✅ Funcional | Login/registro con Firebase Auth. Invitaciones con código de 6 caracteres. |
| **Multi-empresa** | ✅ Funcional | Una cuenta puede gestionar múltiples empresas. |
| **Roles y Permisos** | ✅ Funcional | Admin, Contador, Asistente, Solo lectura. |
| **Sync Firebase** | ✅ Funcional | Sincronización automática en la nube. Offline-first con localStorage. |
| **Exportación** | ✅ Funcional | PDF con encabezado profesional, Excel (SheetJS), impresión. |
| **IA integrada** | ✅ Funcional | Procesamiento de glosas, OCR de facturas, análisis de reportes, auditoría contable, chat. |
| **Búsqueda Global** | ✅ Funcional | Ctrl+K — busca en asientos, compras, ventas, contactos, productos, activos. |
| **Tema claro/oscuro** | ✅ Funcional | Toggle en el header. |
| **PWA** | ✅ Funcional | Instalable como app de escritorio / móvil. |

---

## Próximas funcionalidades (Roadmap)

### Fase 1 — Núcleo robusto *(en progreso)*

- [ ] **Reglas de clasificación automática** — Motor de reglas keyword→cuenta para auto-clasificar movimientos de cartolas bancarias
- [ ] **Inventario básico** — Control de stock, movimientos de entrada/salida, alertas de stock mínimo
- [ ] **Pulido general** — Ver sección "Estado actual" más abajo

### Fase 2 — Panel de gestión del estudio

- [ ] **Panel global de clientes** — Vista consolidada de todos los clientes con estado de avance contable por período
- [ ] **Pipeline Kanban por período** — Tablero de tareas: "Pendiente → En proceso → Por revisar → Cerrado" por cliente/mes
- [ ] **Calendario de obligaciones tributarias** — Alertas automáticas: vencimiento F29, F22, DJ, PPM, cotizaciones
- [ ] **Time tracking** — Registro de horas trabajadas por cliente para facturación del estudio
- [ ] **Honorarios del estudio** — Módulo para emitir y cobrar a los clientes del estudio contable

### Fase 3 — Automatización tributaria

- [ ] **Integración SII completa** — Descarga automática de RCV, DTE, libros electrónicos
- [ ] **Certificado digital** — Firma de documentos tributarios con .pfx/.p12
- [ ] **Generación de libros electrónicos** — Exportación en formato XML validado por SII
- [ ] **Declaración F29 automática** — Prellenado desde los libros de compras/ventas
- [ ] **Timbrado DTE** — Generación de documentos tributarios electrónicos (Factura Electrónica, Boleta Electrónica)

### Fase 4 — Colaboración y escala

- [ ] **Notificaciones push** — Alertas en tiempo real para vencimientos y tareas asignadas
- [ ] **App móvil nativa** — Capacitor/Expo para iOS/Android
- [ ] **API pública** — Endpoints REST para integrar con ERP de clientes
- [ ] **Portal del cliente** — Vista de solo lectura para que el cliente revise sus estados financieros
- [ ] **Facturación recurrente** — Cobro automático a clientes con cargo mensual

### Fase 5 — Inteligencia financiera

- [ ] **Análisis predictivo** — Proyección de flujo de caja con ML
- [ ] **Benchmarking sectorial** — Comparar ratios financieros con promedios del rubro
- [ ] **Alertas inteligentes de IA** — Anomalías contables, cambios de tendencia, riesgos tributarios
- [ ] **Conciliación automática** — Match 100% automático de cartola vs diario con IA

---

## Comparación con software contable existente

| Característica | **ContApp Auditor** | Buk | Defontana | Siigo | ContaCloud | SoftwareUno |
|---|---|---|---|---|---|---|
| **Precio** | SaaS por contador (multi-cliente) | Por trabajador | Por empresa | Por empresa | Por empresa | Por empresa |
| **1ª y 2ª Categoría** | ✅ Ambas | ❌ Solo nómina | ✅ | ✅ | ✅ | ✅ |
| **Glosa en lenguaje natural → asiento** | ✅ Nativo + IA | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-empresa desde una cuenta** | ✅ | ❌ | ❌ | ❌ | Limitado | ❌ |
| **Offline-first** | ✅ localStorage + sync | ❌ Online only | ❌ | ❌ | ❌ | ❌ |
| **IA integrada** | ✅ OCR, análisis, auditoría, chat | Limitado (Buk IA) | ❌ | ❌ | ❌ | ❌ |
| **Búsqueda global** | ✅ Ctrl+K | Parcial | ❌ | ❌ | ❌ | ❌ |
| **Panel del estudio contable** | 🔜 Fase 2 | N/A | ❌ | ❌ | ❌ | ❌ |
| **Importar cartolas bancarias** | ✅ 7 bancos, CSV+XLSX | ❌ | ✅ | Limitado | ✅ | ✅ |
| **Libro de remuneraciones** | ✅ Completo | ✅ | ✅ | ✅ | Parcial | ✅ |
| **Depreciación acelerada SII** | ✅ | ❌ | ✅ | ✅ | Parcial | ✅ |
| **Integración SII RCV** | 🔜 Fase 3 | ❌ | ✅ | ✅ | ✅ | ✅ |
| **DTE / Factura Electrónica** | 🔜 Fase 3 | ❌ | ✅ | ✅ | ✅ | ✅ |
| **F29 automático** | 🔜 Fase 3 | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Time tracking** | 🔜 Fase 2 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Precio estimado** | < $30 USD/mes | $8 USD/trabajador | $60-150 USD/mes | $40-90 USD/mes | $30-80 USD/mes | $20-50 USD/mes |
| **Fuente abierta / customizable** | Parcial | ❌ | ❌ | ❌ | ❌ | ❌ |

**Ventaja diferencial de ContApp Auditor:**
- Único con glosa en lenguaje natural como flujo principal de ingreso
- Único con IA integrada profundamente (no como add-on)
- Único orientado al **contador** (multi-cliente) en lugar de a la empresa
- Offline-first real: funciona sin internet, sincroniza cuando hay conexión
- Precio por estudio (ilimitado clientes) vs precio por empresa

---

## Stack tecnológico

- **Frontend**: HTML5 + CSS3 + JavaScript ES6+ (vanilla, sin frameworks)
- **Persistencia local**: localStorage (primary), IndexedDB (futuro)
- **Cloud**: Firebase Auth + Firestore
- **IA**: Anthropic Claude API (claude-haiku-4-5 para tareas rápidas, claude-sonnet-4-6 para análisis)
- **PWA**: Service Worker, Web App Manifest
- **Exportación**: jsPDF, SheetJS (xlsx), browser print API
- **Gráficos**: SVG generado programáticamente (sin dependencias)
- **Bancos**: Parsers propios para CSV/XLSX de 7 bancos chilenos

---

## Estructura del proyecto

```
auditor/
├── index.html                  # SPA principal (20+ vistas)
├── manifest.json               # PWA manifest
├── css/
│   ├── variables.css           # Tokens de diseño (colores, spacing)
│   ├── main.css                # Estilos globales y componentes
│   ├── auditor.css             # Componentes especializados
│   └── remuneraciones.css      # Estilos del módulo RRHH
└── js/
    ├── core/                   # Lógica compartida
    │   ├── db.js               # Wrapper SQLite/localStorage
    │   ├── contabilidad.js     # Lógica contable compartida
    │   ├── helpers.js          # Formato, IVA, UF/UTM, validaciones
    │   ├── parser.js           # Parser de glosas
    │   ├── plan-cuentas.js     # Catálogo de cuentas
    │   ├── autocomplete.js     # Sugerencias de campos
    │   ├── busqueda-global.js  # Búsqueda Ctrl+K
    │   └── parser-sii.js       # Parser XML del SII
    ├── services/               # Servicios de app
    │   ├── app.js              # Navegación SPA, configuración
    │   ├── firebase-service.js # Auth y sync Firebase
    │   ├── auth-manager.js     # Wizard de registro y empresas
    │   ├── diario.js           # Libro diario
    │   ├── mayor.js            # Libro mayor
    │   ├── balance.js          # Balance de comprobación
    │   ├── balance-clasificado.js
    │   ├── estado-resultados.js
    │   ├── flujo-caja.js
    │   ├── reconciliacion.js   # Conciliación bancaria
    │   ├── iva-resumen.js      # F29 / IVA
    │   ├── dashboard.js        # KPIs y gráficos
    │   ├── indicadores.js      # UF, UTM, Previred
    │   ├── exportar.js         # PDF, Excel, impresión
    │   ├── sii-rcv.js          # RCV del SII
    │   ├── ia.js               # IA: glosas, OCR, análisis
    │   ├── audit.js            # Log de cambios
    │   └── permisos.js         # Roles y control de acceso
    ├── modules/                # Módulos de vistas
    │   ├── compras.js          # Libro de compras
    │   ├── ventas.js           # Libro de ventas
    │   ├── clientes.js         # CRM contactos
    │   ├── productos.js        # Catálogo productos
    │   ├── activos.js          # Activos fijos
    │   ├── cartolas.js         # Cartolas bancarias
    │   ├── documentos.js       # Documentación
    │   ├── remuneraciones.js   # RRHH nóminas
    │   └── segunda-categoria.js# 2ª Categoría tributaria
    └── categorias/             # Configuración por categoría
        ├── primera.js          # 1ª Categoría: módulos y menú
        └── segunda.js          # 2ª Categoría: módulos y menú
```
