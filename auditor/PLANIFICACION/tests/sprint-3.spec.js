const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8080';

async function cargar(page) {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
}

async function navegar(page, vista) {
    await page.evaluate((v) => { if (typeof navegar === 'function') navegar(v, null); }, vista);
    await page.waitForTimeout(400);
}

// ── 3.1 — editarDocumento() ───────────────────────────────────────────────────

test('documentos: editarDocumento() existe como función global', async ({ page }) => {
    await cargar(page);
    const existe = await page.evaluate(() => typeof editarDocumento === 'function');
    expect(existe).toBe(true);
});

test('documentos: _docEditandoId existe como variable', async ({ page }) => {
    await cargar(page);
    const existe = await page.evaluate(() => typeof _docEditandoId !== 'undefined');
    expect(existe).toBe(true);
});

test('documentos: cada fila tiene botón Editar', async ({ page }) => {
    await cargar(page);
    // Insertar un documento de prueba en localStorage
    await page.evaluate(() => {
        const anio = new Date().getFullYear();
        const docs = [{ id: 9001, categoria: 'compra_materia', numero_doc: '1', nombre: 'Test SA',
            rut: '11.111.111-1', neto: 100000, iva: 19000, total: 119000,
            fecha: `01/06/${anio}`, estado: 'pendiente' }];
        localStorage.setItem('core_documentos', JSON.stringify(docs));
    });
    await navegar(page, 'documentos');
    const btn = page.locator('#view-documentos button').filter({ hasText: /editar/i }).first();
    await expect(btn).toBeVisible();
});

test('documentos: editar carga datos en el formulario', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => {
        const docs = [{ id: 9002, tipo: 'factura', numero_doc: '99', nombre: 'Empresa ABC',
            rut: '22.222.222-2', neto: 50000, iva: 9500, bruto: 59500,
            fecha: '01/06/2025', estado: 'pendiente', medio_pago: 'contado' }];
        localStorage.setItem('core_documentos', JSON.stringify(docs));
        window._docEditandoId = null;
    });
    await navegar(page, 'documentos');
    await page.evaluate(() => editarDocumento(9002));
    await page.waitForTimeout(300);
    // El formulario debe mostrar el número de documento
    const campo = page.locator('input[id*="docNumero"], input[id*="numero"]').first();
    const valor = await campo.inputValue().catch(() => '');
    expect(valor).toBe('99');
});

// ── 3.2 — cartolas: persistencia al clasificar ───────────────────────────────

test('cartolas: guardarCartolas() existe como función global', async ({ page }) => {
    await cargar(page);
    const existe = await page.evaluate(() => typeof guardarCartolas === 'function');
    expect(existe).toBe(true);
});

test('cartolas: clasificar un movimiento persiste en localStorage', async ({ page }) => {
    await cargar(page);
    const persistido = await page.evaluate(() => {
        // Simular un movimiento clasificado
        const movs = [{ id: 'mv-1', descripcion: 'Pago proveedor', monto: -50000,
            fecha: '2025-06-01', estado: 'pendiente', cuentaContrapartida: null }];
        localStorage.setItem('core_cartola_movs', JSON.stringify(movs));

        // Clasificar
        movs[0].cuentaContrapartida = 'Proveedores';
        movs[0].estado = 'clasificado';

        // Llamar guardar (debe persistir sin necesitar generar asientos)
        if (typeof guardarCartolas === 'function') guardarCartolas(movs);

        const guardado = JSON.parse(localStorage.getItem('core_cartola_movs') || '[]');
        return guardado[0]?.estado === 'clasificado';
    });
    expect(persistido).toBe(true);
});
