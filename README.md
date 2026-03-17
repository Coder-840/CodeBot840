Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

Try the new cross-platform PowerShell https://aka.ms/pscore6

PS C:\WINDOWS\system32> cd "C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main"
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main> npm install socks-proxy-agent

added 4 packages, and audited 139 packages in 4s

14 packages are looking for funding
  run `npm fund` for details

5 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main> npm install

up to date, audited 139 packages in 4s

14 packages are looking for funding
  run `npm fund` for details

5 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main> node index.js
node:internal/modules/cjs/loader:692
      throw e;
      ^

Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main\node_modules\socks-proxy-agent\package.json
    at exportsNotFound (node:internal/modules/esm/resolve:314:10)
    at packageExportsResolve (node:internal/modules/esm/resolve:605:13)
    at resolveExports (node:internal/modules/cjs/loader:685:36)
    at Module._findPath (node:internal/modules/cjs/loader:752:31)
    at Module._resolveFilename (node:internal/modules/cjs/loader:1441:27)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1066:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1071:22)
    at Module._load (node:internal/modules/cjs/loader:1242:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1556:12) {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
}
