// Runs publint (https://publint.dev) over the packed tarball: it checks the
// packaging metadata — `exports`/`files` consistency, entry points that don't
// exist, module format vs. how Node interprets each file, and the like.
// The module-format authority remains the attw pass in `yarn testPackage:attw`
// (see the known false positive below).
//
// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as fs from "node:fs"
import * as path from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import { publint, type Message } from "publint"
import { formatMessage } from "publint/utils"
import { beforeAll, expect, it } from "vitest"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// Packed by `yarn testPackage:pack` (this applies publishConfig); linting the
// raw package dir would check the dev manifest with its src/ entry points
// instead.
const tarballPath = path.join(pkgDir, "dist-package/grapher.tgz")

// publint misdetects dist/grapher.standalone.min.js as CJS: its regex-based
// comment stripping (`/\/\/.*/g`) doesn't understand string literals, so on a
// single-line minified bundle everything after the first `https://` URL in a
// string is discarded — including the trailing `export{...}`, the file's only
// ESM syntax. The surviving prefix then matches its CJS heuristics (papaparse's
// worker-bootstrap code contains `global.IS_PAPA_WORKER` — inside a string,
// even). The standalone bundle is the package's root export and `main`, so the
// misdetection is reported against those manifest paths.
function isKnownFalsePositive(message: Message): boolean {
    return (
        message.code === "FILE_INVALID_FORMAT" &&
        (message.path.includes(".") || message.path.includes("main"))
    )
}

beforeAll(() => {
    if (!fs.existsSync(tarballPath))
        throw new Error(
            "Missing dist-package/grapher.tgz — run `yarn testPackage:pack` in packages/@ourworldindata/grapher first."
        )
})

it("passes publint", async () => {
    const tarball = Readable.toWeb(fs.createReadStream(tarballPath))
    const { messages, pkg } = await publint({ pack: { tarball } })

    const unexpected = messages.filter(
        (message) => !isKnownFalsePositive(message)
    )
    expect(
        unexpected.map(
            (message) =>
                `[${message.type}] ${formatMessage(message, pkg, { color: false })}`
        )
    ).toEqual([])

    // If the false positive disappears (fixed upstream, or the bundle
    // changed), the exception above should be removed.
    expect(
        messages.some(isKnownFalsePositive),
        "publint no longer reports the known FILE_INVALID_FORMAT false positive for the standalone bundle — remove the isKnownFalsePositive exception."
    ).toBe(true)
})
