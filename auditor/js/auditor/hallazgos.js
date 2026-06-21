'use strict';
/**
 * hallazgos.js — Lista de observaciones y hallazgos por cliente/período
 * Exclusivo ContAPP Auditor.
 *
 * Estructura en localStorage: aud_hallazgos → array de {
 *   id, clienteId, periodo,   ← "YYYY-MM"
 *   tipo,                     ← 'error' | 'advertencia' | 'sugerencia'
 *   descripcion,
 *   modulo,                   ← dónde se detectó (diario, compras, etc.)
 *   estado,                   ← 'abierto' | 'resuelto'
 *   fechaDeteccion,
 *   fechaResolucion,
 * }
 *
 * TODO: implementar panel de hallazgos con filtros por cliente/período/tipo,
 *       botón "Nuevo hallazgo" en cada vista contable,
 *       exportación al informe de auditoría.
 */

// Placeholder — implementación pendiente
