const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRecipientId, normalizeToNumber } = require('./index.js');

test('normalizeToNumber strips non-digits and preserves digits only', () => {
  assert.equal(normalizeToNumber('whatsapp:+919392687522'), '919392687522');
  assert.equal(normalizeToNumber(' +1 (234) 567-8900 '), '12345678900');
  assert.equal(normalizeToNumber(''), '');
});

test('buildRecipientId returns WhatsApp Web compatible @c.us IDs', () => {
  assert.equal(buildRecipientId('whatsapp:+919392687522'), '919392687522@c.us');
  assert.equal(buildRecipientId('+1 (234) 567-8900'), '12345678900@c.us');
  assert.equal(buildRecipientId(''), '');
});
