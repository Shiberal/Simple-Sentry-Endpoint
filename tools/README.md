# EDT tools

One folder per tool. Each tool should:

- Own its `package.json`, lockfile (if needed), and README
- Build and run from its own directory
- Prefer the package name `@edt/<kebab-case-tool-name>`

Current tools:

- [SimpleSentryEndpoint](./SimpleSentryEndpoint) — Sentry-compatible error sink
