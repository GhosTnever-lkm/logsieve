'use strict';

const patternDefinitions = [
  { group: 'credentials', name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi },
  { group: 'credentials', name: 'Bearer token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { group: 'credentials', name: 'JWT', regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g },
  { group: 'credentials', name: 'Secret assignment', regex: /["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret)\b["']?\s*[:=]\s*(?:"[^"\r\n]{4,}"|'[^'\r\n]{4,}'|[^\s,;"'`]{8,})/gi },
  { group: 'providers', name: 'AWS access key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { group: 'providers', name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { group: 'providers', name: 'Discord token or webhook', regex: /(?:https?:\/\/)?(?:discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]{15,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,})/gi },
  { group: 'providers', name: 'GitHub token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { group: 'paths', name: 'Windows user path', regex: /\b[A-Z]:\\Users\\[^\\\s"']+/gi },
  { group: 'paths', name: 'Unix home path', regex: /(?:\/home\/|\/Users\/)[^/\s"']+/g },
  { group: 'network', name: 'Email address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { group: 'network', name: 'Private IPv4 address', regex: /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/g },
];

function collectMatches(text, selectedGroups, customRules = []) {
  const matches = [];
  for (const definition of [...patternDefinitions, ...customRules]) {
    if (definition.group !== 'custom' && !selectedGroups.has(definition.group)) continue;
    definition.regex.lastIndex = 0;
    let match;
    let guard = 0;
    while ((match = definition.regex.exec(text)) && guard++ < 10000) {
      if (!match[0].length) { definition.regex.lastIndex++; continue; }
      matches.push({ start: match.index, end: match.index + match[0].length, type: definition.name });
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const match of matches) {
    const previous = merged[merged.length - 1];
    if (previous && match.start < previous.end) {
      if (!previous.types.includes(match.type)) previous.types.push(match.type);
      previous.end = Math.max(previous.end, match.end);
    } else merged.push({ ...match, types: [match.type] });
  }
  return merged;
}

function redact(text, matches, replacement = '[REDACTED]') {
  let output = '';
  let cursor = 0;
  const previews = [];
  for (const match of matches) {
    output += text.slice(cursor, match.start) + replacement;
    previews.push({ ...match, replacement });
    cursor = match.end;
  }
  output += text.slice(cursor);
  return { output, previews };
}

function scanText(text, selectedGroups, customRules = [], replacement = '[REDACTED]') {
  const matches = collectMatches(text, selectedGroups, customRules);
  return { matches, ...redact(text, matches, replacement) };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { collectMatches, redact, scanText };
if (typeof window !== 'undefined') window.LogSieveCore = { collectMatches, redact, scanText };
