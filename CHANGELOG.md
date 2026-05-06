# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- FEAT-001 Endpoint `GET /wallet/purchases` con paginación (`page`, `limit` ≤ 100), filtro opcional por `itemId` y orden `createdAt DESC`. Response: `{ data, pagination: { page, limit, total, totalPages } }`. Validación via `class-validator`. Sin auth (riesgo aceptado, ver `docs/security/threat-FEAT-001.md`).
