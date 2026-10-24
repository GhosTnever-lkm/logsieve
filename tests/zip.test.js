'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('ZIP writer creates a readable stored archive with UTF-8 names and correct checksums', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const normalizedSource = source.replace(/\r\n?/g, '\n');
  const extracted = normalizedSource.match(/function crc32\([\s\S]*?\n}\n\nfunction makeZip\([\s\S]*?\n}\n/);
  assert.ok(extracted, 'zip writer functions must be present');
  const context = vm.createContext({ TextEncoder, DataView, Uint8Array, Blob });
  vm.runInContext(`${extracted[0]}\nthis.makeZip = makeZip;`, context);
  const blob = context.makeZip([{ name: 'чистый-log.txt', data: 'log\n[REDACTED]\n' }]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  const localNameLength = bytes.readUInt16LE(26);
  const localExtraLength = bytes.readUInt16LE(28);
  const dataOffset = 30 + localNameLength + localExtraLength;
  const dataLength = bytes.readUInt32LE(18);
  assert.equal(bytes.subarray(dataOffset, dataOffset + dataLength).toString('utf8'), 'log\n[REDACTED]\n');
  const centralOffset = bytes.readUInt32LE(bytes.length - 6);
  assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50);
  assert.equal(bytes.readUInt32LE(centralOffset + 16), bytes.readUInt32LE(14));
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
});
