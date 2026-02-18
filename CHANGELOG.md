# Changelog for `keystatic-sveltekit`

## 1.2.0 - 2026-02-18

- feat: Add support for Windows by converting file paths into file URLs.
- fix: Update demo project to also work on Windows.

## 1.1.0 - 2026-02-10

- feat: Use `rolldown` instead of `esbuild`, in preparation for the Vite 8 release. Once Vite 8 is available, this package will likely use `rolldown` as a `peerDependency` instead. This will simlpify the build process and reduce duplicated dependencies.
- fix: Remove `zod` from package dependencies.

## 1.0.0 - 2026-02-07

Initial release.
