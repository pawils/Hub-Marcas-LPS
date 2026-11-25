// server/utils/voucher-ai.service.js
// Sprint 5 (Punto 1): Validación Inteligente de Vouchers Yape / Plin con Visión IA (Gemini 2.5 Flash) y Anti-Fraude
const pool = require('../db.config');
const logger = require('./logger');

/**
 * Analiza la imagen del comprobante con Gemini 2.5 Flash (si GEMINI_API_KEY está configurada),
 * extrae { nro_operacion, monto, fecha, billetera } y verifica en PostgreSQL si el número
 * de operación ya fue utilizado en otro pedido del negocio.
 */
async function analizarVoucherConIA({ fileBuffer, mimeType, montoEsperado, negocioId, pedidoIdActual = null }) {
    const defaultResult = {
        nro_operacion: null,
        monto_detectado: null,
        entidad_detectada: null,
        verificacion_ia: 'pendiente'
    };

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        return defaultResult;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        return defaultResult;
    }

    try {
        const b64Image = fileBuffer.toString('base64');
        const prompt = `Analiza este comprobante de pago móvil peruano (Plin, Yape, BCP, Interbank, BBVA o Scotiabank).
Devuelve ÚNICAMENTE un objeto JSON válido sin markdown con las siguientes claves:
{
  "nro_operacion": "string con solo dígitos o código de operación, o null si no es legible",
  "monto": numero decimal del monto transferido en soles (ej. 20.00) o null,
  "fecha": "fecha detectada en texto o null",
  "billetera": "Plin" | "Yape" | "BCP" | "Interbank" | "BBVA" | "Scotiabank" | "Otro"
}`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType || 'image/jpeg',
                                    data: b64Image
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!response.ok) {
            logger.warn('Voucher IA: Gemini API respondió con estado no OK', { status: response.status });
            return defaultResult;
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) return defaultResult;

        const cleanedJson = rawText.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(cleanedJson);

        const nroOp = parsed.nro_operacion ? String(parsed.nro_operacion).trim().slice(0, 40) : null;
        const montoDet = parsed.monto !== null && parsed.monto !== undefined && !Number.isNaN(Number(parsed.monto))
            ? Number(Number(parsed.monto).toFixed(2))
            : null;
        const entidadDet = parsed.billetera ? String(parsed.billetera).trim().slice(0, 40) : 'Plin';

        let estadoVerificacion = 'pendiente';

        // 1. Verificar duplicidad de N° de operación en otros pedidos del mismo negocio
        if (nroOp && nroOp.length >= 4) {
            const dupQuery = pedidoIdActual
                ? `SELECT id, codigo_pedido FROM negocio_pedidos WHERE negocio_id = $1 AND voucher_nro_operacion = $2 AND id != $3 LIMIT 1`
                : `SELECT id, codigo_pedido FROM negocio_pedidos WHERE negocio_id = $1 AND voucher_nro_operacion = $2 LIMIT 1`;
            const dupParams = pedidoIdActual ? [negocioId, nroOp, pedidoIdActual] : [negocioId, nroOp];
            const { rows: dupRows } = await pool.query(dupQuery, dupParams);

            if (dupRows.length > 0) {
                estadoVerificacion = 'duplicado';
            }
        }

        // 2. Si no es duplicado, comparar el monto detectado contra el monto de reserva esperado
        if (estadoVerificacion !== 'duplicado') {
            if (montoDet !== null && Number(montoEsperado) > 0) {
                const diff = Math.abs(montoDet - Number(montoEsperado));
                estadoVerificacion = diff <= 0.50 ? 'verificado' : 'monto_difiere';
            } else if (nroOp) {
                estadoVerificacion = 'verificado';
            }
        }

        return {
            nro_operacion: nroOp,
            monto_detectado: montoDet,
            entidad_detectada: entidadDet,
            verificacion_ia: estadoVerificacion
        };
    } catch (err) {
        logger.error('Voucher IA: error procesando comprobante', { error: err.message });
        return defaultResult;
    }
}

module.exports = { analizarVoucherConIA };
