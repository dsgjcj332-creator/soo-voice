import fs from 'fs';
import path from 'path';

function walkIter(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkIter(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = walkIter('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/\bml-/g, 'ms-');
  content = content.replace(/\bmr-/g, 'me-');
  content = content.replace(/\bpl-/g, 'ps-');
  content = content.replace(/\bpr-/g, 'pe-');
  content = content.replace(/\btext-left\b/g, 'text-start');
  content = content.replace(/\btext-right\b/g, 'text-end');
  
  content = content.replace(/\bborder-r\b/g, 'border-e');
  content = content.replace(/\bborder-l\b/g, 'border-s');
  content = content.replace(/\bborder-r-/g, 'border-e-');
  content = content.replace(/\bborder-l-/g, 'border-s-');
  content = content.replace(/\brounded-r-/g, 'rounded-e-');
  content = content.replace(/\brounded-l-/g, 'rounded-s-');
  content = content.replace(/\brounded-br-/g, 'rounded-ee-');
  content = content.replace(/\brounded-bl-/g, 'rounded-es-');
  content = content.replace(/\brounded-tr-/g, 'rounded-se-');
  content = content.replace(/\brounded-tl-/g, 'rounded-ss-');

  // Positioning
  content = content.replace(/\bleft-/g, 'start-');
  content = content.replace(/\bright-/g, 'end-');

  fs.writeFileSync(file, content);
});
console.log('Converted layout classes to logical properties.');
