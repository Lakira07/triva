const SPREADSHEET_ID = '15nWIlcX6tPPZdIo1fDs-7rd335w_LSiUw7ZGGyeEvKY';

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.website) return textResponse('ok');

  const requiredFields = ['team', 'contact', 'email', 'location'];
  if (requiredFields.some((field) => !String(params[field] || '').trim())) {
    return textResponse('missing_fields');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(params.email))) {
    return textResponse('invalid_email');
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
      safeCell(params.contact),
      safeCell(params.email),
      safeCell(params.phone),
      safeCell(params.location),
    ]);
  } finally {
    lock.releaseLock();
  }

  return textResponse('ok');
}

function safeCell(value) {
  const text = String(value || '').trim();
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

function textResponse(message) {
  return ContentService.createTextOutput(message);
}