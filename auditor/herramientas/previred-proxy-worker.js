// ─────────────────────────────────────────────────────────────────────────────
//  Cloudflare Worker — proxy CORS de solo lectura para previred.com
//
//  Por qué existe: previred.com no tiene CORS habilitado, así que el navegador
//  no puede leer directamente su página de indicadores ni el PDF mensual. Este
//  Worker corre en la infraestructura de Cloudflare (no en el navegador), así
//  que no tiene esa restricción — reenvía el pedido y agrega el header
//  Access-Control-Allow-Origin para que ContApp Auditor sí pueda leer la
//  respuesta.
//
//  Seguridad: solo reenvía pedidos a *.previred.com — cualquier otro dominio
//  se rechaza con 403, para que este Worker no se pueda usar como proxy
//  abierto hacia otros sitios.
//
//  Deploy:
//  1. dash.cloudflare.com → Workers & Pages → Create → Create Worker
//  2. Pegar este archivo completo, reemplazando el código de ejemplo
//  3. Deploy
//  4. Copiar la URL del Worker (algo como https://xxxx.tu-usuario.workers.dev)
//     y pegarla en ContApp Auditor → Configuración → Previred → "URL del proxy"
// ─────────────────────────────────────────────────────────────────────────────

export default {
    async fetch(request) {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url    = new URL(request.url);
        const target = url.searchParams.get('url');
        if (!target) {
            return new Response('Falta el parámetro ?url=', { status: 400, headers: CORS_HEADERS });
        }

        let targetUrl;
        try {
            targetUrl = new URL(target);
        } catch {
            return new Response('URL inválida', { status: 400, headers: CORS_HEADERS });
        }

        if (!/(^|\.)previred\.com$/i.test(targetUrl.hostname)) {
            return new Response('Dominio no permitido — solo previred.com', { status: 403, headers: CORS_HEADERS });
        }

        let resp;
        try {
            resp = await fetch(targetUrl.toString(), {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContAppAuditorBot/1.0)' },
            });
        } catch (e) {
            return new Response('Error al conectar con previred.com: ' + e.message, { status: 502, headers: CORS_HEADERS });
        }

        const body = await resp.arrayBuffer();
        return new Response(body, {
            status: resp.status,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    },
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};
