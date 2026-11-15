# Changelog

## [1.3.3](https://github.com/TomekGl/librus-forwarder/compare/v1.3.2...v1.3.3) (2026-11-15)


### Bug Fixes

* silence Fastify's automatic request logs for /healthz ([#17](https://github.com/TomekGl/librus-forwarder/issues/17)) ([05343f0](https://github.com/TomekGl/librus-forwarder/commit/05343f09d8808ba4f9359c3d4603955bc82ef30f))

## [1.3.2](https://github.com/TomekGl/librus-forwarder/compare/v1.3.1...v1.3.2) (2026-11-15)


### Bug Fixes

* avoid UID/GID 1000 collision with base image's node user ([#14](https://github.com/TomekGl/librus-forwarder/issues/14)) ([e3eb04e](https://github.com/TomekGl/librus-forwarder/commit/e3eb04e630f35c9a243b7463048f3104920abc0d))

## [1.3.1](https://github.com/TomekGl/librus-forwarder/compare/v1.3.0...v1.3.1) (2026-11-15)


### Bug Fixes

* pin numeric UID/GID so Kubernetes can verify runAsNonRoot ([#12](https://github.com/TomekGl/librus-forwarder/issues/12)) ([c82bb5b](https://github.com/TomekGl/librus-forwarder/commit/c82bb5b06bef7565c7b324a99446218fba3fdcca))

## [1.3.0](https://github.com/TomekGl/librus-forwarder/compare/v1.2.0...v1.3.0) (2026-11-14)


### Features

* add Kubernetes Helm chart and publish it to GHCR on release ([#10](https://github.com/TomekGl/librus-forwarder/issues/10)) ([6441449](https://github.com/TomekGl/librus-forwarder/commit/64414491eb223a9f7fbb1ce9f0df48b695be2e78))

## [1.2.0](https://github.com/TomekGl/librus-forwarder/compare/v1.1.0...v1.2.0) (2026-11-13)


### Features

* also fetch messages from the Sent folder ([#7](https://github.com/TomekGl/librus-forwarder/issues/7)) ([15ac0ae](https://github.com/TomekGl/librus-forwarder/commit/15ac0aee4a77a4d35f4618fe02d36d52c6a2c17b))

## [1.1.0](https://github.com/TomekGl/librus-forwarder/compare/v1.0.0...v1.1.0) (2026-11-13)


### Features

* add Slack notifier target ([#6](https://github.com/TomekGl/librus-forwarder/issues/6)) ([1810b5b](https://github.com/TomekGl/librus-forwarder/commit/1810b5bbcad3763fd4ca71e393ad9c4e5113ef4c))
* archive every fetched message to per-message JSON files ([#4](https://github.com/TomekGl/librus-forwarder/issues/4)) ([d6dd9ff](https://github.com/TomekGl/librus-forwarder/commit/d6dd9ff6f5151e268ce650c3a301727021539d18))

## 1.0.0 (2026-11-13)


### Features

* implement librus-forwarder service ([#2](https://github.com/TomekGl/librus-forwarder/issues/2)) ([790fd52](https://github.com/TomekGl/librus-forwarder/commit/790fd522617777be80886b18b2e8c826f24239ba))
