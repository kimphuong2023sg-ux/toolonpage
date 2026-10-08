const fs = require('fs');
const content = fs.readFileSync('./server/legacy/server.js', 'utf8');
const regex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
let m;
const routes = [];
while ((m = regex.exec(content)) !== null) {
  routes.push(`${m[1].toUpperCase().padEnd(6)} ${m[2]}`);
}
console.log(routes.join('\n'));
