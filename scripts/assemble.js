const fs = require('fs');
const path = require('path');

function assemble(partsDir, outFile, prefix) {
  const files = fs.readdirSync(partsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.txt'))
    .sort();
  const body = files
    .map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8'))
    .join('');
  fs.writeFileSync(outFile, body);
  console.log('assembled', outFile, 'from', files.length, 'parts');
}

assemble(
  path.join(__dirname, '..', 'components', '_parts'),
  path.join(__dirname, '..', 'components', 'CostEstimatorApp.js'),
  'CostEstimatorApp.'
);
assemble(
  path.join(__dirname, '..', 'app', '_parts'),
  path.join(__dirname, '..', 'app', 'globals.css'),
  'globals.'
);
