/**
 * sprint-1.spec.js — Tests de browser para Sprint 1
 * Requiere: npx playwright test PLANIFICACION/tests/sprint-1.spec.js --headed
 * El servidor local debe estar corriendo: python -m http.server 8080
 *
 * Estos tests verifican que las funciones NO SOLO EXISTEN sino que FUNCIONAN
 * en el browser real con el DOM y localStorage reales.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8080';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page) {
    // Si la app redirige a login, intentar acceso directo o saltarlo con localStorage
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // Inyectar un usuario simulado si la app lo permite (para tests locales)
    await page.evaluate(() => {
        // Solo si no hay sesión activa
        if (!window.currentUser) {
            window.currentUser = {
                uid: 'test-uid',
                email: 'test@test.com',
                canInvite: true,
                esInvitado: false,
                estado: 'activo',
            };
            // Empresa simulada
            window.empresaActual = {
                id: 'empresa-test',
                nombre: 'Empresa Test SpA',
                rut: '76.000.000-0',
                categoria: 'primera',
            };
        }
    });
}

// ── HALLAZGOS ─────────────────────────────────────────────────────────────────

test('hallazgos: audHallazgoCrear() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof audHallazgoCrear === 'function');
    expect(existe).toBe(true);
});

test('hallazgos: audHallazgosCargar() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof audHallazgosCargar === 'function');
    expect(existe).toBe(true);
});

test('hallazgos: audHallazgoResolver() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof audHallazgoResolver === 'function');
    expect(existe).toBe(true);
});

test('hallazgos: audHallazgosExportar() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof audHallazgosExportar === 'function');
    expect(existe).toBe(true);
});

test('hallazgos: crear hallazgo guarda en localStorage', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const guardado = await page.evaluate(() => {
        // Limpiar estado previo
        localStorage.removeItem('aud_hallazgos');

        // Simular empresa activa
        window.empresaActual = { id: 'test-empresa' };

        // Crear hallazgo
        audHallazgoCrear('error', 'Factura sin IVA detectada', 'compras');

        // Verificar que quedó en localStorage
        const data = JSON.parse(localStorage.getItem('aud_hallazgos') || '[]');
        return data.length === 1 && data[0].descripcion === 'Factura sin IVA detectada';
    });

    expect(guardado).toBe(true);
});

test('hallazgos: resolver hallazgo cambia estado a resuelto', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const resuelto = await page.evaluate(() => {
        localStorage.removeItem('aud_hallazgos');
        window.empresaActual = { id: 'test-empresa' };

        audHallazgoCrear('advertencia', 'Saldo negativo en caja', 'balance');
        const data = JSON.parse(localStorage.getItem('aud_hallazgos') || '[]');
        const id = data[0]?.id;
        if (!id) return false;

        audHallazgoResolver(id);
        const actualizado = JSON.parse(localStorage.getItem('aud_hallazgos') || '[]');
        return actualizado[0]?.estado === 'resuelto';
    });

    expect(resuelto).toBe(true);
});

test('hallazgos: el menú lateral tiene enlace a Hallazgos', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // Buscar cualquier elemento en el sidebar/nav que diga "Hallazgos"
    const enlace = page.locator('nav, aside, #sidebar').filter({ hasText: /hallazgos/i }).first();
    await expect(enlace).toBeVisible();
});

test('hallazgos: diario tiene botón para agregar hallazgo', async ({ page }) => {
    await login(page);

    // Navegar a la vista del Diario usando navegar() directo
    await page.evaluate(() => {
        if (typeof navegar === 'function') navegar('diario', null);
    });
    await page.waitForTimeout(500);

    // Verificar que hay algún botón o elemento relacionado con hallazgos
    const btn = page.locator('button, [onclick]').filter({ hasText: /hallazgo/i }).first();
    await expect(btn).toBeVisible();
});

// ── INFORME DE AUDITORÍA ──────────────────────────────────────────────────────

test('informe: informeExportarPDF() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof informeExportarPDF === 'function');
    expect(existe).toBe(true);
});

test('informe: informeGuardarBorrador() existe como función global', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const existe = await page.evaluate(() => typeof informeGuardarBorrador === 'function');
    expect(existe).toBe(true);
});

test('informe: guardar borrador persiste en localStorage', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const guardado = await page.evaluate(() => {
        localStorage.removeItem('aud_informe_borrador');
        // Simular que el usuario llenó el formulario
        const input = document.getElementById('infOpinion');
        if (input) input.value = 'La contabilidad está al día sin observaciones mayores.';

        informeGuardarBorrador();
        const data = JSON.parse(localStorage.getItem('aud_informe_borrador') || 'null');
        return !!data;
    });

    expect(guardado).toBe(true);
});
