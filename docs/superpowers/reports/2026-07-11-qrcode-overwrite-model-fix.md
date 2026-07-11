# QRCode OverwriteModelError Implementation Report

## Executive summary

The QRCode model overwrite failure was caused by mixed-case local imports of the single physical file `src/models/QrCode.js`. The application loaded `../models/QrCode`, then transformer test setup loaded `../models/QRCode`, causing Jest to execute the model file a second time on the case-insensitive development filesystem. Mongoose rejected the second `mongoose.model('QRCode', qrCodeSchema)` call.

The fix canonicalizes every local import to the Linux-safe filename `QrCode`. No model, schema, collection, QR service behavior, dependency, or runtime configuration changed. The newly added seeder test also needed a test-only cleanup correction so its negative environment-variable tests restore the URI of the already-active Mongoose connection.

## Root cause and exact reload chain

The first compilation path was:

```text
src/tests/transformer.test.js
-> require('../app')
-> src/app.js
-> src/routes/index.js
-> src/routes/transformerRoutes.js
-> src/controllers/transformerController.js
-> src/services/qrService.js
-> require('../models/QrCode')
-> mongoose.model('QRCode', qrCodeSchema)
```

The second execution was:

```text
src/tests/transformer.test.js beforeAll
-> require('../models/QRCode')
-> same physical src/models/QrCode.js under a differently cased Jest module ID
-> mongoose.model('QRCode', qrCodeSchema)
-> OverwriteModelError
```

The `afterAll` block repeated the stale import at line 113, producing the teardown stack entry. The seeder-related additional route was:

```text
src/tests/seedRailwayDemoUsers.test.js
-> scripts/seedRailwayDemoUsers.js
-> require('../src/models')
-> src/models/index.js
-> require('./QRCode')
-> src/models/QrCode.js on case-insensitive local filesystems
```

Repository-wide searches found no `jest.resetModules()`, `jest.isolateModules()`, relevant `jest.mock()`, manual `require.cache` clearing, `delete mongoose.models`, or `delete mongoose.connection.models`. Jest configuration is only the package script `jest --testPathPatterns=src/tests --runInBand --forceExit`; there are no Jest setup or teardown files.

## Files inspected

- `src/models/QrCode.js`
- `src/models/index.js`
- all files in `src/models/` for export-pattern comparison
- `src/services/qrService.js`
- `src/services/index.js`
- `src/controllers/transformerController.js`
- `src/routes/transformerRoutes.js`
- `src/routes/index.js`
- `src/app.js`
- `src/scripts/createIndexes.js`
- `src/tests/transformer.test.js`
- `src/tests/seedRailwayDemoUsers.test.js`
- `scripts/seedRailwayDemoUsers.js`
- `src/config/database.js`
- `package.json`
- repository-wide QRCode, Mongoose registry, Jest reset/mock, and cache-clearing references
- recent commits `63922c0`, `ec3891a`, and `edcbb52`

## Files modified and diff summary

- `src/models/index.js`: changed `require('./QRCode')` to `require('./QrCode')`.
- `src/tests/transformer.test.js`: changed both `require('../models/QRCode')` cleanup imports to `require('../models/QrCode')`.
- `src/tests/seedRailwayDemoUsers.test.js`: changed `beforeEach` to restore `originalMongoUri`, preventing a connected Mongoose instance from being pointed at a fabricated second URI after negative tests delete the environment variable.
- `docs/CHANGELOG_LOCAL_SETUP.md`: added the fix and validation entry.
- This report was added.

`src/models/QrCode.js` was not modified. Its direct `mongoose.model('QRCode', qrCodeSchema)` export is consistent with the repository's other Mongoose models. A `mongoose.models.QRCode || ...` guard was intentionally not added because there is no legitimate module-reset path; canonical imports remove the confirmed duplicate execution at its source.

## Production and Jest safety

Production safety comes from preserving the physical filename, Mongoose model name, inferred collection, schema, middleware, methods, service API, and npm `qrcode` package import. The barrel now works on Linux instead of referencing a nonexistent case variant.

Jest safety comes from making all imports resolve to one canonical module identity. Node/Jest caching then executes `QrCode.js` once per test runtime. The transformer regression suite demonstrated the failure before the change and passed after it. The test-only database URI restoration uses the exact URI captured before connection, so it does not change seeder behavior or target another database.

## Commands and results

Commands were executed in the required order after the final code changes:

1. `node --check scripts/seedRailwayDemoUsers.js` — passed, exit 0.
2. `npx jest --runInBand src/tests/seedRailwayDemoUsers.test.js` — 1/1 suite passed, 9/9 tests passed.
3. `npx jest --runInBand src/tests/transformer.test.js` — 1/1 suite passed, 30/30 tests passed.
4. `npm test` — 12/12 suites passed, 193/193 tests passed, 0 snapshots.
5. `cd frontend && npm run build` — TypeScript and Vite production build passed; 1,736 modules transformed.
6. Repository search for `models/QRCode` and stale `./QRCode` local imports — no matches.
7. Repository search confirmed `require('qrcode')` remains in `src/services/qrService.js` and `src/utils/qrGenerator.js`.

The Railway seeder was not executed, no Railway commands were run, and no Railway variables or databases were changed.

## Dependencies and configuration

Dependencies added: none.

Configuration changes: none.

## Remaining warnings

- Existing Mongoose duplicate-index warnings remain for several schemas, including QRCode fields `qr_code_string` and `status`. They were explicitly out of scope and do not cause the overwrite error.
- Existing Mongoose reserved-path warning for `errors` remains.
- Seeder tests emit Mongoose deprecation warnings for the `new` option on `findOneAndUpdate()`.
- Jest reports forced exit/open-handle guidance because the existing npm script uses `--forceExit`.
- The frontend build retains the existing warning that the main JavaScript chunk exceeds 500 kB after minification.

## Risks

Risk is low. The runtime change is limited to correcting module path casing. The only additional change is test-scoped environment restoration. A future mixed-case import could recreate this class of error on case-insensitive filesystems, so local imports must continue matching `QrCode.js` exactly.

## Rollback

Revert the implementation commit with:

```bash
git revert <implementation-commit-hash>
git push origin main
```

This restores the previous imports and test setup. It will also restore the original `OverwriteModelError` exposure, so rollback should only be used if an unforeseen regression is found.
