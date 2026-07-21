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
  let changed = false;

  const replaceMap = {
    "role: 'user'": "role: ChatRole.USER",
    "role: 'system'": "role: ChatRole.SYSTEM",
    "role: 'assistant'": "role: ChatRole.ASSISTANT",
    "role: \"user\"": "role: ChatRole.USER",
    "role: \"system\"": "role: ChatRole.SYSTEM",
    "role: \"assistant\"": "role: ChatRole.ASSISTANT"
  };

  for (const [find, replace] of Object.entries(replaceMap)) {
    if (content.includes(find)) {
      content = content.split(find).join(replace);
      changed = true;
    }
  }

  if (changed) {
    if (!content.includes('import { ChatRole }')) {
      const importStr = "import { ChatRole } from '../types';\n";
      content = importStr + content;
    }
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
