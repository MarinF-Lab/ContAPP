// FORMATOS MATEMÁTICOS
function fmt(num) { return num === 0 ? '-' : new Intl.NumberFormat('es-CL').format(Math.round(num)); }
function limpiarNum(str) { return parseFloat(String(str).replace(/[$]/g, '').replace(/\./g, '').replace(/,/g, '')) || 0; }

// ─────────────────────────────────────────────────────────────
//  TASA DE IVA — fuente única de verdad
//  Lee el porcentaje configurado en core_config (ej. "19").
//  Ningún módulo debe hardcodear 0.19 / 1.19: usar estos helpers.
// ─────────────────────────────────────────────────────────────
function tasaIva() {
    try {
        const cfg = JSON.parse(localStorage.getItem('core_config')) || {};
        const r = parseFloat(cfg.iva);
        if (!isNaN(r) && r > 0 && r < 100) return r / 100;
    } catch { /* config ausente o corrupta → usar default */ }
    return 0.19;
}
function factorIva() { return 1 + tasaIva(); }      // ej. 1.19
function ivaPct()    { return Math.round(tasaIva() * 100); } // ej. 19

window.tasaIva   = tasaIva;
window.factorIva = factorIva;
window.ivaPct    = ivaPct;

// Formatea un input de monto con separadores de miles chilenos mientras el usuario escribe.
// El parseo sigue funcionando con .replace(/\D/g,'') ya que los puntos se descartan.
function fmtMoneyInput(el) {
    const raw = el.value.replace(/\D/g, '');
    el.value  = raw ? parseInt(raw, 10).toLocaleString('es-CL') : '';
}

window.fmt          = fmt;
window.limpiarNum   = limpiarNum;
window.fmtMoneyInput = fmtMoneyInput;

// ─────────────────────────────────────────────────────────────
//  CONVERSIÓN UF / UTM → PESOS CHILENOS
//  Usa los valores del día cargados en window.indicadoresEconomicos
//  Retorna null si el indicador aún no está disponible.
// ─────────────────────────────────────────────────────────────
function ufAPesos(montoUF) {
    const val = parseFloat(window.indicadoresEconomicos?.uf?.valor);
    if (isNaN(val) || val <= 0) return null;
    return Math.round(montoUF * val);
}

function utmAPesos(montoUTM) {
    const val = parseFloat(window.indicadoresEconomicos?.utm?.valor);
    if (isNaN(val) || val <= 0) return null;
    return Math.round(montoUTM * val);
}

function pesosAUF(montoPesos) {
    const val = parseFloat(window.indicadoresEconomicos?.uf?.valor);
    if (isNaN(val) || val <= 0) return null;
    return parseFloat((montoPesos / val).toFixed(4));
}

function pesosAUTM(montoPesos) {
    const val = parseFloat(window.indicadoresEconomicos?.utm?.valor);
    if (isNaN(val) || val <= 0) return null;
    return parseFloat((montoPesos / val).toFixed(4));
}

window.ufAPesos   = ufAPesos;
window.utmAPesos  = utmAPesos;
window.pesosAUF   = pesosAUF;
window.pesosAUTM  = pesosAUTM;

function exportarERP(){

    const respaldo = {

        version: "1.0",

        fecha:
            new Date()
            .toISOString(),

        asientos:
            dbAsientos || [],

        planCuentas:
            PLAN_CUENTAS || {},

        localStorageCompleto: {

            core_asientos:
                localStorage.getItem(
                    "core_asientos"
                ),

            core_plan_cuentas:
                localStorage.getItem(
                    "core_plan_cuentas"
                )

        }

    };

    const blob = new Blob(

        [
            JSON.stringify(
                respaldo,
                null,
                2
            )
        ],

        {
            type:
                "application/json"
        }

    );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        `ContApp_Backup_${
            new Date()
            .toISOString()
            .slice(0,10)
        }.json`;

    a.click();

    URL.revokeObjectURL(url);

}

function importarERP(event){

    const archivo =
        event.target.files[0];

    if(!archivo)
        return;

    const lector =
        new FileReader();

    lector.onload = function(e){

        try{

            const datos =
                JSON.parse(
                    e.target.result
                );

            if(
                !datos.asientos
            ){

                alert(
                    "Archivo inválido."
                );

                return;
            }

            if(
                !confirm(
                    "Esto reemplazará toda la información actual. ¿Continuar?"
                )
            ){
                return;
            }

            dbAsientos =
                datos.asientos || [];

            PLAN_CUENTAS =
                datos.planCuentas || {};

            localStorage.setItem(
                "core_asientos",
                JSON.stringify(
                    dbAsientos
                )
            );

            localStorage.setItem(
                "core_plan_cuentas",
                JSON.stringify(
                    PLAN_CUENTAS
                )
            );

            if(
                typeof renderHistorialDiario
                === "function"
            ){
                renderHistorialDiario();
            }

            if(
                typeof renderPlanCuentas
                === "function"
            ){
                renderPlanCuentas();
            }

            if(
                typeof generarLibroMayor
                === "function"
            ){
                generarLibroMayor();
            }

            if(
                typeof generarBalanceGeneral
                === "function"
            ){
                generarBalanceGeneral();
            }

            alert(
                "Respaldo restaurado correctamente."
            );

        }

        catch(err){

            console.error(err);

            alert(
                "No fue posible importar el archivo."
            );

        }

    };

    lector.readAsText(
        archivo
    );

}

// Retorna el siguiente número de asiento correlativo, ignorando entradas sin número o con NaN.
function _nextNumeroAsiento() {
    const nums = (dbAsientos || [])
        .map(a => a.numero)
        .filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n));
    return nums.length ? Math.max(...nums) + 1 : 1;
}
window._nextNumeroAsiento = _nextNumeroAsiento;

function guardarRespaldoAutomatico(){

    localStorage.setItem(

        "ultimo_backup",

        JSON.stringify({

            fecha:
                new Date(),

            asientos:
                dbAsientos,

            plan:
                PLAN_CUENTAS

        })

    );

}