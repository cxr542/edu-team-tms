import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';

const dirPath = '/Users/yhkim/okestro-app/apps/TMS(Team Management System)';
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));

if (files.length > 0) {
  const excelFile = path.join(dirPath, files[0]);
  const workbook = XLSX.readFile(excelFile);
  const result = {};
  
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (jsonData.length > 0) {
      result[sheetName] = {
        headers: Object.keys(jsonData[0]),
        sample: jsonData.slice(0, 3)
      };
    } else {
      result[sheetName] = { headers: [], sample: [] };
    }
  });

  fs.writeFileSync(
    '/Users/yhkim/okestro-app/apps/TMS(Team Management System)/excel_schema.json',
    JSON.stringify(result, null, 2)
  );
  console.log('Successfully wrote schema to excel_schema.json');
} else {
  console.log('No Excel files found.');
}
