## [1.0.0-dev.21](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.20...v1.0.0-dev.21) (2026-03-18)

### Features

* **deps:** use pnpm lockfile data for deps diff ([#57](https://github.com/async3619/foresthouse/issues/57)) ([228cbd4](https://github.com/async3619/foresthouse/commit/228cbd41c8769e7d2ab1b3df01b9c8a1e4f3f96b))

## [1.0.0-dev.20](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.19...v1.0.0-dev.20) (2026-03-18)

### Bug Fixes

* clarify deps diff version changes ([#56](https://github.com/async3619/foresthouse/issues/56)) ([a1531bc](https://github.com/async3619/foresthouse/commit/a1531bc219b3a6cf737754c55510da225c6561fe))

## [1.0.0-dev.19](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.18...v1.0.0-dev.19) (2026-03-18)

### Features

* propagate workspace package changes in deps --diff ([#52](https://github.com/async3619/foresthouse/issues/52)) ([4dbe6ca](https://github.com/async3619/foresthouse/commit/4dbe6ca94815c82cb1fdf15539ab720298f0dda2))

## [1.0.0-dev.18](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.17...v1.0.0-dev.18) (2026-03-16)

### Features

* add git diff mode to deps command ([#47](https://github.com/async3619/foresthouse/issues/47)) ([d06edd1](https://github.com/async3619/foresthouse/commit/d06edd18095cc0af21809decde2ccc5b8483248b))

## [1.0.0-dev.17](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.16...v1.0.0-dev.17) (2026-03-16)

### Features

* **deps:** add deps command ([#46](https://github.com/async3619/foresthouse/issues/46)) ([9aad4b5](https://github.com/async3619/foresthouse/commit/9aad4b504246375409bbd02693f6501d57af407e))

## [1.0.0-dev.16](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.15...v1.0.0-dev.16) (2026-03-16)

### Bug Fixes

* **react:** include generated components in usage tree ([#45](https://github.com/async3619/foresthouse/issues/45)) ([9ac00c6](https://github.com/async3619/foresthouse/commit/9ac00c68fc1b17e7d3bab4c3c3625b3ea28d07e7))

## [1.0.0-dev.15](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.14...v1.0.0-dev.15) (2026-03-16)

### Features

* **react:** add nextjs entry discovery ([#44](https://github.com/async3619/foresthouse/issues/44)) ([ac0e589](https://github.com/async3619/foresthouse/commit/ac0e589cb1e77dc294fd7d43aebc5839ce116b01))

## [1.0.0-dev.14](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.13...v1.0.0-dev.14) (2026-03-16)

### Features

* add builtin HTML nodes to react command ([#42](https://github.com/async3619/foresthouse/issues/42)) ([1de9731](https://github.com/async3619/foresthouse/commit/1de973101eb37ce970f67bb823b952e2737e5312))

## [1.0.0-dev.13](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.12...v1.0.0-dev.13) (2026-03-16)

### Bug Fixes

* ignore package tsconfig files in node_modules ([#38](https://github.com/async3619/foresthouse/issues/38)) ([5cca786](https://github.com/async3619/foresthouse/commit/5cca78640f0740c0feb47c157994a6b4d6e6bd04))

## [1.0.0-dev.12](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.11...v1.0.0-dev.12) (2026-03-16)

### Features

* improve monorepo workspace traversal ([#33](https://github.com/async3619/foresthouse/issues/33)) ([35b13ce](https://github.com/async3619/foresthouse/commit/35b13ce62767624237ace8d3dffe91a2d46661d5))

## [1.0.0-dev.11](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.10...v1.0.0-dev.11) (2026-03-16)

### Bug Fixes

* **react:** normalize react entry fallback ([#32](https://github.com/async3619/foresthouse/issues/32)) ([2e71a60](https://github.com/async3619/foresthouse/commit/2e71a602de91dc0e0e3cf5bf1a7663b52b2a30fc))

## [1.0.0-dev.10](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.9...v1.0.0-dev.10) (2026-03-16)

### Features

* update React ASCII labels to JSX-style syntax ([#31](https://github.com/async3619/foresthouse/issues/31)) ([84968be](https://github.com/async3619/foresthouse/commit/84968be45abdb52600ea07b64c81c8d2d97a886a)), closes [#21](https://github.com/async3619/foresthouse/issues/21)

## [1.0.0-dev.9](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.8...v1.0.0-dev.9) (2026-03-16)

### Bug Fixes

* **react:** preserve aliased symbol names in usage tree ([#21](https://github.com/async3619/foresthouse/issues/21)) ([#29](https://github.com/async3619/foresthouse/issues/29)) ([c0c58ca](https://github.com/async3619/foresthouse/commit/c0c58caa68720f8348dadcb23a1f0ae378943066))

## [1.0.0-dev.8](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.7...v1.0.0-dev.8) (2026-03-16)

### Features

* **cli:** add explicit import and react commands ([#28](https://github.com/async3619/foresthouse/issues/28)) ([b0b8818](https://github.com/async3619/foresthouse/commit/b0b881839f5ce15644c005b0f2f670287bf992c1))

### Refactoring

* **cli:** adopt cac for argument parsing ([#27](https://github.com/async3619/foresthouse/issues/27)) ([62b74f3](https://github.com/async3619/foresthouse/commit/62b74f37446b1598ff24bc91527e57a66776a7d6))
* **core:** split internals by responsibility ([#26](https://github.com/async3619/foresthouse/issues/26)) ([061d1ca](https://github.com/async3619/foresthouse/commit/061d1caf24c777459a04dfcb93201bf08e461b2e))

## [1.0.0-dev.7](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.6...v1.0.0-dev.7) (2026-03-15)

### Bug Fixes

* **react:** record entry file hook usages ([#24](https://github.com/async3619/foresthouse/issues/24)) ([36060c6](https://github.com/async3619/foresthouse/commit/36060c64248e28712f51d469fb0bb34cc8edca3c))

## [1.0.0-dev.6](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.5...v1.0.0-dev.6) (2026-03-15)

### Bug Fixes

* **react:** record entry file render locations ([#23](https://github.com/async3619/foresthouse/issues/23)) ([60d4306](https://github.com/async3619/foresthouse/commit/60d430643a98b37258f0a08ce5f9636ba912e73c))

## [1.0.0-dev.5](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.4...v1.0.0-dev.5) (2026-03-15)

### Features

* **react:** show render entry locations ([#18](https://github.com/async3619/foresthouse/issues/18)) ([7ed0633](https://github.com/async3619/foresthouse/commit/7ed06335eb34531a15e25937c610839f37f9f846))

## [1.0.0-dev.4](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.3...v1.0.0-dev.4) (2026-03-15)

### Features

* **cli:** colorize ASCII tree output ([#17](https://github.com/async3619/foresthouse/issues/17)) ([eeadadd](https://github.com/async3619/foresthouse/commit/eeadaddeb9acd5f6c0ae0a919a5b72c8f7a85b19))

## [1.0.0-dev.3](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.2...v1.0.0-dev.3) (2026-03-15)

### Features

* support unused import filtering ([#15](https://github.com/async3619/foresthouse/issues/15)) ([e01f72b](https://github.com/async3619/foresthouse/commit/e01f72b7c1b0220b0dbf453cbf5aee98aede0b91))

## [1.0.0-dev.2](https://github.com/async3619/foresthouse/compare/v1.0.0-dev.1...v1.0.0-dev.2) (2026-03-15)

### Features

* **react:** add react usage tree mode ([#6](https://github.com/async3619/foresthouse/issues/6)) ([55f7328](https://github.com/async3619/foresthouse/commit/55f732891691ba7eb8a513b47ff4fd38fd1bc89b))

## 1.0.0-dev.1 (2026-03-15)

### Features

* bootstrap the project and implement core functionality ([#2](https://github.com/async3619/foresthouse/issues/2)) ([6e3c42e](https://github.com/async3619/foresthouse/commit/6e3c42e34d484345de8c52897fab05197950e971))

# Changelog

All notable changes to this project will be documented in this file by `semantic-release`.
