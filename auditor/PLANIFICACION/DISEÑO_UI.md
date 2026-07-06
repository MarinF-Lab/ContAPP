# Guía de diseño UI — ContApp Auditor
> Claude Code debe revisar el resultado visual en el browser después de cada cambio de UI.
> El criterio es: ¿se ve profesional comparado con Defontana o Siigo?

---

## Nueva paleta de colores — IMPLEMENTAR (D-8)

Esta es la tarea de diseño más importante. Reemplaza el sistema de color azul actual por una paleta navy/teal con acento magenta-pink, extraída de la identidad visual del proyecto.

### Colores de referencia de la imagen

| Rol en ilustración | Modo claro | Modo oscuro |
|--------------------|-----------|-------------|
| Fondo gradiente | #D9DDE2 → #D7DBE0 | #121F30 → #142131 |
| Contorno principal | #0A1922 | #D2E0EA |
| Líneas interiores | #91A6B2 | #485B69 |
| Cuerpo navy oscuro | #172938 | — |
| Navy medio | #233443 | — |
| Navy sutil | #1C2939 | — |
| Pantalla / fondo profundo | #0C1A27 | #16263A |
| Texto / barras gris | #A9B7C1 | #9CB0BD |
| **Acento magenta** | **#AC406D** | **#F95A8A** |
| Acento plum (secundario) | #722652 | #843B5B |
| Plateado brillo | — | #CAD8E2 |
| Plateado medio | — | #919FAB |
| Plateado sombra | — | #717E8B |

### Mapeo a variables CSS — lo que Claude Code debe cambiar en `css/variables.css`

#### `:root` (modo claro)
```css
/* Fondo general — warm gray de la paleta */
--bg:             #E8ECF0;        /* antes: #F0F2F7 */
--sidebar:        #FFFFFF;        /* sin cambio — sidebar blanca en modo claro */
--card:           #FFFFFF;        /* sin cambio */
--card-border:    #D4DAE4;        /* tono más cálido */

/* Texto — usar el navy profundo como texto principal */
--text:           #0A1922;        /* antes: #0F1623 — ahora navy puro de la paleta */
--text-muted:     #5A6E7A;        /* derivado del #91A6B2 */
--text-subtle:    #A9B7C1;        /* barras de texto de la paleta */

/* Acento — reemplazar azul por magenta */
--accent:         #AC406D;        /* antes: #2B5BF6 — nuevo acento magenta */
--accent-soft:    #F7E8EF;        /* magenta muy suave para fondos */
--accent-grad:    linear-gradient(135deg, #AC406D 0%, #722652 100%);

/* Positivo / negativo / warning — sin cambio */
--positive:       #0FA86E;
--negative:       #E53E5A;
--warning:        #F59E0B;

/* Sidebar activo con nuevo acento */
--nav-active:          #F7E8EF;
--sidebar-item-active-bg:  #F7E8EF;
--sidebar-item-active-txt: #AC406D;
--primary:             #AC406D;
--primary-hover:       #8F3059;   /* magenta más oscuro para hover */
```

#### `[data-theme="dark"]` (modo oscuro)
```css
/* Fondo — navy profundo de la paleta */
--bg:             #121F30;        /* antes: #0D1117 — fondo gradiente de la paleta */
--sidebar:        #0C1A27;        /* pantalla fondo terminal — sidebar más oscura */
--card:           #172938;        /* cuerpo navy oscuro */
--card-border:    #233443;        /* navy medio */

/* Texto — usar plateado de la paleta */
--text:           #CAD8E2;        /* antes: #E8EDF8 — plateado brillo */
--text-muted:     #9CB0BD;        /* barras de texto gris del modo oscuro */
--text-subtle:    #717E8B;        /* plateado sombra */

/* Acento — rosa brillante en modo oscuro (más vibrante) */
--accent:         #F95A8A;        /* antes: #4F7BFF — rosa brillante de la paleta */
--accent-soft:    #2B0F1F;        /* rosa muy oscuro para fondos activos */
--accent-grad:    linear-gradient(135deg, #F95A8A 0%, #843B5B 100%);

/* Dividers y superficies */
--divider:        #1C2939;        /* navy sutil */
--table-stripe:   #142131;        /* fondo gradiente oscuro */
--input-bg:       #0E1A28;        /* más oscuro que la card */

/* Sidebar */
--sidebar-text:          #9CB0BD;
--sidebar-text-hover:    #CAD8E2;
--sidebar-icon-color:    #717E8B;
--sidebar-item-active-bg:  #1C2939;
--sidebar-item-active-txt: #F95A8A;
--nav-active:            #1C2939;
--primary:               #F95A8A;
--primary-hover:         #D94070;
```

### Qué NO cambia
- Fuente (`Inter`) — sin cambio
- `--positive`, `--negative`, `--warning` y sus soft — sin cambio (semántica universal)
- `border-radius`, `shadow`, `font-size` — sin cambio
- Todos los demás archivos CSS (main.css, auditor.css, remuneraciones.css) — sin tocar, usan las variables

### Verificación visual obligatoria post-cambio

Antes de marcar D-8 como completado, revisar en browser con ambos modos:

- [ ] Modo claro: sidebar blanca, fondo gris cálido, acento magenta visible en botones y nav activo
- [ ] Modo oscuro: fondo navy profundo, texto plateado legible, acento rosa brillante en botones
- [ ] Hover de botones primarios: magenta oscuro (claro) / rosa más oscuro (oscuro)
- [ ] Toasts de éxito/error mantienen sus colores semánticos (verde/rojo)
- [ ] Contraste texto/fondo cumple WCAG AA (ratio mínimo 4.5:1)
- [ ] Chips de estado (pendiente/pagado/anulado) siguen legibles

---

## Tokens de diseño actuales (no cambiar sin razón)

```css
--accent:        #2B5BF6   /* azul principal */
--accent-grad:   linear-gradient(135deg, #2B5BF6, #7B3FF2)
--bg:            #F0F2F7   /* fondo claro */
--text:          #0F1623
--text-muted:    #6B7A99
font-family:     'Inter', 'Segoe UI', sans-serif
font-size base:  15px
border-radius:   7-8px (botones), 10-12px (cards)
```

---

## Problemas de diseño a corregir

### D-1 — Tablas sin hover ni separación visual clara
Las tablas de Compras, Ventas, Diario y Mayor no tienen `hover` de fila visible. En listas largas el usuario pierde la fila que está leyendo.

**Fix:**
```css
tbody tr:hover { background: var(--accent-soft); cursor: default; }
tbody tr { border-bottom: 1px solid var(--divider); }
```

### D-2 — Botones de acción sin jerarquía visual
En varias vistas hay 3-4 botones en fila con el mismo peso visual (mismo color, mismo tamaño). El usuario no sabe cuál es la acción principal.

**Regla a aplicar:**
- 1 botón primario por sección (`background: var(--accent)`)
- Botones secundarios: `border: 1px solid var(--accent); background: transparent; color: var(--accent)`
- Botones destructivos (Anular, Eliminar): `background: #ef4444` solo al confirmar, o con icono de advertencia

### D-3 — Formularios laterales sin sombra ni separación del fondo
Los paneles de formulario (agregar compra, agregar venta, etc.) se abren como columna lateral pero se mezclan visualmente con el contenido principal.

**Fix:**
```css
.panel-lateral {
    box-shadow: -4px 0 24px rgba(0,0,0,0.12);
    border-left: 1px solid var(--divider);
    background: var(--surface);
}
```

### D-4 — Estados vacíos inconsistentes
Algunos módulos no tienen estado vacío (balance, dashboard sin datos). Donde sí existe, el diseño varía entre módulos.

**Estándar de estado vacío:**
```html
<div class="empty-state">
    <div class="empty-icon"><!-- emoji o SVG --></div>
    <h3 class="empty-title">Título descriptivo</h3>
    <p class="empty-desc">Una línea explicando qué hacer.</p>
    <button class="btn-primary" onclick="...">Acción principal</button>
</div>
```
```css
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
    color: var(--text-muted);
    gap: 12px;
}
.empty-icon { font-size: 48px; opacity: 0.5; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--text); margin: 0; }
.empty-desc { font-size: 14px; margin: 0; max-width: 320px; }
```

### D-5 — Toasts sin distinción clara entre tipos
Los toasts de éxito, error e información usan variaciones de color sutiles que en modo claro son difíciles de distinguir.

**Paleta de toasts:**
- ✅ Éxito: `background: #16a34a; color: white`
- ❌ Error: `background: #dc2626; color: white`
- ℹ️ Info: `background: #2563eb; color: white`
- ⚠️ Advertencia: `background: #d97706; color: white`

### D-6 — Sidebar con texto demasiado pequeño en módulos secundarios
Los labels del menú lateral en la sección de 2ª categoría están en `font-size: 9.5px` (confirmado en main.css). Ilegible en pantallas pequeñas.

**Fix:** Mínimo `11px` para todos los labels del sidebar. El texto de categorías (encabezados de grupo) puede quedar en `9.5px` en mayúsculas.

### D-7 — KPI cards sin unidad de medida clara
Los KPIs del dashboard muestran números grandes sin contexto inmediato: "$ 4.500.000" pero ¿es activo total? ¿resultado del mes? El label está debajo del número, pero en escánear rápido el usuario lee el número antes que el label.

**Fix:** Mover el label ARRIBA del número, y agregar un subtexto de período debajo:
```
Activos Totales         ← label arriba (11px, muted)
$ 4.500.000             ← número grande
Junio 2025              ← período abajo (10px, subtle)
```

---

## Checklist de revisión visual (ejecutar al terminar cada sprint)

Claude Code debe abrir el browser con `python -m http.server 8080`, navegar a cada vista modificada y verificar:

- [ ] La vista no tiene elementos que se solapen o corten
- [ ] En modo oscuro, el texto es legible (contraste suficiente)
- [ ] En ventana de 1280px de ancho, no aparece scroll horizontal
- [ ] Los botones tienen estados hover visibles
- [ ] Los formularios tienen labels en todos los campos
- [ ] Los estados vacíos tienen ícono + texto + botón CTA
- [ ] Los toasts son visibles y desaparecen solos
- [ ] Las tablas tienen cabecera fija o al menos visible sin scroll
- [ ] Los números monetarios usan formato chileno: `$ 1.234.567`
- [ ] Los RUT usan formato chileno: `12.345.678-9`

---

## Componentes que ya están bien (no retocar)

- Header (logo, búsqueda, tema, usuario) — bien proporcionado
- Sidebar (estructura de grupos y navegación) — correcto, solo ajustar font-size (D-6)
- Chips de estado (pendiente/pagado/anulado) — colores correctos
- Modal de login/registro — limpio
- Cards del panel multi-cliente — bien diseñadas con color picker

---

## Referencia visual objetivo

El estándar a alcanzar es comparable a **Linear.app** o **Notion** en densidad de información: compacto pero respirable, con jerarquía clara entre títulos, datos y acciones. No tiene que ser Dribbble — tiene que ser funcional y profesional.
