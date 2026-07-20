# Changelog for `keystatic-sveltekit`

## 1.3.1 - 2026-07-20

- fix: Support environment loading both for SvelteKit v2 and v3.
- chore: Update dev project in preparation for SvelteKit explicit environment variables becoming the default.

## 1.3.0 - 2026-07-20

- feat: Add `vite@^8.0.0` as a possible peerDependency.
- feat: Update to `@keystatic/core@0.5.51` which includes the upstreamed patch to prevent loopback (127.0.0.1) redirects for the Keystatic `local` mode. More details in the [PR](https://github.com/Thinkmill/keystatic/pull/1465).
- feat: Update to `rolldown@1.2.0`
- fix: Avoid creating unnecessary wrapper object
- fix: Remove unnecessary regex escape character

## 1.2.0 - 2026-02-18

- feat: Add support for Windows by converting file paths into file URLs.
- fix: Update demo project to also work on Windows.

## 1.1.0 - 2026-02-10

- feat: Use `rolldown` instead of `esbuild`, in preparation for the Vite 8 release. Once Vite 8 is available, this package will likely use `rolldown` as a `peerDependency` instead. This will simplify the build process and reduce duplicated dependencies.
- fix: Remove `zod` from package dependencies.

## 1.0.0 - 2026-02-07

Initial release.
