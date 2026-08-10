import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
assert.equal(src.includes('seat.el.querySelector'),false,'stale seat.el DOM contract returned');
assert.equal(src.includes('seat.root'),true);
assert.equal(src.includes('seat.dealer'),true);
console.log('VIEW_CONTRACT_OK');
