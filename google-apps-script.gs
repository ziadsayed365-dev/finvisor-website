// Paste this into the Apps Script editor attached to your "Finvisor Data Form" Google Sheet, then
// Deploy > Manage deployments > edit the existing Web app deployment > New version > Deploy.
// Don't press Run in the editor: doPost only works when the website sends it a form.
//
// Each value is written under its column heading, not by position. A heading that isn't in row 1
// yet is added at the end, so columns can be moved, and old ones (Business Name, Email) deleted,
// without new submissions landing in the wrong place.

var COLUMNS = [
  { header: 'Timestamp' },
  { header: 'Full Name', key: 'fullName' },
  { header: 'Store Website', key: 'storeWebsite' },
  { header: 'Type of Business', key: 'businessType' },
  { header: 'Phone', key: 'phone' },
  { header: 'Monthly Orders', key: 'monthlyOrders' },
  // Where the lead came from: "Website Contact Form", "Pricing App" or "CPA Limit App".
  { header: 'Source', key: 'source' }
];

function doPost(e) {
  if (!e || !e.postData) {
    throw new Error('doPost runs when the website sends a form. Deploy the script instead of pressing Run.');
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  if (!data.source) data.source = 'Website Contact Form';

  var lastColumn = sheet.getLastColumn();
  var headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];

  COLUMNS.forEach(function (column) {
    if (headers.indexOf(column.header) === -1) {
      headers.push(column.header);
      sheet.getRange(1, headers.length).setValue(column.header);
    }
  });

  var row = headers.map(function (header) {
    var column = COLUMNS.filter(function (c) { return c.header === header; })[0];
    if (!column) return '';
    return column.key ? (data[column.key] || '') : new Date();
  });
  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
