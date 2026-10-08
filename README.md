# LogSieve

**A free, local-first log cleaner for support reports.** Review and redact likely credentials and personal details from game, app, and server logs before sharing them.

[Open the app](https://ghostnever-lkm.github.io/logsieve/) · [Download latest release](https://github.com/GhosTnever-lkm/logsieve/releases/latest) · [Report an issue](https://github.com/GhosTnever-lkm/logsieve/issues)

LogSieve runs in your browser. It reads selected text files locally, shows the changes, and exports cleaned files. It makes no network requests and does not send log contents to a server.

## Quick start

1. Open the [hosted app](https://ghostnever-lkm.github.io/logsieve/) or download the complete ZIP from Releases.
2. Add text logs or drag them into the upload area. Supported extensions: `.log`, `.txt`, `.out`, `.err`, `.json`, `.yaml`, `.yml`, `.cfg`, and `.ini`.
3. Choose detection groups, adjust the replacement marker, or add a custom JavaScript regular expression.
4. Click **Проверить файлы** and review the displayed replacements and warnings.
5. Download cleaned files separately or as one ZIP with `logsieve-report.json`.

The interface supports keyboard file selection and drag-and-drop. You can serve a downloaded folder locally, for example with `python -m http.server 8000`; opening `index.html` directly also works because the app uses no modules or network-loaded scripts.

## What it looks for

| Group | Examples |
| --- | --- |
| Keys and tokens | Private key blocks, Bearer tokens, JWT-shaped values, common `api_key` / `password` assignments |
| Services and bots | AWS access key IDs, Slack tokens, Discord webhooks/tokens, GitHub tokens |
| Personal paths | Windows user folder prefix (`C:\Users\name`) and Unix home prefix (`/home/name`, `/Users/name`) |
| Network identifiers | Email addresses and private IPv4 addresses |
| Custom rules | Regular expressions entered by the user |

Overlapping matches are replaced once. The ZIP manifest records output names, replacement counts, rule names, and its creation time; it never includes original matched values.

## Limits

- Up to 20 files per batch, 20 MiB per file, and 80 MiB combined.
- The tool reads text files as UTF-8. Files that appear binary are excluded from export.
- The in-page preview is capped at 12,000 characters per file to keep the interface responsive; exports contain the full cleaned file.
- Custom rules use the browser's JavaScript regular-expression engine. Very expensive expressions can freeze a tab, so use focused patterns.
- Detection is best-effort. It cannot identify every secret, personal detail, encoded value, or application-specific identifier. Always inspect the complete cleaned report before sharing.
- Redaction changes only the exported copy. Original files are not modified.

## Privacy and security

- No backend, analytics, upload endpoint, external script, or runtime dependency is used.
- The page's Content Security Policy blocks network connections and external scripts.
- Files are read only after you select them and stay in the current browser tab's memory.
- Matched text is displayed only in the local preview as a replacement marker; it is not put in the report manifest.
- The browser's download dialog handles the output ZIP or cleaned files.
- This tool is not a secret-management system, malware scanner, or guarantee that a log is safe to publish.
- Custom regular expressions can be computationally expensive. Prefer specific patterns over nested, ambiguous quantifiers.

## Development

No build step or package installation is required. Run the static app through a local HTTP server for the same setup used by GitHub Pages. Run the regression tests with Node.js 20 or newer:

```sh
npm test
```

## License

MIT. See [LICENSE](LICENSE).

## Support / Pro Version

The local redaction tool is free and open source. Optional support: [Buy Me a Coffee](https://buymeacoffee.com/azizazimov8) · [Boosty](https://boosty.to/azimovian) · [Gumroad](https://azimovian22.gumroad.com/).

> LogSieve Pro is not currently offered. No paid feature is required to use the open-source tool.
