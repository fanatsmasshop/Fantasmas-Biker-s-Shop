/**
 * FANTASMAS BIKER'S SHOP — ENVÍO DE ACTUALIZACIONES DESDE GMAIL
 * Este archivo se pega en https://script.google.com
 * No se sube a GitHub Pages.
 *
 * Propiedades del script necesarias:
 * WEBHOOK_SECRET = clave larga creada por ti
 * REPLY_TO_EMAIL = correo de respuesta (opcional)
 */

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function plainText_(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function doGet() {
  return jsonResponse_({ ok: true, service: "Fantasmas Gmail Mailer", remaining: MailApp.getRemainingDailyQuota() });
}

function doPost(event) {
  try {
    var properties = PropertiesService.getScriptProperties();
    var expectedSecret = properties.getProperty("WEBHOOK_SECRET");
    var data = JSON.parse(event && event.postData ? event.postData.contents : "{}");

    if (!expectedSecret || data.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: "No autorizado" });
    }

    var to = String(data.to || "").trim().toLowerCase();
    var subject = String(data.subject || "").trim().slice(0, 180);
    var html = String(data.html || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return jsonResponse_({ ok: false, error: "Destinatario inválido" });
    if (!subject || !html || html.length > 180000) return jsonResponse_({ ok: false, error: "Contenido inválido" });
    if (MailApp.getRemainingDailyQuota() < 1) return jsonResponse_({ ok: false, error: "Límite diario alcanzado" });

    var message = {
      to: to,
      subject: subject,
      body: plainText_(html),
      htmlBody: html,
      name: "Fantasmas Biker's Shop"
    };
    var replyTo = properties.getProperty("REPLY_TO_EMAIL");
    if (replyTo) message.replyTo = replyTo;

    MailApp.sendEmail(message);
    return jsonResponse_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}
