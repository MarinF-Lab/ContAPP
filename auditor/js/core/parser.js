        // PARSER DE LENGUAJE NATURAL CON REGEX CORREGIDO
        function extraerMontoTotal(glosa) {
            // Prioriza formato chileno con puntos (10.000.000),
            // luego número raw de 4+ dígitos (10000000)
            let match = glosa.match(/\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,})/);
            return match ? limpiarNum(match[1]) : 0;
        }
        
        function extraerCostoExplicito(glosa) {
            let match = glosa.match(/costo\s+(?:de\s+)?\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)/i);
            return match ? limpiarNum(match[1]) : 0;
        }

        function extraerUtilidad(glosa) {
            let match = glosa.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:de\s+)?(?:utilidad|ganancia|margen)/i);
            return match ? parseFloat(match[1]) : 0;
        }

        function clasificarCuentaFinanciera(metodo, tipo, esMercaderia) {
            metodo = metodo.toLowerCase();
            if (/contado|efectivo|caja/i.test(metodo)) return "Caja";
            if (/cheque|transferencia|tarjeta|banco|deposito/i.test(metodo)) return "Banco";
            if (/crédito|credito|letras|plazo|cuotas|factura/i.test(metodo)) {
                if (tipo === "venta") return "Clientes";
                if (tipo === "compra") return esMercaderia ? "Proveedores" : "Acreedores Varios";
            }
            return "Caja";
        }

        function extraerFlujoDinero(glosa, montoTotal, tipo) {
            let flujos = [];
            const gLower = glosa.toLowerCase();
            const esMercaderia = gLower.includes("mercaderia") || gLower.includes("mercadería");
            
            const regexPatrones =
/(?:pagado\s+con\s+)?(?:\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,})|(\d+(?:\.\d+)?)\s*%)\s*(?:al|en|con)?\s*(contado|efectivo|caja|cheque|transferencia|tarjeta|banco|crédito|credito|letras|plazo|factura)/gi;
            let acumulado = 0;
            let match;
            let flag = false;

            while ((match = regexPatrones.exec(gLower)) !== null) {
                flag = true;
                let pct = match[0].includes('%');
                let valorRaw = match[1] || match[2];
                let valorNum = limpiarNum(valorRaw);
                let metodo = match[3];
                
                let calculado = pct ? Math.round(montoTotal * (valorNum / 100)) : valorNum;
                let cuenta = clasificarCuentaFinanciera(metodo, tipo, esMercaderia);
                
                let nodo = flujos.find(f => f.cuenta === cuenta);
                if(nodo) nodo.monto += calculado;
                else flujos.push({ cuenta, monto: calculado });
                acumulado += calculado;
            }
            
            if (!flag) {
                let metodoFallback = 'caja';
                if (/transferencia|transf\b/i.test(gLower))          metodoFallback = 'transferencia';
                else if (/cheque/i.test(gLower))                      metodoFallback = 'cheque';
                else if (/banco|dep[oó]sito/i.test(gLower))           metodoFallback = 'banco';
                else if (/tarjeta/i.test(gLower))                     metodoFallback = 'tarjeta';
                else if (/cr[eé]dito|letras|plazo|factura/i.test(gLower)) metodoFallback = 'credito';
                let cuentaDefecto = clasificarCuentaFinanciera(metodoFallback, tipo, esMercaderia);
                flujos.push({ cuenta: cuentaDefecto, monto: montoTotal });
                acumulado = montoTotal;
            }
            
            if(
    /resto.*(letras|credito|crédito|factura|plazo)/i.test(gLower)
){
    let remanente = montoTotal - acumulado;

    if(remanente > 0){

        let cuentaRemanente;

        if(tipo === "venta"){

            cuentaRemanente = "Clientes";

        }else if(tipo === "compra"){

            cuentaRemanente =
                esMercaderia
                    ? "Proveedores"
                    : "Acreedores Varios";

        }else{

            cuentaRemanente = "Acreedores Varios";

        }

        flujos.push({
            cuenta: cuentaRemanente,
            monto: remanente
        });

        acumulado += remanente;
    }
}


            return flujos;
        }

window.extraerMontoTotal = extraerMontoTotal;
window.extraerCostoExplicito = extraerCostoExplicito;
window.extraerUtilidad = extraerUtilidad;
window.clasificarCuentaFinanciera = clasificarCuentaFinanciera;
window.extraerFlujoDinero = extraerFlujoDinero;