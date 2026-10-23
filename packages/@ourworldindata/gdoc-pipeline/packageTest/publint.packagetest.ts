// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as path from "node:path"
import { fileURLToPath } from "node:url"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { testPublint } from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

testPublint(path.join(pkgDir, "dist-package/gdoc-pipeline.tgz"))
