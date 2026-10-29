// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as path from "node:path"
import { fileURLToPath } from "node:url"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { testPublint } from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Same false positive as grapher's (see ../../grapher/packageTest/
// publint.packagetest.ts): publint's comment stripping cuts the minified
// standalone bundle at the first URL in a string and then mistakes what's
// left for CJS.
testPublint(path.join(pkgDir, "dist-package/grapher-editor.tgz"), {
    description: "FILE_INVALID_FORMAT for the standalone bundle",
    matches: (message) =>
        message.code === "FILE_INVALID_FORMAT" &&
        (message.path.includes(".") || message.path.includes("main")),
})
