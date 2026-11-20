// server/utils/email.service.js — Notificaciones por correo (Resend API opcional)
const logger = require('./logger');

async function sendNegocioInscripcionEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    logger.info('Email omitido (RESEND_API_KEY no configurada)', { to: payload.to, taller: payload.tallerNombre });
    return;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'notificaciones@lospilares.pe',
        to: [payload.to],
        subject: `Nueva inscripción a taller: ${payload.tallerNombre}`,
        html: `<p><strong>Participante:</strong> ${payload.nombre} (${payload.edad} años)</p>
               <p><strong>WhatsApp:</strong> ${payload.whatsapp}</p>
               <p><strong>Taller:</strong> ${payload.tallerNombre}</p>`
      })
    });
  } catch (err) {
    logger.error('Error enviando correo con Resend', { error: err.message });
  }
}

module.exports = { sendNegocioInscripcionEmail };
