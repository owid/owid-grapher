// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as path from "node:path"
import { fileURLToPath } from "node:url"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { testPublint } from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// publint misdetects dist/grapher.standalone.min.js as CJS: its regex-based
// comment stripping (`/\/\/.*/g`) doesn't understand string literals, so on a
// single-line minified bundle everything after the first `https://` URL in a
// string is discarded — including the trailing `export{...}`, the file's only
// ESM syntax. The surviving prefix then matches its CJS heuristics (papaparse's
// worker-bootstrap code contains `global.IS_PAPA_WORKER` — inside a string,
// even). The standalone bundle is the package's root export and `main`, so the
// misdetection is reported against those manifest paths.
testPublint(path.join(pkgDir, "dist-package/grapher.tgz"), {
    description: "FILE_INVALID_FORMAT for the standalone bundle",
    matches: (message) =>
        message.code === "FILE_INVALID_FORMAT" &&
        (message.path.includes(".") || message.path.includes("main")),
})
