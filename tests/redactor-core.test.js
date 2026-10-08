'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scanText } = require('../redactor-core.js');

const groups = new Set(['credentials', 'providers', 'paths', 'network']);

test('redacts AWS, Slack, Discord webhook, unquoted api_key and JSON apiKey values', () => {
  const input = [
    'aws=AKIA1234567890ABCDEF',
    'slack=xoxb-1234567890-abcdef123456',
    'hook=https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopQRSTUV',
    'api_key=plain-secret-value-123',
    '{"apiKey": "json-secret-value-123"}',
  ].join('\n');
  const result = scanText(input, groups);
  assert.equal(result.matches.length, 5);
  assert.doesNotMatch(result.output, /AKIA1234567890ABCDEF|xoxb-|discord\.com|plain-secret|json-secret/);
  assert.equal((result.output.match(/\[REDACTED\]/g) || []).length, 5);
});

test('redacts Windows and Unix home paths, emails and private IPv4 addresses', () => {
  const input = 'C:\\Users\\Player\\Documents\\game.log /home/alex/.config/game user@example.com 192.168.1.25 8.8.8.8';
  const result = scanText(input, groups);
  assert.equal(result.matches.length, 4);
  assert.doesNotMatch(result.output, /C:\\Users|\/home\/alex|user@example|192\.168\.1\.25/);
  assert.match(result.output, /8\.8\.8\.8/);
});

test('private key block is replaced as one range', () => {
  const input = 'before\n-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----\nafter';
  const result = scanText(input, groups);
  assert.equal(result.matches.length, 1);
  assert.match(result.output, /before\n\[REDACTED\]\nafter/);
  assert.doesNotMatch(result.output, /private-material/);
});

test('overlapping findings are replaced once and custom regexes are applied', () => {
  const custom = [{ group: 'custom', name: 'Custom: account_id=\\w+', regex: /account_id=\w+/gi }];
  const result = scanText('api_key=account_id=abcdef123456', groups, custom, '<hidden>');
  assert.equal(result.matches.length, 1);
  assert.equal(result.output, '<hidden>');
  assert.deepEqual(result.matches[0].types, ['Secret assignment', 'Custom: account_id=\\w+']);
});

test('disabled groups do not contribute findings', () => {
  const result = scanText('api_key=plain-secret-value-123 user@example.com', new Set(['network']));
  assert.equal(result.matches.length, 1);
  assert.match(result.output, /api_key=plain-secret-value-123/);
  assert.doesNotMatch(result.output, /user@example\.com/);
});
