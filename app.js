'use strict';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED_EXTENSIONS = new Set(['log', 'txt', 'out', 'err', 'json', 'yaml', 'yml', 'cfg', 'ini']);
const state = { files: [], customRules: [], results: [] };
const $ = (selector) => document.querySelector(selector);
const fileInput = $('#fileInput');
const dropzone = $('#dropzone');
const fileList = $('#fileList');
const scanButton = $('#scanButton');
const toast = $('#toast');
let toastTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function addFiles(fileListInput) {
  const incoming = Array.from(fileListInput);
  const accepted = [];
  let rejected = 0;
  for (const file of incoming) {
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext) || file.size > MAX_FILE_BYTES || file.size === 0 || state.files.length + accepted.length >= MAX_FILES) {
      rejected++;
      continue;
    }
    const key = `${file.name}\0${file.size}\0${file.lastModified}`;
    if ([...state.files, ...accepted].some((item) => item.key === key)) continue;
    accepted.push({ file, key });
  }
  const total = [...state.files, ...accepted].reduce((sum, item) => sum + item.file.size, 0);
  while (total > MAX_TOTAL_BYTES && accepted.length) {
    accepted.pop();
    rejected++;
  }
  state.files.push(...accepted);
  renderFiles();
  if (rejected) notify(`Не добавлено файлов: ${rejected}. Проверьте формат, размер и лимиты.`);
  if (accepted.length) $('#results').hidden = true;
}

function renderFiles() {
  if (!state.files.length) {
    fileList.innerHTML = '<div class="empty-file">Пока нет добавленных файлов</div>';
  } else {
    fileList.innerHTML = state.files.map(({ file }, index) => `<div class="file-item"><span class="file-badge">${escapeHtml(file.name.split('.').pop().toUpperCase().slice(0, 4))}</span><span class="file-name"><b title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</b><small>${formatBytes(file.size)}</small></span><button class="remove-file" data-remove="${index}" aria-label="Убрать ${escapeHtml(file.name)}">×</button></div>`).join('');
  }
  scanButton.disabled = !state.files.length;
  $('#clearAll').disabled = !state.files.length;
}

fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  fileInput.value = '';
});
fileList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  state.files.splice(Number(button.dataset.remove), 1);
  renderFiles();
});
$('#clearAll').addEventListener('click', () => {
  state.files = [];
  state.results = [];
  renderFiles();
  $('#results').hidden = true;
});
for (const name of ['dragenter', 'dragover']) dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('dragover'); });
for (const name of ['dragleave', 'drop']) dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});

function safeCustomRules() {
  return state.customRules.map((rule) => ({ group: 'custom', name: `Custom: ${rule.source.slice(0, 32)}`, regex: new RegExp(rule.source, 'gi') }));
}

function collectMatches(text, selectedGroups, customRules) {
  return window.LogSieveCore.collectMatches(text, selectedGroups, customRules);
}

async function scanFiles() {
  const checked = Array.from(document.querySelectorAll('[data-group]:checked')).map((item) => item.dataset.group);
  const selectedGroups = new Set(checked);
  const replacement = $('#replacementText').value || '[REDACTED]';
  const customRules = safeCustomRules();
  scanButton.disabled = true;
  scanButton.textContent = 'Проверка…';
  try {
    const results = [];
    for (const { file } of state.files) {
      const text = await file.text();
      if (text.includes('\u0000')) {
        results.push({ name: file.name, originalBytes: file.size, text: '', output: '', matches: [], previews: [], warning: 'Похоже, это бинарный файл. Он не отображается в текстовом редакторе и не включён в экспорт.' });
        continue;
      }
      const matches = collectMatches(text, selectedGroups, customRules);
      const redacted = window.LogSieveCore.redact(text, matches, replacement);
      results.push({ name: file.name, originalBytes: file.size, text, output: redacted.output, matches, previews: redacted.previews, warning: '' });
    }
    state.results = results;
    renderResults();
    $('#results').hidden = false;
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify('Проверка завершена. Просмотрите изменения перед отправкой.');
  } catch (error) {
    notify(`Не удалось прочитать файл: ${error.message}`);
  } finally {
    scanButton.disabled = !state.files.length;
    scanButton.innerHTML = 'Проверить файлы <span>→</span>';
  }
}

function renderHighlighted(text, previews) {
  if (!previews.length) return escapeHtml(text.slice(0, 12000));
  let out = '';
  let cursor = 0;
  for (const match of previews) {
    if (match.start < cursor) continue;
    out += escapeHtml(text.slice(cursor, match.start));
    out += `<mark title="${escapeHtml(match.types.join(', '))}">${escapeHtml(match.replacement)}</mark>`;
    cursor = match.end;
  }
  out += escapeHtml(text.slice(cursor, 12000));
  if (text.length > 12000) out += '\n… [предпросмотр ограничен 12 000 символами]';
  return out;
}

function renderResults() {
  const totalMatches = state.results.reduce((sum, file) => sum + file.matches.length, 0);
  const warnings = state.results.filter((file) => file.warning).length;
  $('#summaryFiles').textContent = state.results.length;
  $('#summaryReplacements').textContent = totalMatches;
  $('#summaryWarnings').textContent = warnings;
  $('#resultList').innerHTML = state.results.map((file) => {
    const title = `<div class="result-file-head"><span class="file-badge">${escapeHtml(file.name.split('.').pop().toUpperCase().slice(0, 4))}</span><span class="file-name"><b>${escapeHtml(file.name)}</b><small>${formatBytes(file.originalBytes)}${file.output ? ` · очищено: ${formatBytes(new Blob([file.output]).size)}` : ''}</small></span><span class="finding-count ${file.matches.length ? '' : 'clean'}">${file.matches.length ? `${file.matches.length} замен` : 'чисто'}</span></div>`;
    const warning = file.warning ? `<p class="warning">${escapeHtml(file.warning)}</p>` : '';
    const preview = file.warning ? '' : `<pre class="diff">${renderHighlighted(file.text, file.previews)}</pre>${file.matches.length ? `<div class="finding-details">${file.matches.flatMap((match) => match.types).map((type) => `<span class="finding-pill">${escapeHtml(type)}</span>`).join('')}</div>` : ''}`;
  return `<article class="result-file">${title}<div class="result-content">${warning}${preview}</div></article>`;
  }).join('');
}

function addCustomRule() {
  const input = $('#customRule');
  const source = input.value.trim();
  if (!source) return;
  if (source.length > 160) return notify('Шаблон слишком длинный (максимум 160 символов).');
  try {
    const regex = new RegExp(source, 'gi');
    const match = regex.exec('');
    if (match && match[0] === '') return notify('Правило может совпадать с пустой строкой. Уточните его.');
    if (state.customRules.some((rule) => rule.source === source)) return notify('Это правило уже добавлено.');
    state.customRules.push({ source });
    input.value = '';
    renderCustomRules();
    $('#results').hidden = true;
  } catch (error) { notify(`Некорректное регулярное выражение: ${error.message}`); }
}

function renderCustomRules() {
  $('#customTags').innerHTML = state.customRules.map((rule, index) => `<span class="tag">${escapeHtml(rule.source.slice(0, 24))}<button type="button" data-rule-remove="${index}" aria-label="Удалить правило">×</button></span>`).join('');
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ -1) >>> 0;
}

function makeZip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(data, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.set(name, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, end], { type: 'application/zip' });
}

function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'log.txt';
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.className = 'download-link';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#scanButton').addEventListener('click', scanFiles);
$('#addRule').addEventListener('click', addCustomRule);
$('#customRule').addEventListener('keydown', (event) => { if (event.key === 'Enter') addCustomRule(); });
$('#customTags').addEventListener('click', (event) => {
  const button = event.target.closest('[data-rule-remove]');
  if (!button) return;
  state.customRules.splice(Number(button.dataset.ruleRemove), 1);
  renderCustomRules();
  $('#results').hidden = true;
});
$('#replacementText').addEventListener('change', () => { if (state.results.length) notify('Перезапустите проверку, чтобы применить новый текст замены.'); });
document.querySelectorAll('[data-group]').forEach((input) => input.addEventListener('change', () => { if (state.results.length) notify('Перезапустите проверку, чтобы применить выбранные группы.'); }));
$('#downloadSeparate').addEventListener('click', () => {
  const safeResults = state.results.filter((item) => !item.warning);
  for (const item of safeResults) download(new Blob([item.output], { type: 'text/plain;charset=utf-8' }), `clean-${safeFilename(item.name)}`);
  if (!safeResults.length) notify('Нет текстовых файлов для экспорта.');
});
$('#downloadZip').addEventListener('click', () => {
  const safeResults = state.results.filter((item) => !item.warning);
  if (!safeResults.length) return notify('Нет текстовых файлов для экспорта.');
  const usedNames = new Set();
  const outputNames = safeResults.map((item) => {
    const base = `clean-${safeFilename(item.name)}`;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const extension = dot > 0 ? base.slice(dot) : '';
    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) name = `${stem}-${suffix++}${extension}`;
    usedNames.add(name.toLowerCase());
    return name;
  });
  const entries = safeResults.map((item, index) => ({ name: outputNames[index], data: item.output }));
  const manifest = {
    product: 'LogSieve',
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    files: safeResults.map((item, index) => ({ name: outputNames[index], replacements: item.matches.length, rules: [...new Set(item.matches.flatMap((match) => match.types))] })),
    note: 'Review the cleaned logs before sharing. Redaction is best-effort and cannot guarantee that every secret or personal detail was found.'
  };
  entries.push({ name: 'logsieve-report.json', data: JSON.stringify(manifest, null, 2) });
  download(makeZip(entries), 'logsieve-clean-logs.zip');
});

$('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('logsieve-theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
if (localStorage.getItem('logsieve-theme') === 'light') document.body.classList.add('light');

renderFiles();
