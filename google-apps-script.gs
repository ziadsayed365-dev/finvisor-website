// Paste this into the Apps Script editor attached to your "Finvisor Data Form" Google Sheet.
// See setup steps in the project README / chat instructions.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Full Name', 'Business Name', 'Type of Business', 'Phone']);
  }

  sheet.appendRow([
    new Date(),
    data.fullName || '',
    data.businessName || '',
    data.businessType || '',
    data.phone || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
