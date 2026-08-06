// Tests that the package, as it would be published (`yarn pack` applies
// publishConfig), resolves and typechecks for an external TypeScript
// consumer — both with `moduleResolution: "bundler"` (Vite & friends) and
// `moduleResolution: "nodenext"` (plain Node ESM).
//
// The packed tarball is extracted into a throwaway consumer project whose
// node_modules contains only the packed grapher package plus symlinks to the
// handful of packages its bundled d.ts imports from (react, mobx). tsc then
// typechecks a consumer file against it, with `skipLibCheck: true` like
// virtually all real consumers (mobx's own declarations don't pass a full lib
// check under any lib version). To still validate our bundled declaration
// file itself, a third tsc run checks a copy of it renamed to `.ts` —
// skipLibCheck only skips `.d.ts` files, so the copy is fully checked while
// third-party declarations stay skipped.
//
// Requires `yarn build` to have run first; execute via `yarn testPackage`.

import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(pkgDir, "../../..")
const tscBin = path.join(repoRoot, "node_modules/.bin/tsc")

// Packages the bundled grapher.public.d.ts imports types from. The consumer
// needs them resolvable, so we symlink them out of the monorepo node_modules
// (csstype is required by @types/react).
const TYPE_DEPENDENCIES = [
    "@types/react",
    "@types/react-dom",
    "csstype",
    "mobx",
]

// Exercises the public API surface. The @ts-expect-error lines double as a
// guard that the types are real: if the declarations failed to load and
// everything collapsed to `any`, tsc would report the suppressions as unused
// (TS2578) and the typecheck would fail.
const CONSUMER_SOURCE = `import {
    Grapher,
    GrapherLoader,
    OwidTable,
    type FromApiOptions,
    type FromCsvOptions,
    type FromTableOptions,
    type GrapherInterface,
} from "@ourworldindata/grapher"

const config: GrapherInterface = { title: "Smoke test chart" }

const tableOptions: FromTableOptions = { config, data: new OwidTable() }
const loader: GrapherLoader = GrapherLoader.fromTable(tableOptions)
loader.mount(document.body)
loader.grapherState.externalBounds satisfies unknown
loader.dispose()

const csvOptions: FromCsvOptions = {
    config,
    csvUrl: "https://example.org/data.csv",
}
GrapherLoader.fromCsv(csvOptions)

const apiOptions: FromApiOptions = { config }
GrapherLoader.fromApi(apiOptions)

// @ts-expect-error csvUrl must be a string
GrapherLoader.fromCsv({ config, csvUrl: 123 })

// @ts-expect-error fromTable requires a data table
GrapherLoader.fromTable({ config })

console.log(Grapher.name)
`

let tmpDir: string
let consumerDir: string

function writeTsconfig(
    fileName: string,
    options: {
        moduleResolution: "bundler" | "nodenext"
        include: string[]
    }
): void {
    const config = {
        compilerOptions: {
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            module:
                options.moduleResolution === "bundler"
                    ? "esnext"
                    : "nodenext",
            moduleResolution: options.moduleResolution,
            target: "es2022",
            lib: ["esnext", "dom", "dom.iterable"],
            types: [],
        },
        include: options.include,
    }
    fs.writeFileSync(
        path.join(consumerDir, fileName),
        JSON.stringify(config, null, 4)
    )
}

function runTsc(tsconfigFileName: string): void {
    const result = spawnSync(tscBin, ["-p", tsconfigFileName], {
        cwd: consumerDir,
        encoding: "utf8",
    })
    expect(
        result.status,
        `tsc -p ${tsconfigFileName} failed:\n${result.stdout}${result.stderr}`
    ).toBe(0)
}

beforeAll(() => {
    if (!fs.existsSync(path.join(pkgDir, "dist/grapher.public.d.ts")))
        throw new Error(
            "Missing dist/grapher.public.d.ts — run `yarn build` in packages/@ourworldindata/grapher first."
        )

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "grapher-package-test-"))

    // Pack the package exactly as `yarn npm publish` would.
    const tarball = path.join(tmpDir, "grapher.tgz")
    const packResult = spawnSync("yarn", ["pack", "--out", tarball], {
        cwd: pkgDir,
        encoding: "utf8",
    })
    if (packResult.status !== 0)
        throw new Error(
            `yarn pack failed:\n${packResult.stdout}${packResult.stderr}`
        )
    const tarResult = spawnSync("tar", ["-xzf", tarball, "-C", tmpDir], {
        encoding: "utf8",
    })
    if (tarResult.status !== 0)
        throw new Error(`tar extraction failed:\n${tarResult.stderr}`)

    // Assemble the consumer project.
    consumerDir = path.join(tmpDir, "consumer")
    const nodeModules = path.join(consumerDir, "node_modules")
    fs.mkdirSync(path.join(nodeModules, "@ourworldindata"), {
        recursive: true,
    })
    // Move (don't symlink) the package into node_modules: tsc resolves the
    // d.ts's own imports (react, mobx) from the file's real path.
    fs.renameSync(
        path.join(tmpDir, "package"),
        path.join(nodeModules, "@ourworldindata/grapher")
    )
    fs.mkdirSync(path.join(nodeModules, "@types"))
    for (const dep of TYPE_DEPENDENCIES) {
        fs.symlinkSync(
            path.join(repoRoot, "node_modules", dep),
            path.join(nodeModules, dep)
        )
    }

    fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify({ name: "grapher-consumer", type: "module" }, null, 4)
    )
    fs.writeFileSync(path.join(consumerDir, "main.ts"), CONSUMER_SOURCE)
    // Copy of the bundled declaration file, renamed to .ts so tsc fully
    // checks it (skipLibCheck skips .d.ts files).
    fs.copyFileSync(
        path.join(
            nodeModules,
            "@ourworldindata/grapher/dist/grapher.public.d.ts"
        ),
        path.join(consumerDir, "declarationCheck.ts")
    )
    writeTsconfig("tsconfig.bundler.json", {
        moduleResolution: "bundler",
        include: ["main.ts"],
    })
    writeTsconfig("tsconfig.nodenext.json", {
        moduleResolution: "nodenext",
        include: ["main.ts"],
    })
    writeTsconfig("tsconfig.dtscheck.json", {
        moduleResolution: "bundler",
        include: ["declarationCheck.ts"],
    })
})

afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("packed package", () => {
    it("contains the dist files, and its manifest points at them", () => {
        const packedDir = path.join(
            consumerDir,
            "node_modules/@ourworldindata/grapher"
        )
        const manifest = JSON.parse(
            fs.readFileSync(path.join(packedDir, "package.json"), "utf8")
        ) as {
            main: string
            types: string
            exports: Record<string, unknown>
        }

        // `yarn pack` must have applied publishConfig.
        expect(manifest.main).toBe("dist/grapher.js")
        expect(manifest.types).toBe("dist/grapher.public.d.ts")
        expect(manifest.exports).toBeDefined()

        for (const file of [
            manifest.main,
            manifest.types,
            "dist/grapher.css",
            "dist/grapher.bundle.js",
        ]) {
            expect(
                fs.existsSync(path.join(packedDir, file)),
                `packed file ${file}`
            ).toBe(true)
        }
    })

    it("typechecks for a bundler consumer (moduleResolution: bundler)", () => {
        runTsc("tsconfig.bundler.json")
    })

    it("typechecks for a Node ESM consumer (moduleResolution: nodenext)", () => {
        runTsc("tsconfig.nodenext.json")
    })

    it("ships an internally valid declaration bundle", () => {
        runTsc("tsconfig.dtscheck.json")
    })
})
