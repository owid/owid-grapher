// Runs publint (https://publint.dev) over the packed tarball: it checks the
// packaging metadata — `exports`/`files` consistency, entry points that don't
// exist, module format vs. how Node interprets each file, and the like.
// The module-format authority remains the attw pass in `yarn testPackage:attw`.
//
// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as fs from "node:fs"
import * as path from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import { publint } from "publint"
import { formatMessage } from "publint/utils"
import { beforeAll, expect, it } from "vitest"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// Packed by `yarn testPackage:pack` (this applies publishConfig); linting the
// raw package dir would check the dev manifest with its src/ entry points
// instead.
const tarballPath = path.join(pkgDir, "dist-package/gdoc-pipeline.tgz")

beforeAll(() => {
    if (!fs.existsSync(tarballPath))
        throw new Error(
            "Missing dist-package/gdoc-pipeline.tgz — run `yarn testPackage:pack` in packages/@ourworldindata/gdoc-pipeline first."
        )
})

it("passes publint", async () => {
    const tarball = Readable.toWeb(fs.createReadStream(tarballPath))
    const { messages, pkg } = await publint({ pack: { tarball } })

    expect(
        messages.map(
            (message) =>
                `[${message.type}] ${formatMessage(message, pkg, { color: false })}`
        )
    ).toEqual([])
})
