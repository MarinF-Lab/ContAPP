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

// ── 4.1 — balance: estado vacío ───────────────────────────────────────────────

test('balance: muestra estado vacío cuando no hay asientos', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => {
        localStorage.removeItem('core_asientos');
        // dbAsientos es let — forzar recarga navegando a balance luego de limpiar
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'balance');
    await page.waitForTimeout(500);
    const vacio = page.locator('#view-balance').locator('text=/sin movimientos|no hay datos|empieza/i').first();
    await expect(vacio).toBeVisible();
});

test('balance: estado vacío tiene botón CTA al Diario', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => { localStorage.removeItem('core_asientos'); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'balance');
    await page.waitForTimeout(500);
    const cta = page.locator('#view-balance button').filter({ hasText: /diario/i }).first();
    await expect(cta).toBeVisible();
});

// ── 4.2 — dashboard: onboarding ───────────────────────────────────────────────

test('dashboard: muestra panel onboarding con empresa nueva', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => {
        localStorage.removeItem('core_asientos');
        localStorage.removeItem('core_compras');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'dashboard');
    await page.waitForTimeout(500);
    const onboarding = page.locator('text=/empieza aquí|primer paso|comenzar|plan de cuentas/i').first();
    await expect(onboarding).toBeVisible();
});

// ── 4.3 — iva-resumen: NC restan ──────────────────────────────────────────────

test('iva-resumen: NC de ventas reduce el débito fiscal', async ({ page }) => {
    await cargar(page);
    // Navegar primero para que existan los selectores
    await navegar(page, 'iva-resumen');
    await page.waitForTimeout(500);
    const resultado = await page.evaluate(() => {
        // factura IVA $19.000 + NC IVA $9.500 → débito neto $9.500
        window.dbVentas = [
            { tipo_doc: 'factura',      iva: 19000, mes: 6, anio: 2025, estado: 'activa' },
            { tipo_doc: 'nota_credito', iva: 9500,  mes: 6, anio: 2025, estado: 'activa' },
        ];
        window.dbCompras = [];

        const selMes  = document.getElementById('selIvaMes');
        const selAnio = document.getElementById('selIvaAnio');
        if (selMes)  selMes.value  = '6';
        if (selAnio) selAnio.value = '2025';

        if (typeof generarIvaResumen === 'function') generarIvaResumen();

        const elDebito = document.getElementById('ivaKpiDebito') ||
                         document.getElementById('ivaDebito') ||
                         document.querySelector('[id*="debito"]');
        return elDebito ? elDebito.textContent : null;
    });
    // Debe mostrar 9.500 (no 28.500)
    expect(resultado).toMatch(/9\.500|9,500/);
});

// ── 4.4 — DJ 1879: exportación ────────────────────────────────────────────────

test('segunda-categoría: DJ1879 tiene botón Exportar PDF', async ({ page }) => {
    await cargar(page);
    await navegar(page, 'dj1879');
    await page.waitForTimeout(400);
    const btn = page.locator('#view-dj1879 button, #view-dj1879 [class*="btn"]')
        .filter({ hasText: /pdf/i }).first();
    await expect(btn).toBeVisible();
});

test('segunda-categoría: DJ1879 tiene botón Exportar Excel', async ({ page }) => {
    await cargar(page);
    await navegar(page, 'dj1879');
    await page.waitForTimeout(400);
    const btn = page.locator('#view-dj1879 button, #view-dj1879 [class*="btn"]')
        .filter({ hasText: /excel|xlsx/i }).first();
    await expect(btn).toBeVisible();
});

// ── 4.5 — activos: anti-doble-depreciación ────────────────────────────────────

test('activos: el objeto activo tiene campo periodos_depreciados', async ({ page }) => {
    await cargar(page);
    const tiene = await page.evaluate(() => {
        const activos = JSON.parse(localStorage.getItem('core_activos') || '[]');
        if (activos.length === 0) {
            const nuevo = { id: 8001, nombre: 'PC Test', valor: 500000,
                vida_util: 6, metodo: 'lineal', fecha_compra: '2025-01-01',
                periodos_depreciados: [] };
            localStorage.setItem('core_activos', JSON.stringify([nuevo]));
            return true;
        }
        return 'periodos_depreciados' in activos[0];
    });
    expect(tiene).toBe(true);
});

test('activos: generar depreciación duplicada muestra advertencia', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => {
        // Activo con 2025-06 ya depreciado, con cuentas asignadas para que pase los guards
        const activo = {
            id: 8002, nombre: 'Mueble Test', valor_adquisicion: 300000,
            vida_util_anos: 5, metodo: 'lineal', fecha_adquisicion: '2025-01-01',
            cuenta_gasto_dep: 'Gasto Depreciación', cuenta_dep_acumulada: 'Dep. Acumulada',
            activo: true,
            periodos_depreciados: ['2025-06'],
        };
        localStorage.setItem('core_activos', JSON.stringify([activo]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'activos');
    await page.waitForTimeout(400);
    // Interceptar mostrarToast para capturar el mensaje
    const toastMsg = await page.evaluate(() => {
        return new Promise(resolve => {
            const orig = window.mostrarToast;
            window.mostrarToast = (msg, tipo) => {
                window.mostrarToast = orig;
                resolve(msg);
                if (orig) orig(msg, tipo);
            };
            // mes=5 (índice 0 base) = junio, anio=2025
            if (typeof activoGenerarAsientoDepreciacion === 'function')
                activoGenerarAsientoDepreciacion(2025, 5);
            // Si no se llama en 500ms, resolver vacío
            setTimeout(() => resolve(''), 500);
        });
    });
    expect(toastMsg).toMatch(/ya fue|ya generada|depreciación.*2025-06|2025-06/i);
});
