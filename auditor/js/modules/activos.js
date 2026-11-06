'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  ACTIVOS FIJOS Y DEPRECIACIÓN — ContApp Auditor
// ─────────────────────────────────────────────────────────────────────────────

var ACTIVOS_KEY = 'core_activos';

// ── Utilidades ────────────────────────────────────────────────────────────────

function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _fmt(n) {
    return '$' + Number(n || 0).toLocaleString('es-CL');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function getActivos() {
    try { return JSON.parse(localStorage.getItem(ACTIVOS_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveActivos(arr) {
    localStorage.setItem(ACTIVOS_KEY, JSON.stringify(arr));
}

function activoGetById(id) {
    return getActivos().find(function (a) { return String(a.id) === String(id); }) || null;
}

// Sufijo random además de Date.now(): dos activos creados en el mismo
// milisegundo (ej. una compra con varios ítems de activo fijo sincronizada
// de una sola vez desde el Diario) quedarían con el mismo id — y editar
// cualquiera de los dos abriría siempre el primero (prodGetById/find()).
function _activoNuevoId() {
    return 'a' + Date.now() + Math.floor(Math.random() * 1000);
}

// ── Cuentas de depreciación por defecto ────────────────────────────────────────
// Los activos que nacen sin pasar por este formulario (ej. la calculadora del
// Diario) no traen cuenta de gasto ni de depreciación acumulada; se derivan de
// la cuenta del activo para que igual entren al asiento de depreciación.
// Terrenos no se deprecian (devuelve null).
function _activoCuentasDepDefault(cuentaActivo) {
    if (!cuentaActivo) return null;
    var n = String(cuentaActivo).toLowerCase();
    if (/terreno/.test(n)) return null;
    var acum = 'Depreciación Acumulada';
    if (/mueble|[uú]til/.test(n))            acum = 'Depreciación Acumulada Muebles';
    else if (/veh[ií]culo/.test(n))          acum = 'Depreciación Acumulada Vehículos';
    else if (/edificio/.test(n))             acum = 'Depreciación Acumulada Edificios';
    else if (/maquinaria/.test(n))           acum = 'Depreciación Acumulada Maquinarias';
    else if (/equipo|computa/.test(n))       acum = 'Depreciación Acumulada Equipos';
    else if (/software|marca|patente/.test(n)) acum = 'Amortización Acumulada';
    return { cuenta_dep_acumulada: acum, cuenta_gasto_dep: 'Depreciación' };
}

// Cuentas efectivas de un activo: las que tenga cargadas, o las de defecto.
function _activoCuentasEfectivas(a) {
    var def = _activoCuentasDepDefault(a.cuenta_activo);
    return {
        gasto: a.cuenta_gasto_dep     || (def && def.cuenta_gasto_dep)     || '',
        acum:  a.cuenta_dep_acumulada || (def && def.cuenta_dep_acumulada) || '',
    };
}

// ── Cálculo de depreciación ────────────────────────────────────────────────────

// Meses (con fracción) entre dos fechas, ambas inclusive: cada mes calendario
// aporta días_dentro_del_rango / días_del_mes, así un mes completo vale 1 y
// uno parcial se prorratea por días (años, meses y días según corresponda).
function _mesesDepreciables(inicio, fin) {
    if (!inicio || !fin || fin < inicio) return 0;
    var total = 0;
    var y = inicio.getFullYear(), m = inicio.getMonth();
    while (y < fin.getFullYear() || (y === fin.getFullYear() && m <= fin.getMonth())) {
        var dim = new Date(y, m + 1, 0).getDate();
        var di  = (y === inicio.getFullYear() && m === inicio.getMonth()) ? inicio.getDate() : 1;
        var df  = (y === fin.getFullYear()    && m === fin.getMonth())    ? fin.getDate()    : dim;
        total += (df - di + 1) / dim;
        m++;
        if (m > 11) { m = 0; y++; }
    }
    return total;
}

function _activoVidaEfectiva(activo) {
    var anos = Number(activo.vida_util_anos) || 1;
    if (activo.metodo === 'acelerada') anos = Math.max(1, Math.floor(anos / 3));
    return anos;
}

// Último día en que el activo sigue depreciando: el menor entre el fin de su
// vida útil (ingreso + vida efectiva) y la fecha final editable (baja), si hay.
function _activoFinDepreciacion(activo) {
    var inicio = new Date(activo.fecha_adquisicion + 'T00:00:00');
    var fin = new Date(inicio.getFullYear() + _activoVidaEfectiva(activo), inicio.getMonth(), inicio.getDate() - 1);
    if (activo.fecha_fin) {
        var ff = new Date(activo.fecha_fin + 'T00:00:00');
        if (ff < fin) fin = ff;
    }
    return fin;
}

// Fecha de corte de la declaración: último día del mes/año elegido en el
// selector de la pantalla; sin selector (formulario), hoy.
function _activoCorteDate() {
    var sa = document.getElementById('activo-sel-anio');
    var sm = document.getElementById('activo-sel-mes');
    if (sa && sm) return new Date(parseInt(sa.value, 10), parseInt(sm.value, 10) + 1, 0);
    var h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
}

// "2 años, 3 meses y 10 días" entre dos fechas (ambas inclusive).
function _duracionTexto(inicio, fin) {
    if (!inicio || !fin || fin < inicio) return '0 días';
    var fa = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1);
    var a = fa.getFullYear() - inicio.getFullYear();
    var m = fa.getMonth() - inicio.getMonth();
    var d = fa.getDate() - inicio.getDate();
    if (d < 0) { m--; d += new Date(fa.getFullYear(), fa.getMonth(), 0).getDate(); }
    if (m < 0) { a--; m += 12; }
    var partes = [];
    if (a) partes.push(a + (a === 1 ? ' año' : ' años'));
    if (m) partes.push(m + (m === 1 ? ' mes' : ' meses'));
    if (d) partes.push(d + (d === 1 ? ' día' : ' días'));
    if (!partes.length) return '0 días';
    return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0];
}

function _calcDepreciacion(activo, corte) {
    var val  = Number(activo.valor_adquisicion) || 0;
    var anos = _activoVidaEfectiva(activo);

    var cuotaAnual   = val / anos;
    var cuotaMensual = cuotaAnual / 12;

    // Desde la fecha de ingreso hasta el último día de la declaración
    // (o la fecha final del activo, si es anterior).
    var depAcumulada = 0;
    var valorLibro   = val;
    var tiempo       = '';

    if (activo.activo !== false && val > 0 && activo.fecha_adquisicion) {
        var inicio = new Date(activo.fecha_adquisicion + 'T00:00:00');
        var hasta  = corte || _activoCorteDate();
        var fin    = _activoFinDepreciacion(activo);
        if (hasta < fin) fin = hasta;
        var meses  = _mesesDepreciables(inicio, fin);
        depAcumulada = Math.min(Math.round(cuotaMensual * meses), val);
        valorLibro   = val - depAcumulada;
        tiempo       = _duracionTexto(inicio, fin);
    }

    return {
        cuotaAnual:    cuotaAnual,
        cuotaMensual:  cuotaMensual,
        depAcumulada:  depAcumulada,
        valorLibro:    valorLibro,
        vidaUtilEfect: anos,
        tiempo:        tiempo,
    };
}

// Depreciación de un mes/año específico (para asiento): cuota mensual ×
// fracción del mes en que el activo estuvo depreciando (prorrata por días en
// el mes de ingreso y en el último mes).
function _calcDepMes(activo, anio, mes) {
    // mes: 0-indexed (JS Date style)
    var val = Number(activo.valor_adquisicion) || 0;
    if (activo.activo === false || val <= 0 || !activo.fecha_adquisicion) return 0;

    var cuotaMensual = (val / _activoVidaEfectiva(activo)) / 12;
    var inicio = new Date(activo.fecha_adquisicion + 'T00:00:00');
    var mesIni = new Date(anio, mes, 1);
    var mesFin = new Date(anio, mes + 1, 0);

    var desde = inicio > mesIni ? inicio : mesIni;
    var finAct = _activoFinDepreciacion(activo);
    var hasta = finAct < mesFin ? finAct : mesFin;

    return cuotaMensual * _mesesDepreciables(desde, hasta);
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderActivos() {
    var view = document.getElementById('tab-ap-activos');
    if (!view) return;

    if (!document.getElementById('activo-tabla-body')) {
        var pt     = periodoTrabajo();
        var anioD  = pt.anio;
        var mesD   = pt.mes - 1; // 0-indexed

        // Generar opciones de años (5 atrás, 1 adelante)
        var optAnios = '';
        for (var ya = anioD - 5; ya <= anioD + 1; ya++) {
            optAnios += '<option value="' + ya + '"' + (ya === anioD ? ' selected' : '') + '>' + ya + '</option>';
        }

        // Opciones de meses
        var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        var optMeses = '';
        for (var mi = 0; mi < 12; mi++) {
            optMeses += '<option value="' + mi + '"' + (mi === mesD ? ' selected' : '') + '>' + MESES[mi] + '</option>';
        }

        view.innerHTML =
            '<div class="card" style="margin-bottom:16px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
                    '<div>' +
                        '<h2 style="margin:0 0 4px;">Activos Fijos y Depreciación</h2>' +
                        '<p style="color:var(--text-muted);font-size:12px;margin:0;">Registro y control de activos — depreciación lineal y acelerada SII</p>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
                        '<select id="activo-sel-anio" class="input" style="width:auto;" title="Año para asiento">' + optAnios + '</select>' +
                        '<select id="activo-sel-mes"  class="input" style="width:auto;" title="Mes para asiento">'  + optMeses  + '</select>' +
                        '<button class="btn btn-secondary" id="activo-btn-asiento" style="white-space:nowrap;">Generar asiento dep.</button>' +
                        '<button class="btn btn-primary"   id="activo-btn-agregar">+ Agregar activo</button>' +
                    '</div>' +
                '</div>' +
                '<div id="activo-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;"></div>' +
            '</div>' +

            '<div class="card" style="overflow-x:auto;padding:0;">' +
                '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead>' +
                        '<tr style="border-bottom:2px solid var(--divider);background:var(--surface);">' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">NOMBRE</th>' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">FECHA ADQ.</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">VALOR ADQ.</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">MÉTODO</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">VIDA ÚTIL</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">DEP. ANUAL</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">DEP. ACUMULADA</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">VALOR LIBRO</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">ESTADO</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">ÚLT. PERÍODO DEP.</th>' +
                            '<th style="padding:10px 12px;"></th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody id="activo-tabla-body"></tbody>' +
                '</table>' +
                '<div id="activo-tabla-vacia" style="display:none;text-align:center;padding:48px 24px;color:var(--text-muted);">' +
                    '<div style="font-size:36px;margin-bottom:10px;">🏗</div>' +
                    '<p>Sin activos registrados. Agrega el primer activo fijo.</p>' +
                '</div>' +
            '</div>';

        document.getElementById('activo-btn-agregar').addEventListener('click', function () { activoAbrirForm(null); });
        // La depreciación acumulada llega hasta el último día del período elegido.
        ['activo-sel-anio', 'activo-sel-mes'].forEach(function (sid) {
            document.getElementById(sid).addEventListener('change', function () {
                _activoActualizarKpis();
                _activoActualizarTabla();
            });
        });
        document.getElementById('activo-btn-asiento').addEventListener('click', function () {
            var anio = parseInt(document.getElementById('activo-sel-anio').value, 10);
            var mes  = parseInt(document.getElementById('activo-sel-mes').value,  10);
            activoGenerarAsientoDepreciacion(anio, mes);
        });
    }

    _activoActualizarKpis();
    _activoActualizarTabla();
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function _activoActualizarKpis() {
    var kpisEl = document.getElementById('activo-kpis');
    if (!kpisEl) return;

    var activos = getActivos();
    var totalAdq = 0, totalDep = 0, totalLibro = 0;

    activos.forEach(function (a) {
        var d = _calcDepreciacion(a);
        totalAdq   += Number(a.valor_adquisicion) || 0;
        totalDep   += d.depAcumulada;
        totalLibro += d.valorLibro;
    });

    var kpis = [
        { label: 'Total activos',         valor: activos.length,    fmt: false, icon: '🏗' },
        { label: 'Valor adquisición',      valor: totalAdq,          fmt: true,  icon: '💰' },
        { label: 'Dep. acumulada total',   valor: totalDep,          fmt: true,  icon: '📉' },
        { label: 'Valor libro total',      valor: totalLibro,        fmt: true,  icon: '📋' },
    ];

    var html = '';
    kpis.forEach(function (k) {
        var valStr = k.fmt ? _fmt(k.valor) : String(k.valor);
        html +=
            '<div style="padding:12px;border-radius:8px;border:1px solid var(--divider);background:var(--surface);">' +
                '<div style="font-size:18px;margin-bottom:4px;">' + k.icon + '</div>' +
                '<div style="font-size:18px;font-weight:700;line-height:1.2;">' + valStr + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + k.label + '</div>' +
            '</div>';
    });

    kpisEl.innerHTML = html;
}

// ── Tabla ─────────────────────────────────────────────────────────────────────

function _activoActualizarTabla() {
    var tbody = document.getElementById('activo-tabla-body');
    var vacia = document.getElementById('activo-tabla-vacia');
    if (!tbody) return;

    var activos = getActivos();

    if (activos.length === 0) {
        tbody.innerHTML = '';
        if (vacia) vacia.style.display = 'block';
        return;
    }

    if (vacia) vacia.style.display = 'none';

    var html = '';
    activos.forEach(function (a) {
        var d        = _calcDepreciacion(a);
        var opacity  = a.activo !== false ? '' : 'opacity:.55;';
        var metLabel = a.metodo === 'acelerada' ? 'Acelerada' : 'Lineal';
        var metColor = a.metodo === 'acelerada' ? '#1e40af'   : '#166534';
        var metBg    = a.metodo === 'acelerada' ? '#dbeafe'   : '#dcfce7';
        var staBg    = a.activo !== false ? '#dcfce7' : '#fee2e2';
        var staColor = a.activo !== false ? '#166534' : '#991b1b';
        var staLabel = a.activo !== false ? 'Activo'  : 'Dado de baja';
        var vidaStr  = a.vida_util_anos + ' año' + (Number(a.vida_util_anos) !== 1 ? 's' : '');
        if (a.metodo === 'acelerada') {
            vidaStr += ' (' + d.vidaUtilEfect + ' ef.)';
        }

        html +=
            '<tr style="border-bottom:1px solid var(--divider);' + opacity + '">' +
                '<td style="padding:10px 12px;">' +
                    '<div style="font-weight:500;">' + _esc(a.nombre) + '</div>' +
                    (a.descripcion ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(a.descripcion) + '</div>' : '') +
                    (a.proveedor_nombre ? '<div style="font-size:11px;color:var(--text-muted);">' + _esc(a.proveedor_nombre) + '</div>' : '') +
                '</td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);white-space:nowrap;">' + _esc(a.fecha_adquisicion || '—') +
                    (a.fecha_fin ? '<div style="font-size:11px;">hasta ' + _esc(a.fecha_fin) + '</div>' : '') + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;">' + _fmt(a.valor_adquisicion) + '</td>' +
                '<td style="padding:10px 12px;text-align:center;">' +
                    '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:' + metBg + ';color:' + metColor + ';">' + metLabel + '</span>' +
                '</td>' +
                '<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--text-muted);">' + vidaStr + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:12px;">' + _fmt(d.cuotaAnual) + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:12px;color:#991b1b;">' + _fmt(d.depAcumulada) +
                    (d.tiempo ? '<div style="font-size:10px;color:var(--text-muted);font-family:inherit;white-space:nowrap;">' + d.tiempo + '</div>' : '') + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:600;">' + _fmt(d.valorLibro) + '</td>' +
                '<td style="padding:10px 12px;text-align:center;">' +
                    '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:' + staBg + ';color:' + staColor + ';">' + staLabel + '</span>' +
                '</td>' +
                '<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--text-muted);">' +
                    (a.periodos_depreciados && a.periodos_depreciados.length > 0
                        ? a.periodos_depreciados[a.periodos_depreciados.length - 1]
                        : 'Nunca') +
                '</td>' +
                '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' +
                    '<button class="btn btn-sm activo-btn-editar"   data-id="' + a.id + '" style="margin-right:4px;" title="Editar">✏️</button>' +
                    '<button class="btn btn-sm activo-btn-eliminar" data-id="' + a.id + '" style="color:var(--error);" title="Eliminar">🗑</button>' +
                '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.activo-btn-editar').forEach(function (btn) {
        btn.addEventListener('click', function () { activoAbrirForm(this.dataset.id); });
    });
    tbody.querySelectorAll('.activo-btn-eliminar').forEach(function (btn) {
        btn.addEventListener('click', function () { activoEliminar(this.dataset.id); });
    });
}

// ── Formulario (drawer lateral) ───────────────────────────────────────────────

function activoAbrirForm(id) {
    var el = document.getElementById('activo-drawer-overlay');
    if (el) el.remove();

    var activo  = id ? activoGetById(id) : null;
    var esNuevo = !activo;

    var cuentasArr = Object.keys(window.PLAN_CUENTAS || {}).sort();

    function _optCuentas(valorActual) {
        var base = '<option value="">Sin cuenta asignada</option>';
        cuentasArr.forEach(function (n) {
            base += '<option value="' + _esc(n) + '"' + (valorActual === n ? ' selected' : '') + '>' + _esc(n) + '</option>';
        });
        return base;
    }

    var proveedores = _activoGetProveedores();

    var optProveedores = '<option value="">Sin proveedor</option>';
    proveedores.forEach(function (c) {
        var sel = activo && String(activo.proveedor_id) === String(c.id) ? ' selected' : '';
        optProveedores += '<option value="' + _esc(String(c.id)) + '"' + sel + '>' + _esc(c.nombre || c.razon_social || '') + '</option>';
    });

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'activo-drawer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;justify-content:flex-end;';

    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.3);';
    backdrop.addEventListener('click', activoCerrarForm);

    // Drawer
    var drawer = document.createElement('div');
    drawer.style.cssText =
        'position:relative;z-index:1;' +
        'width:500px;max-width:100vw;' +
        'height:100%;' +
        'background:var(--card);' +
        'display:flex;flex-direction:column;' +
        'box-shadow:-4px 0 24px rgba(0,0,0,.18);' +
        'transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);';

    var metodoLineal    = !activo || activo.metodo !== 'acelerada';
    var metodoAcelerada = activo && activo.metodo === 'acelerada';

    drawer.innerHTML =
        // Header
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--divider);flex-shrink:0;">' +
            '<div>' +
                '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">' +
                    (esNuevo ? 'Nuevo activo' : 'Editar activo') +
                '</div>' +
                '<h3 style="margin:0;font-size:17px;" id="af-titulo-drawer">' +
                    (activo ? _esc(activo.nombre || 'Sin nombre') : 'Activo fijo') +
                '</h3>' +
            '</div>' +
            '<button id="activo-btn-cerrar" style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--text-muted);font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;" title="Cerrar">✕</button>' +
        '</div>' +

        // Body
        '<div style="flex:1;overflow-y:auto;padding:24px;">' +

            // Nombre + descripción
            '<div style="margin-bottom:20px;">' +
                '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Nombre <span style="color:var(--error);">*</span></label>' +
                '<input id="af-nombre" class="input" value="' + (activo ? _esc(activo.nombre) : '') + '" placeholder="Ej: Computador HP EliteBook" style="margin-bottom:10px;">' +
                '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Descripción</label>' +
                '<textarea id="af-descripcion" class="input" rows="2" style="resize:vertical;" placeholder="Detalle adicional…">' + (activo ? _esc(activo.descripcion || '') : '') + '</textarea>' +
            '</div>' +

            // Fecha + valor
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Fecha adquisición <span style="color:var(--error);">*</span></label>' +
                    '<input id="af-fecha" class="input" type="date" value="' + (activo ? _esc(activo.fecha_adquisicion || '') : '') + '">' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Valor adquisición <span style="color:var(--error);">*</span></label>' +
                    '<div style="position:relative;">' +
                        '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;">$</span>' +
                        '<input id="af-valor" class="input" type="number" min="0" style="padding-left:24px;" value="' + (activo && activo.valor_adquisicion > 0 ? activo.valor_adquisicion : '') + '" placeholder="0">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Fecha final editable
            '<div style="margin-bottom:20px;">' +
                '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Fecha final de depreciación <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(opcional — baja o venta; vacío = fin de la vida útil)</span></label>' +
                '<input id="af-fecha-fin" class="input" type="date" value="' + (activo ? _esc(activo.fecha_fin || '') : '') + '">' +
            '</div>' +

            // Vida útil + método
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Vida útil (años) <span style="color:var(--error);">*</span></label>' +
                    '<input id="af-vida-util" class="input" type="number" min="1" step="1" value="' + (activo ? _esc(String(activo.vida_util_anos || '')) : '') + '" placeholder="Ej: 5">' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Método depreciación</label>' +
                    '<select id="af-metodo" class="input">' +
                        '<option value="lineal"'    + (metodoLineal    ? ' selected' : '') + '>Lineal</option>' +
                        '<option value="acelerada"' + (metodoAcelerada ? ' selected' : '') + '>Acelerada SII (÷3)</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +

            // Preview depreciación
            '<div id="af-dep-preview" style="padding:12px 14px;border-radius:10px;border:1px solid var(--divider);background:var(--surface);margin-bottom:20px;font-size:12px;color:var(--text-muted);">' +
                'Ingresa valor, vida útil y método para ver la cuota estimada.' +
            '</div>' +

            '<div style="height:1px;background:var(--divider);margin:0 0 20px;"></div>' +

            // Proveedor
            '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px;">PROVEEDOR</div>' +
            '<div style="margin-bottom:20px;">' +
                '<select id="af-proveedor" class="input">' + optProveedores + '</select>' +
            '</div>' +

            '<div style="height:1px;background:var(--divider);margin:0 0 20px;"></div>' +

            // Cuentas contables
            '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:12px;">CUENTAS CONTABLES</div>' +
            '<div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Cuenta activo <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(ej: Maquinaria y Equipo)</span></label>' +
                    '<select id="af-cuenta-activo" class="input">' + _optCuentas(activo ? activo.cuenta_activo : '') + '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Cuenta dep. acumulada <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(HABER)</span></label>' +
                    '<select id="af-cuenta-dep-acumulada" class="input">' + _optCuentas(activo ? activo.cuenta_dep_acumulada : '') + '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Cuenta gasto depreciación <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(DEBE)</span></label>' +
                    '<select id="af-cuenta-gasto-dep" class="input">' + _optCuentas(activo ? activo.cuenta_gasto_dep : '') + '</select>' +
                '</div>' +
            '</div>' +

            // Estado
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:14px;border:1px solid var(--divider);border-radius:10px;">' +
                '<input type="checkbox" id="af-activo"' + (activo && activo.activo === false ? '' : ' checked') + ' style="width:16px;height:16px;cursor:pointer;">' +
                '<div>' +
                    '<div style="font-size:13px;font-weight:600;">Activo en uso</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);">Desmarca si el activo fue dado de baja o vendido</div>' +
                '</div>' +
            '</label>' +

        '</div>' + // fin body

        // Footer
        '<div style="padding:16px 24px;border-top:1px solid var(--divider);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:8px;">' +
            '<button id="activo-btn-cancelar" class="btn btn-secondary">Cancelar</button>' +
            '<button id="activo-btn-guardar"  class="btn btn-primary" style="min-width:130px;">💾 Guardar activo</button>' +
        '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);

    // Animar entrada
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            drawer.style.transform = 'translateX(0)';
        });
    });

    // Actualizar título
    document.getElementById('af-nombre').addEventListener('input', function () {
        var t = document.getElementById('af-titulo-drawer');
        if (t) t.textContent = this.value.trim() || (esNuevo ? 'Activo fijo' : 'Sin nombre');
    });

    // Preview depreciación en tiempo real
    function _actualizarPreview() {
        var val  = parseFloat(document.getElementById('af-valor').value)     || 0;
        var anos = parseFloat(document.getElementById('af-vida-util').value) || 0;
        var met  = document.getElementById('af-metodo').value;
        var prev = document.getElementById('af-dep-preview');
        if (!prev) return;
        if (!val || !anos) {
            prev.innerHTML = 'Ingresa valor, vida útil y método para ver la cuota estimada.';
            return;
        }
        var anosEf = met === 'acelerada' ? Math.max(1, Math.floor(anos / 3)) : anos;
        var cuotaA = val / anosEf;
        var cuotaM = cuotaA / 12;
        var extra = '';
        var fIni = document.getElementById('af-fecha').value;
        if (fIni) {
            var sim = { valor_adquisicion: val, vida_util_anos: anos, metodo: met, fecha_adquisicion: fIni,
                        fecha_fin: document.getElementById('af-fecha-fin').value || '', activo: true };
            var corteSim = _activoCorteDate();
            var dsim = _calcDepreciacion(sim, corteSim);
            var pad = function (n) { return String(n).padStart(2, '0'); };
            extra = '<div style="margin-top:6px;"><strong>Hasta ' + pad(corteSim.getDate()) + '/' + pad(corteSim.getMonth() + 1) + '/' + corteSim.getFullYear() +
                    ':</strong> ' + (dsim.tiempo || '0 días') + ' depreciando · acumulada ' + _fmt(dsim.depAcumulada) +
                    ' · valor libro ' + _fmt(dsim.valorLibro) + '</div>';
        }
        prev.innerHTML =
            '<strong>Cuota anual:</strong> ' + _fmt(cuotaA) +
            ' &nbsp;|&nbsp; <strong>Cuota mensual:</strong> ' + _fmt(cuotaM) +
            (met === 'acelerada' ? ' &nbsp;|&nbsp; <span style="color:#1e40af;">Vida útil efectiva: ' + anosEf + ' año' + (anosEf !== 1 ? 's' : '') + '</span>' : '') +
            extra;
    }

    document.getElementById('af-fecha').addEventListener('change',     _actualizarPreview);
    document.getElementById('af-fecha-fin').addEventListener('change', _actualizarPreview);
    document.getElementById('af-valor').addEventListener('input',     _actualizarPreview);
    document.getElementById('af-vida-util').addEventListener('input', _actualizarPreview);
    document.getElementById('af-metodo').addEventListener('change',   _actualizarPreview);
    _actualizarPreview();

    // Botones
    document.getElementById('activo-btn-cerrar').addEventListener('click',   activoCerrarForm);
    document.getElementById('activo-btn-cancelar').addEventListener('click', activoCerrarForm);
    document.getElementById('activo-btn-guardar').addEventListener('click',  function () {
        activoGuardar(activo ? activo.id : null);
    });

    setTimeout(function () {
        var nEl = document.getElementById('af-nombre');
        if (nEl) nEl.focus();
    }, 260);
}

function activoCerrarForm() {
    var overlay = document.getElementById('activo-drawer-overlay');
    if (!overlay) return;
    var drawer = overlay.querySelector('div[style*="translateX"]') || overlay.lastChild;
    if (drawer && drawer.style) {
        drawer.style.transform = 'translateX(100%)';
        setTimeout(function () { overlay.remove(); }, 230);
    } else {
        overlay.remove();
    }
}

// ── Guardar ───────────────────────────────────────────────────────────────────

function activoGuardar(id) {
    var nombreEl = document.getElementById('af-nombre');
    if (!nombreEl) return;
    var nombre = nombreEl.value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio.', 'error'); return; }

    var fecha = (document.getElementById('af-fecha').value || '').trim();
    if (!fecha) { mostrarToast('La fecha de adquisición es obligatoria.', 'error'); return; }

    var fechaFin = (document.getElementById('af-fecha-fin').value || '').trim();
    if (fechaFin && fechaFin < fecha) { mostrarToast('La fecha final no puede ser anterior a la de adquisición.', 'error'); return; }

    var valor = parseFloat(document.getElementById('af-valor').value) || 0;
    if (valor <= 0) { mostrarToast('Ingresa un valor de adquisición válido.', 'error'); return; }

    var vidaUtil = parseInt(document.getElementById('af-vida-util').value, 10) || 0;
    if (vidaUtil < 1) { mostrarToast('La vida útil debe ser al menos 1 año.', 'error'); return; }

    // Proveedor
    var provSel  = document.getElementById('af-proveedor');
    var provId   = provSel ? provSel.value : '';
    var provNombre = '';
    if (provId) {
        var provs = _activoGetProveedores();
        var prov  = provs.filter(function (c) { return String(c.id) === String(provId); })[0];
        if (prov) provNombre = prov.nombre || prov.razon_social || '';
    }

    var registro = {
        id:                   id ? String(id) : _activoNuevoId(),
        nombre:               nombre,
        descripcion:          (document.getElementById('af-descripcion').value || '').trim(),
        fecha_adquisicion:    fecha,
        fecha_fin:            fechaFin,
        valor_adquisicion:    valor,
        vida_util_anos:       vidaUtil,
        metodo:               document.getElementById('af-metodo').value || 'lineal',
        cuenta_activo:        document.getElementById('af-cuenta-activo').value          || '',
        cuenta_dep_acumulada: document.getElementById('af-cuenta-dep-acumulada').value   || '',
        cuenta_gasto_dep:     document.getElementById('af-cuenta-gasto-dep').value       || '',
        proveedor_id:         provId,
        proveedor_nombre:     provNombre,
        activo:               document.getElementById('af-activo').checked,
        created_at:           Date.now(),
    };

    var arr = getActivos();
    var idx = arr.findIndex(function (a) { return String(a.id) === String(id); });
    if (idx >= 0) {
        registro.created_at = arr[idx].created_at;
        // Conservar los períodos ya depreciados: sin esto, editar un activo
        // los borraba y permitía depreciar dos veces el mismo mes.
        if (arr[idx].periodos_depreciados) registro.periodos_depreciados = arr[idx].periodos_depreciados;
        arr[idx] = registro;
    } else {
        arr.push(registro);
    }

    saveActivos(arr);
    activoCerrarForm();
    _activoActualizarKpis();
    _activoActualizarTabla();
    mostrarToast(idx >= 0 ? 'Activo actualizado.' : 'Activo registrado.', 'ok');
}

// ── Eliminar ──────────────────────────────────────────────────────────────────

function activoEliminar(id) {
    mostrarConfirm('¿Eliminar este activo del registro?', () => {
        saveActivos(getActivos().filter(function (a) { return String(a.id) !== String(id); }));
        _activoActualizarKpis();
        _activoActualizarTabla();
        mostrarToast('Activo eliminado.', 'ok');
    });
}

// ── Generar asiento de depreciación ──────────────────────────────────────────

function activoGenerarAsientoDepreciacion(anio, mes) {
    // anio: número, mes: 0-indexed
    var activos = getActivos();

    var periodoStr = anio + '-' + String(mes + 1).padStart(2, '0');
    var lineas = [];
    var advertencias = [];
    var sinCuentas = [];
    activos.forEach(function (a) {
        if (a.activo === false) return;

        // Validar doble depreciación ANTES del cálculo de cuota
        var depsPrevios = a.periodos_depreciados || [];
        if (depsPrevios.includes(periodoStr)) {
            advertencias.push(a.nombre);
            return;
        }

        var cuota = _calcDepMes(a, anio, mes);
        if (cuota <= 0) return;
        var ctas = _activoCuentasEfectivas(a);
        if (!ctas.gasto || !ctas.acum) { sinCuentas.push(a.nombre); return; }

        lineas.push({
            activo_id:            a.id,
            activo_nombre:        a.nombre,
            cuenta_debe:          ctas.gasto,
            cuenta_haber:         ctas.acum,
            monto:                Math.round(cuota),
        });
    });

    if (sinCuentas.length > 0) {
        mostrarToast('Sin cuentas de depreciación (edítalos y asígnalas): ' + sinCuentas.join(', '), 'error');
    }

    if (advertencias.length > 0) {
        mostrarToast('Depreciación de ' + periodoStr + ' ya generada para: ' + advertencias.join(', '), 'error');
        if (lineas.length === 0) return;
    }

    if (lineas.length === 0) {
        mostrarToast('No hay activos depreciables para el período seleccionado (verifica cuentas asignadas).', 'error');
        return;
    }

    var MESES_LABEL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var glosa = 'Depreciación ' + MESES_LABEL[mes] + ' ' + anio;

    var movimientos = [];
    lineas.forEach(function (l) {
        movimientos.push({ cuenta: l.cuenta_debe,  debe: l.monto, haber: 0,       glosa: l.activo_nombre });
        movimientos.push({ cuenta: l.cuenta_haber, debe: 0,       haber: l.monto, glosa: l.activo_nombre });
    });

    var totalDebe = movimientos.reduce(function (s, m) { return s + m.debe;  }, 0);
    var totalHabe = movimientos.reduce(function (s, m) { return s + m.haber; }, 0);

    var asiento = {
        id:           Date.now(),
        numero:       _nextNumeroAsiento(),
        estado:       'ACTIVO',
        // DD/MM/AAAA — mismo formato que el resto de la app (diario.js), no ISO:
        // con ISO el asiento desaparecía de Dashboard/Flujo de Caja/Conciliación,
        // que filtran por período haciendo fecha.split('/').
        fecha:        '01/' + String(mes + 1).padStart(2, '0') + '/' + anio,
        tipo:         'diario',
        glosa:        glosa,
        movimientos:  movimientos,
        total_debe:   totalDebe,
        total_haber:  totalHabe,
        origen:       'activos_depreciacion',
        created_at:   Date.now(),
    };

    // Persistir en dbAsientos
    if (!window.dbAsientos) {
        try { window.dbAsientos = JSON.parse(localStorage.getItem('core_asientos') || '[]'); }
        catch (e) { window.dbAsientos = []; }
    }

    window.dbAsientos.push(asiento);
    localStorage.setItem('core_asientos', JSON.stringify(window.dbAsientos));

    // Registrar período depreciado en cada activo
    var activosActualizados = getActivos();
    lineas.forEach(function (l) {
        var a = activosActualizados.find(function (x) { return x.id === l.activo_id; });
        if (!a) return;
        if (!a.periodos_depreciados) a.periodos_depreciados = [];
        if (!a.periodos_depreciados.includes(periodoStr)) a.periodos_depreciados.push(periodoStr);
    });
    localStorage.setItem('core_activos', JSON.stringify(activosActualizados));
    _activoActualizarTabla();

    mostrarToast(
        'Asiento de depreciación generado: ' + lineas.length + ' activo' + (lineas.length !== 1 ? 's' : '') +
        ' — ' + _fmt(totalDebe) + ' en ' + MESES_LABEL[mes] + ' ' + anio + '.',
        'ok'
    );
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function _activoGetProveedores() {
    try {
        var contactos = JSON.parse(localStorage.getItem('core_contactos') || '[]');
        return contactos.filter(function (c) {
            return c.activo !== false && (c.tipo === 'proveedor' || c.tipo === 'ambos');
        });
    } catch (e) { return []; }
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.renderActivos                      = renderActivos;
window.activoAbrirForm                    = activoAbrirForm;
window.activoCerrarForm                   = activoCerrarForm;
window.activoGuardar                      = activoGuardar;
window.activoEliminar                     = activoEliminar;
window.activoGenerarAsientoDepreciacion   = activoGenerarAsientoDepreciacion;
window.getActivos                         = getActivos;
window.activoGetById                      = activoGetById;
