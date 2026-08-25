// Tests that the package, as it would be published (the tarball from
// `yarn testPackage:pack` has publishConfig applied), resolves and typechecks
// for an external TypeScript consumer — both with `moduleResolution: "bundler"`
// (Vite & friends) and `moduleResolution: "nodenext"` (plain Node ESM).
//
// The packed tarball is extracted into a throwaway consumer project whose
// node_modules contains only the packed package plus a symlink to
// @googleapis/docs — the only package its bundled d.ts is allowed to import
// from (enforced by a test below). tsc then typechecks a consumer file
// against it, with `skipLibCheck: true` like virtually all real consumers.
// To still validate our bundled declaration file itself, a third tsc run
// checks a copy of it renamed to `.ts` — skipLibCheck only skips `.d.ts`
// files, so the copy is fully checked while third-party declarations stay
// skipped.
//
// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`). The @arethetypeswrong/cli check over the same
// tarball runs separately via `yarn testPackage:attw`.

import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { init as initEsModuleLexer, parse } from "es-module-lexer"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(pkgDir, "../../..")
const tscBin = path.join(repoRoot, "node_modules/.bin/tsc")

// Packages the bundled gdoc-pipeline.d.ts imports types from. The consumer
// needs them resolvable, so we symlink them out of the monorepo node_modules.
const TYPE_DEPENDENCIES = ["@googleapis/docs", "googleapis-common", "zod"]

// The only module the bundled gdoc-pipeline.d.ts may import from:
// @googleapis/docs (the Google Docs document JSON types that gdocToArchie
// consumes), which is an optional peer dependency. Everything else must be
// inlined into the bundle — any other external import forces consumers to
// install that package just to typecheck.
const ALLOWED_TYPE_IMPORTS = /^(@googleapis\/docs|zod)(\/|$)/

// Exercises the public API surface. The @ts-expect-error lines double as a
// guard that the types are real: if the declarations failed to load and
// everything collapsed to `any`, tsc would report the suppressions as unused
// (TS2578) and the typecheck would fail.
const CONSUMER_SOURCE = `import {
    archieToEnriched,
    enrichedBlockToRawBlock,
    enrichedBlocksToMarkdown,
    gdocToArchie,
    htmlToSpans,
    traverseEnrichedBlock,
    OwidRawGdocBlockToArchieMLString,
    type OwidEnrichedGdocBlock,
    type OwidGdocPostContent,
    type OwidRawGdocBlock,
    type Span,
} from "@ourworldindata/gdoc-pipeline"

const content: OwidGdocPostContent = archieToEnriched("title: Smoke test")
const body: OwidEnrichedGdocBlock[] = content.body ?? []
for (const block of body) {
    traverseEnrichedBlock(block, (b) => void b)
    const raw: OwidRawGdocBlock = enrichedBlockToRawBlock(block)
    const archie: string = OwidRawGdocBlockToArchieMLString(raw)
    void archie
}
const markdown: string | undefined = enrichedBlocksToMarkdown(body, false)
void markdown

const spans: Span[] = htmlToSpans("Hello <b>world</b>")
void spans

// gdocToArchie consumes the Google Docs API document JSON
const archiePromise: Promise<{ text: string }> = gdocToArchie({
    title: "Doc",
    body: { content: [] },
})
void archiePromise

// @ts-expect-error archieToEnriched requires a string
archieToEnriched(42)

// @ts-expect-error enrichedBlocksToMarkdown requires the exportComponents flag
enrichedBlocksToMarkdown(body)
`

let tmpDir: string
let consumerDir: string
const tarballPath = path.join(pkgDir, "dist-package/gdoc-pipeline.tgz")

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
                options.moduleResolution === "bundler" ? "esnext" : "nodenext",
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
    if (!fs.existsSync(path.join(pkgDir, "dist/gdoc-pipeline.d.ts")))
        throw new Error(
            "Missing dist/gdoc-pipeline.d.ts — run `yarn build` in packages/@ourworldindata/gdoc-pipeline first."
        )
    if (!fs.existsSync(tarballPath))
        throw new Error(
            "Missing dist-package/gdoc-pipeline.tgz — run `yarn testPackage:pack` in packages/@ourworldindata/gdoc-pipeline first."
        )

    tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "gdoc-pipeline-package-test-")
    )

    // The tarball is packed by `yarn testPackage:pack` exactly as
    // `yarn npm publish` would.
    const tarResult = spawnSync("tar", ["-xzf", tarballPath, "-C", tmpDir], {
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
    // d.ts's own imports from the file's real path.
    fs.renameSync(
        path.join(tmpDir, "package"),
        path.join(nodeModules, "@ourworldindata/gdoc-pipeline")
    )
    fs.mkdirSync(path.join(nodeModules, "@googleapis"))
    for (const dep of TYPE_DEPENDENCIES) {
        fs.symlinkSync(
            path.join(repoRoot, "node_modules", dep),
            path.join(nodeModules, dep)
        )
    }

    fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify(
            { name: "gdoc-pipeline-consumer", type: "module" },
            null,
            4
        )
    )
    fs.writeFileSync(path.join(consumerDir, "main.ts"), CONSUMER_SOURCE)
    // Copy of the bundled declaration file, renamed to .ts so tsc fully
    // checks it (skipLibCheck skips .d.ts files).
    fs.copyFileSync(
        path.join(
            nodeModules,
            "@ourworldindata/gdoc-pipeline/dist/gdoc-pipeline.d.ts"
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
            "node_modules/@ourworldindata/gdoc-pipeline"
        )
        const manifest = JSON.parse(
            fs.readFileSync(path.join(packedDir, "package.json"), "utf8")
        ) as {
            main: string
            types: string
            exports: Record<string, unknown>
            dependencies?: Record<string, string>
            peerDependencies?: Record<string, string>
        }

        // `yarn pack` must have applied publishConfig.
        expect(manifest.main).toBe("dist/gdoc-pipeline.js")
        expect(manifest.types).toBe("dist/gdoc-pipeline.d.ts")
        expect(manifest.exports).toBeDefined()

        // Everything the package needs at runtime is bundled, so it must not
        // declare any dependencies: `yarn pack` turns `workspace:^` entries
        // into semver ranges of unpublished packages, which would make
        // `npm install` fail outright. Only the optional @googleapis/docs
        // peer dep (types for gdocToArchie's input) is expected.
        expect(manifest.dependencies).toBeUndefined()
        expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([
            "@googleapis/docs",
        ])

        for (const file of [manifest.main, manifest.types]) {
            expect(
                fs.existsSync(path.join(packedDir, file)),
                `packed file ${file}`
            ).toBe(true)
        }
    })

    it("contains only the intended files", () => {
        const entries = spawnSync("tar", ["-tzf", tarballPath], {
            encoding: "utf8",
        })
            .stdout.trim()
            .split("\n")

        // On dev machines, dist/ also accumulates per-module output from the
        // project-references tsc build (dist/src/**) — files that must not
        // end up in the tarball. package.json's `files` therefore lists the
        // tsdown artifacts explicitly.
        expect(
            entries.filter((e) => e.startsWith("package/dist/src/"))
        ).toEqual([])
        expect(entries.length).toBeLessThan(15)
    })

    it("only imports from @googleapis/docs in its declaration bundle", async () => {
        const dtsPath = path.join(
            consumerDir,
            "node_modules/@ourworldindata/gdoc-pipeline/dist/gdoc-pipeline.d.ts"
        )
        const source = fs.readFileSync(dtsPath, "utf8")

        // es-module-lexer picks up all import/export forms, including inline
        // `import("...")` type references, and correctly ignores comments.
        await initEsModuleLexer
        const [imports] = parse(source, "gdoc-pipeline.d.ts")
        const specifiers = new Set(
            imports.map((imp) => imp.n).filter((name) => name !== undefined)
        )
        // `/// <reference types="..." />` directives aren't imports, but pull
        // in type packages all the same.
        for (const [, types] of source.matchAll(
            /^\/\/\/\s*<reference\s+types\s*=\s*["']([^"']+)["']/gm
        ))
            specifiers.add(types)

        expect(specifiers.size).toBeGreaterThan(0)
        const disallowed = [...specifiers].filter(
            (specifier) => !ALLOWED_TYPE_IMPORTS.test(specifier)
        )
        expect(disallowed).toEqual([])
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
