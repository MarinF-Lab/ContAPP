/**
 * db.js — Wrapper IPC del renderer hacia el proceso principal.
 * Usa electronAPI.db si está disponible (app Electron con SQLite).
 * En web/PWA retorna un no-op silencioso; los datos van a localStorage.
 */

const _DB_NOOP = {
    query:       async () => [],
    get:         async () => null,
    run:         async () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: async () => null,
};

const _api = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.db) return window.electronAPI.db;
    return _DB_NOOP;
};

// ─────────────────────────────────────────────────────────────
//  FUNCIONES GENÉRICAS
// ─────────────────────────────────────────────────────────────

/** Retorna array de filas */
async function dbQuery(sql, params = []) {
    return _api().query(sql, params);
}

/** Retorna una fila o null */
async function dbGet(sql, params = []) {
    return _api().get(sql, params);
}

/** INSERT / UPDATE / DELETE — retorna { changes, lastInsertRowid } */
async function dbRun(sql, params = []) {
    return _api().run(sql, params);
}

/** Transacción atómica: operations = [{ sql, params }, ...] */
async function dbTransaction(operations) {
    return _api().transaction(operations);
}

// ─────────────────────────────────────────────────────────────
//  HELPERS ESPECÍFICOS
// ─────────────────────────────────────────────────────────────

/** Retorna todas las cuentas del plan (nivel 4, activas) ordenadas por código */
async function getPlanCuentas() {
    return dbQuery(`
        SELECT p.id, p.codigo, p.nombre, p.tipo, p.naturaleza, p.nivel, p.activa,
               padre.nombre AS grupo
        FROM   plan_cuentas p
        LEFT   JOIN plan_cuentas padre ON padre.id = p.cuenta_padre_id
        WHERE  p.activa = 1
        ORDER  BY p.codigo
    `);
}

/** Retorna la configuración como objeto { clave: valor } */
async function getConfiguracion() {
    const rows = await dbQuery('SELECT clave, valor FROM configuracion');
    return Object.fromEntries(rows.map(r => [r.clave, r.valor]));
}

/** Guarda o actualiza un par clave/valor de configuración */
async function setConfiguracion(clave, valor) {
    return dbRun(
        'INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)',
        [clave, String(valor)]
    );
}

// ─────────────────────────────────────────────────────────────
//  EXPORTS — disponibles como globales en el renderer
// ─────────────────────────────────────────────────────────────
window.dbQuery        = dbQuery;
window.dbGet          = dbGet;
window.dbRun          = dbRun;
window.dbTransaction  = dbTransaction;
window.getPlanCuentas = getPlanCuentas;
window.getConfiguracion  = getConfiguracion;
window.setConfiguracion  = setConfiguracion;
