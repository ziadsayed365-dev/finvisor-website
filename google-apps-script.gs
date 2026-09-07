// Paste this into the Apps Script editor attached to your "Finvisor Data Form" Google Sheet,
// then Deploy > Manage deployments > edit the existing Web app deployment > Deploy.
// Redeploying is required for the new Email / Monthly Orders columns to be captured.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp', 'Full Name', 'Business Name', 'Type of Business',
      'Phone', 'Email', 'Monthly Orders'
    ]);
  }

  sheet.appendRow([
    new Date(),
    data.fullName || '',
    data.businessName || '',
    data.businessType || '',
    data.phone || '',
    data.email || '',
    data.monthlyOrders || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
