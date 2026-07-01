# Repository Hygiene

The extension should remain source-reviewable. Patches should contain source, tests, fixtures, manifests, and documentation only unless a generated file is explicitly required and reviewed.

## Do commit

Commit files such as:

- `src/**` source files;
- `manifests/**` browser manifests;
- `tests/**` automated tests;
- `fixtures/**` safe redacted fixtures;
- `docs/**` documentation;
- `.github/**` issue and pull request templates;
- `package.json` and lockfiles when dependency changes require them.

## Do not commit

Do not commit generated or local-only files such as:

- `node_modules/`;
- `dist/`;
- `web-ext-artifacts/`;
- local extension packages such as `.zip`, `.crx`, `.xpi`, `.pem`, or `.tgz`;
- `.env` or `.env.*` files;
- OS metadata such as `.DS_Store`, `._*`, `.AppleDouble`, or `__MACOSX/`;
- editor state such as `.vscode/`, `.idea/`, `.swp`, or `.swo`;
- logs, coverage output, and temporary debug files.

## Patch packaging checklist

Before producing a patch zip, check that the package is reviewable:

```bash
git status --short
find . -name '.DS_Store' -o -name '._*' -o -name '__MACOSX'
```

Patch zips should be built from a clean source tree and should exclude:

```text
.git/
node_modules/
dist/
.env
.env.*
.DS_Store
__MACOSX/
*.zip
```

The patch should not include unrelated local artifacts or generated browser build output unless the task specifically asks for a release package.

## Permission review

Any change to `manifests/` must be reviewed for permission impact.

Patch notes and pull requests should call out whether the change:

- adds browser permissions;
- adds host permissions;
- changes content script match patterns;
- changes background script behaviour;
- changes any third-party page interaction.

A process/documentation-only patch should not change runtime permissions.
