const fs = require('fs');

const targetFile = 'c:/Users/Christian/seat-table-mngmnt/frontend/src/features/admin/pages/ReservationDashboard.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

// The issue: color:C.textTertiary}> should be color:C.textTertiary}}>
content = content.replace(/color:C\.textTertiary}>/g, 'color:C.textTertiary}}>');

fs.writeFileSync(targetFile, content);
console.log('Fixed JSX errors');
