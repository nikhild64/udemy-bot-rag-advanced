const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = walk(path.join(process.cwd(), 'src'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes("import { ChatRole } from '../types';\n")) {
    content = content.split("import { ChatRole } from '../types';\n").join("import { ChatRole } from '@/types';\n");
    fs.writeFileSync(file, content);
    console.log('Fixed imports', file);
  }
}
