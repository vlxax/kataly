
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller=fs.readFileSync(new URL('../tableController.js',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../../css/kataly.css',import.meta.url),'utf8');

assert.ok(controller.includes("if(e.nick===this.heroNick)"));
assert.ok(controller.includes('enterHeroSpectator()'));
assert.ok(view.includes('leaveHeroSpectator()'));
assert.ok(css.includes('top:74px'));
assert.ok(css.includes('.v1-hero-cards.folded-cards'));
assert.ok(css.includes('.v1-hero-strip.spectating + .v1-controls'));

console.log('V24_HERO_SPECTATOR_OK');
