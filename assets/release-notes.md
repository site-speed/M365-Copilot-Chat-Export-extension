# Release notes

## v1.0.20 — Public release hygiene and release automation

### Highlights

- Removed legacy chronological change-history files from the private snapshot and public artefact staging to reduce accidental release of project-history detail.
- Added this stable `assets/release-notes.md` file for GitHub release creation. The filename intentionally has no version number; git tags and release metadata carry the version.
- Updated the extension README generation so the displayed version and description are refreshed on every public build.
- Updated public build/sync scripts so release notes are copied to the public extension repository.
- Added release automation for build, sync, git push, and GitHub release creation.

### Extension artefact

- Loadable extension folder: `app/`
- Version: `1.0.19`
- Description: Export Microsoft 365 Copilot Chat conversations as readable Markdown with a raw JSON companion.

### Publication notes

- GitHub release notes should use this file via `gh release create ... --notes-file assets/release-notes.md`.
- Edge Add-ons publishing remains a separate manual portal step after the extension package is validated.


## v1.0.20 — Release automation argument fix

### Highlights

- Repaired `tools/publish-release.ps1` so Bun, Git, and GitHub CLI commands receive their subcommands and arguments reliably.
- Replaced positional `Run bun @(...)` style calls with named `Invoke-External -FilePath ... -ArgumentList ...` calls.
- Kept `-DryRun` support for previewing the release flow before pushing or creating releases.

### Extension artefact

- Version: `1.0.19`


## v1.0.20 — Release metadata template fix

### Highlights

- Fixed tools/update-release-metadata.mjs so build:all no longer fails on nested template-literal backticks in generated README content.
- Kept release automation argument handling from the previous release.
