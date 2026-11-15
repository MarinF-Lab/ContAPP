# Integración de Diseño — ContApp Auditor (estado vivo)

> **Documento vivo y corto a propósito.** Se lee al iniciar cada sesión: qué se está haciendo, qué
> está decidido y cuál es el próximo paso. El registro de la integración anterior (jul-sep 2026,
> prototipo `new desing.html`) está en `archivo/HISTORIAL_INTEGRACION_2026-07_a_09.md`.

## Referencias
| Qué | Dónde |
|-----|-------|
| Diseño a seguir | `PLANIFICACION/diseno/referencia-contapp-consola.html` (artefacto "ContApp Consola") |
| Auditoría inicial y capturas del "antes" | `PLANIFICACION/diseno/LINEA_BASE_DISENO.md`, `diseno/linea-base/` |
| Conectividad entre módulos (Fases 0-3) | `PLANIFICACION/CONECTIVIDAD.md` |
| Pruebas | `npm test` · `npm run test:navegador` · `npm run test:reglas` (ver `PLANIFICACION/pruebas.js`) |

## Arquitectura vigente (resumen)
- **Navegación:** `js/services/menu.js` arma el menú desde los catálogos de módulos
  (`js/categorias/primera.js` grupos G1-G5, `segunda.js` G1-G4) filtrando por los módulos activos
  del cliente; `home-hub.js` dibuja el centro de mando de Inicio; `navegar()`/`modTab()` en `app.js`.
- **Datos por cliente:** `js/core/datos-cliente.js` (lista única de datos, dueño de los datos en el
  navegador) + sincronización con Firestore `empresas/{id}/modulos/{doc}` en `firebase-service.js`.
- **Asientos y conexiones:** `js/core/asientos.js` (registro único, idempotente), `conexiones.js`
  (eventos entre módulos), `cierre.js` (checklist del mes). Detalle en `CONECTIVIDAD.md`.
- **Interacción:** `js/core/modales.js` (gestor global de modales y teclado).
- **Accesos:** titular / invitado / acceso por código — `licencia.js`, `auth-manager.js`,
  `firestore.rules` (v3).

## Rediseño 2026-11 — carcasa "ContApp Consola" (paleta del logo)

> Referencia: `PLANIFICACION/diseno/referencia-contapp-consola.html` · Línea base y auditoría: `PLANIFICACION/diseno/LINEA_BASE_DISENO.md`
> Decisiones aprobadas: artefacto como referencia · paleta del logo (opción a) · fuentes actuales
> (opción a) · la consola "¿Qué quieres hacer hoy?" va encima del centro de mando (no lo reemplaza).

| Etapa | Qué incluye | Estado |
|-------|-------------|--------|
| 0 | Referencia en el repo, auditoría (`web-design-guidelines`, `ui-ux-pro-max`), capturas de línea base claro/oscuro, inventario de colores fijos | ✅ 2026-11-14 |
| 1 | Paleta del logo en `css/variables.css` (ambos temas, contraste AA verificado), texto sobre acento/estados por token, isotipo en login y cabecera | ✅ 2026-11-15 |
| 2 | Reemplazar colores fijos de JS/estilos en línea por variables (prioridad: Documentos, Cartolas, cierre, tablas, insignias) | 🔲 |
| 3 | Pantallas: login, Mis clientes (avance de cierre por tarjeta), Inicio con "¿Qué quieres hacer hoy?" sobre el centro de mando | 🔲 |
| 4 | Componentes comunes: botones, tarjetas, tablas, formularios, modales, pestañas (incluye decisión `.plan-tab`/`.rem-tab`) | 🔲 |
| 5 | Movimiento y móvil (`emil-design-eng`, `review-animations`, `mobile-native`), `prefers-reduced-motion` | 🔲 |
| 6 | Revisión final: capturas antes/después, `verificar.js`, pruebas de fase, `web-design-guidelines` | 🔲 |

### Correcciones previas a la Etapa 1 — ✅ 2026-11-14
Errores reales y de interacción de la línea base (H1, H3, H5, H6), sin tocar lógica contable:
- **H1** Inicio vacío sin conexión → `fbInit()` difiere el modo sin conexión a `DOMContentLoaded`.
- **H3** Tema: sigue a `prefers-color-scheme` mientras el usuario no elija; `color-scheme` y
  `<meta theme-color>` acordes al tema.
- **Modales** (`js/core/modales.js`, nuevo): gestor global que observa todos los modales sin cambiar
  cómo se abren — entrada/salida suaves (160-200 ms, solo fundido con movimiento reducido), Escape
  cierra el de arriba usando su botón Cancelar/Cerrar, foco al primer campo, Tab atrapado, foco
  devuelto, scroll del fondo bloqueado sin salto, apilamiento (confirmación sobre formulario).
  Los formularios altos ahora se desplazan (antes el título quedaba cortado). El formulario de
  trabajador ya no se cierra con un clic fuera ni repite la animación al cambiar de sección.
- **Avisos**: `mostrarToast` usa tokens del tema, `aria-live`, abajo al centro (no tapa el botón
  de la IA). Arreglado: los avisos `info` se veían rojos como errores.
- **Teclado/accesibilidad**: controles con `onclick` operables con Enter/Espacio (role/tabindex),
  `aria-label` en botones de ícono, `:focus-visible`, enlace "Saltar al contenido", `autocomplete`
  en correo/contraseña, `alt`/tamaño en img, "…", sin `transition: all`, `prefers-reduced-motion`,
  fuentes por `<link>` (no `@import`).
- **H6** Botones de Cartolas con estilo de la app (antes nativos); cabeceras del Libro Mayor sin
  bloque coral sólido.
- Prueba en navegador: `npm run test:navegador` (23 comprobaciones, capturas en
  `PLANIFICACION/diseno/correcciones/`).

### Seguridad y orden — ✅ 2026-11-14
- `firestore.rules` v3 + ajustes en `auth-manager.js`/`firebase-service.js` (invitados y acceso por
  código). Pruebas: `npm run test:reglas` (63 casos en el emulador). **Publicar las reglas** en la
  consola de Firebase o con `firebase deploy --only firestore:rules` (lo hace el usuario).
- Eliminadas las carpetas `public/` y `pymes/` (copias antiguas). `PLANIFICACION/` ordenada: lo
  histórico en `archivo/`, el worker de Previred en `herramientas/`, maquetas viejas eliminadas.
- Un solo comando de pruebas: `npm test` (estática + conectividad) y `npm run test:navegador`.

### Etapa 1 — paleta del logo ✅ 2026-11-15
- `css/variables.css` reescrito con la paleta de la referencia. Los nombres antiguos (`--coral`,
  `--navy`, `--periwinkle`, `--blue`) apuntan a la paleta nueva y **cambian con el tema** (antes
  eran fijos: `--navy` como texto quedaba invisible en oscuro).
- Tokens nuevos: `--on-accent` (blanco en claro, navy en oscuro: el blanco no se lee sobre el rosa
  neón) y `--on-state` (texto sobre botones rojo/verde/info). Aplicados en 32 reglas CSS y 8
  estilos en línea que fijaban `color:#fff`.
- 25 colores fijos de la paleta anterior (`rgba(255,134,146…)`, `#587FFC`, `rgba(30,30,93…)`)
  pasados a variables.
- Isotipo del logo (claro/oscuro, `icons/brand/isotipo-*-96.png`) en la cabecera de Inicio y el login.
- Arreglado: la pestaña activa de Remuneraciones no mostraba su texto (mismo color que el fondo,
  por dos hojas de estilo en conflicto) — ya pasaba antes de la Etapa 1.
- `PLANIFICACION/diseno/contraste.js` (en `npm test`): 80 combinaciones texto/fondo, todas ≥ 4,5:1
  en ambos temas (la paleta anterior fallaba ~30). Capturas del después en `diseno/etapa1/`.

### Pendientes / próximo paso
1. **Etapa 2** — colores fijos que aún no siguen la paleta (visibles en `diseno/etapa1/`): recuadro
   "Total mes"/"Cuadrado" rosado, botón "Editar" gris y "Descargar RCV" verde azulado en Compras,
   textos tenues dentro de tablas en oscuro, degradado de los íconos del centro de mando, avatar,
   insignias de Remuneraciones y Activos. Ícono de la PWA (`icons/icon.svg`) sigue con el azul antiguo.
2. Campos sin etiqueta asociada (~115, H5) y emoji como íconos (H4/H6): se resuelven al rediseñar
   cada pantalla (Etapas 3-4).
3. Sin pantalla para **revocar códigos o sacar invitados** (las reglas v3 ya lo permiten:
   `invitaciones/{codigo}.revocada = true` o quitar el uid de `perfiles/{titular}.invitados`).
4. Panel de notificaciones de la barra superior con avisos fijos de ejemplo (no lee datos reales).
5. Licencia: un perfil sin campo `estado` pasa el control (`licencia.js`); definir al integrar el cobro.
