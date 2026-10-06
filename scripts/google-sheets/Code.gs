const SPREADSHEET_ID = '15nWIlcX6tPPZdIo1fDs-7rd335w_LSiUw7ZGGyeEvKY';

function doPost(e) {
  try {
    const params = getRequestParams(e);
    if (params.website) return jsonResponse({ success: true, ignored: true });

    const contact = params.contact || params.contactPerson || '';
    const requiredFields = [params.team, contact, params.email, params.location];
    if (requiredFields.some((value) => !String(value || '').trim())) {
      return jsonResponse({ success: false, error: 'missing_fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(params.email))) {
      return jsonResponse({ success: false, error: 'invalid_email' });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = 'Demo-förfrågningar';
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    const headers = ['Mottagen', 'Lag eller förening', 'Idrott', 'Antal spelare', 'Kontaktperson', 'E-post', 'Telefon', 'Ort eller kommun'];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
    sheet.appendRow([
      new Date(),
      safeCell(params.team),
      safeCell(params.sport),
      safeCell(params.players),
        safeCell(contact),
      safeCell(params.email),
      safeCell(params.phone),
      safeCell(params.location),
    ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function getRequestParams(e) {
  const params = e && e.parameter ? e.parameter : {};
  const contentType = e && e.postData && e.postData.type ? e.postData.type : '';
  if (contentType.indexOf('application/json') !== -1 && e.postData.contents) {
    return Object.assign({}, params, JSON.parse(e.postData.contents));
  }
  return params;
}

function safeCell(value) {
  const text = String(value || '').trim();
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}