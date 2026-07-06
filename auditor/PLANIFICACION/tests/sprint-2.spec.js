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

// ── 2.1 — alert() eliminados en diario.js ────────────────────────────────────

test('diario: no lanza alert() al validar glosa vacía', async ({ page }) => {
    await cargar(page);
    let alertDisparado = false;
    page.on('dialog', d => { alertDisparado = true; d.dismiss(); });
    await navegar(page, 'diario');
    // Llamar procesarGlosa() directamente con campo vacío
    await page.evaluate(() => {
        const el = document.getElementById('glosaInput');
        if (el) el.value = '';
        if (typeof procesarGlosa === 'function') procesarGlosa();
    });
    await page.waitForTimeout(300);
    expect(alertDisparado).toBe(false);
});

test('diario: mostrarToast existe como función global', async ({ page }) => {
    await cargar(page);
    const existe = await page.evaluate(() => typeof mostrarToast === 'function');
    expect(existe).toBe(true);
});

// ── 2.2 — Libro Mayor muestra glosa ──────────────────────────────────────────

test('mayor: la tabla incluye columna Glosa', async ({ page }) => {
    // Setear datos ANTES de cargar la página para que dbAsientos se inicialice con ellos
    await page.goto(BASE);
    await page.evaluate(() => {
        const asiento = [{ id: 1, numero: 1, glosa: 'Venta de prueba', fecha: '2025-01-15', estado: 'OK',
            movimientos: [{ cuenta: 'Caja', debe: 100000, haber: 0 }, { cuenta: 'Ventas', debe: 0, haber: 100000 }] }];
        localStorage.setItem('core_asientos', JSON.stringify(asiento));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'mayor');
    const col = page.locator('th').filter({ hasText: /glosa/i }).first();
    await expect(col).toBeVisible();
});

test('mayor: la tabla incluye columna N° o Número', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
        const asiento = [{ id: 1, numero: 1, glosa: 'Venta de prueba', fecha: '2025-01-15', estado: 'OK',
            movimientos: [{ cuenta: 'Caja', debe: 100000, haber: 0 }, { cuenta: 'Ventas', debe: 0, haber: 100000 }] }];
        localStorage.setItem('core_asientos', JSON.stringify(asiento));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navegar(page, 'mayor');
    const col = page.locator('th').filter({ hasText: /n°|número|asiento/i }).first();
    await expect(col).toBeVisible();
});

// ── 2.3 — Filtros del Mayor ───────────────────────────────────────────────────

test('mayor: tiene selector de cuenta', async ({ page }) => {
    await cargar(page);
    await navegar(page, 'mayor');
    const sel = page.locator('select').first();
    await expect(sel).toBeVisible();
});

test('mayor: tiene selector de período', async ({ page }) => {
    await cargar(page);
    await navegar(page, 'mayor');
    const selectores = await page.locator('select').count();
    expect(selectores).toBeGreaterThanOrEqual(2);
});

// ── 2.4 — alert() eliminados en plan-cuentas.js ───────────────────────────────

test('plan-cuentas: no lanza alert() al validar cuenta vacía', async ({ page }) => {
    await cargar(page);
    let alertDisparado = false;
    page.on('dialog', d => { alertDisparado = true; d.dismiss(); });
    await navegar(page, 'plan-cuentas');
    const btn = page.locator('button').filter({ hasText: /agregar|nueva cuenta/i }).first();
    if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const guardar = page.locator('button').filter({ hasText: /guardar/i }).first();
        if (await guardar.isVisible()) await guardar.click();
    }
    await page.waitForTimeout(300);
    expect(alertDisparado).toBe(false);
});

// ── 2.6 — mostrarConfirm() propio ────────────────────────────────────────────

test('sistema: mostrarConfirm() existe como función global', async ({ page }) => {
    await cargar(page);
    const existe = await page.evaluate(() => typeof mostrarConfirm === 'function');
    expect(existe).toBe(true);
});

test('sistema: mostrarConfirm() renderiza un modal en el DOM', async ({ page }) => {
    await cargar(page);
    await page.evaluate(() => {
        mostrarConfirm('¿Prueba?', () => {});
    });
    await page.waitForTimeout(200);
    const modal = page.locator('.modal-confirm');
    await expect(modal).toBeVisible();
});
