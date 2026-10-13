# Changelog

## 0.1.1 — 2026-10-13

- Enforced the 12,000-character preview limit even when a file has matches after the preview boundary.
- Recalculate the combined batch size after each rejected file so valid earlier files are retained when only the last file exceeds the limit.
- Synchronize package, UI, and release version metadata.

## 0.1.0 — 2026-10-08

- Initial browser-based tool for reviewing and redacting common secrets, personal paths, email addresses, and private IPv4 values in text logs.
- Add configurable replacement text and custom regular-expression rules.
- Export cleaned text files individually or as a ZIP with a machine-readable manifest.
- Keep processing local to the browser and avoid network requests and third-party runtime dependencies.
- Add bounded file type, file size, batch size, and preview handling.
