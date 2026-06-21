'use strict';
/**
 * multi-cliente.js — Gestión de múltiples empresas/clientes
 * Exclusivo ContAPP Auditor.
 *
 * Estructura en localStorage: aud_clientes → array de {
 *   id, nombre, rut, giro, fechaIngreso,
 *   esPropio,           ← true para la contabilidad propia del contador
 *   modulosActivos,     ← array de módulos habilitados para este cliente
 *   color,              ← color de avatar en el selector
 * }
 *
 * Cliente activo: aud_cliente_activo → id del cliente seleccionado.
 * Al cambiar de cliente, se recarga el prefijo de localStorage
 * para que cada cliente tenga sus propios datos aislados.
 *
 * TODO: implementar selector visual en la pantalla de inicio,
 *       aislamiento de datos por cliente (prefijo de keys),
 *       y formulario de registro de nuevo cliente.
 */

// Placeholder — implementación pendiente
