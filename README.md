Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

Try the new cross-platform PowerShell https://aka.ms/pscore6

PS C:\WINDOWS\system32> cd "C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main"
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main> npm install
npm error code ETARGET
npm error notarget No matching version found for mineflayer-pvp@^2.3.0.
npm error notarget In most cases you or one of your dependencies are requesting
npm error notarget a package version that doesn't exist.
npm error A complete log of this run can be found in: C:\Users\Ryan Huang\AppData\Local\npm-cache\_logs\2026-03-21T13_58_02_128Z-debug-0.log
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main> npm start

> codebot840@1.0.0 start
> node index.js

node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'mineflayer'
Require stack:
- C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main\index.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1066:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1071:22)
    at Module._load (node:internal/modules/cjs/loader:1242:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1556:12)
    at require (node:internal/modules/helpers:152:16)
    at Object.<anonymous> (C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main\index.js:3:20)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    'C:\\Users\\Ryan Huang\\Downloads\\CodeBot840-main\\CodeBot840-main\\index.js'
  ]
}

Node.js v24.14.0
PS C:\Users\Ryan Huang\Downloads\CodeBot840-main\CodeBot840-main>
