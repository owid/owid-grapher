// Checks shared by the built-package smoke tests of our published npm packages
// (<package>/packageTest/*.packagetest.ts). Each package's test files supply
// what's specific to them — names, entry points, the consumer source — and
// keep their own runtime smoke tests.
//
// These tests need dist/ and the packed dist-package/<name>.tgz to exist, so
// they're kept out of the regular unit test run: the `.packagetest.ts` suffix
// doesn't match vitest's default include pattern, and only the config below
// picks them up. Run them with `yarn testPackage` in the package directory.

import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Readable } from "node:stream"
import { init as initEsModuleLexer, parse } from "es-module-lexer/minimal"
import { publint, type Message } from "publint"
import { formatMessage } from "publint/utils"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const repoRoot = path.resolve(import.meta.dirname, "../..")
const tscBin = path.join(repoRoot, "node_modules/.bin/tsc")

// For each package's vitest.package.config.ts.
export const packageTestConfig = {
    test: {
        include: ["packageTest/**/*.packagetest.ts"],
        // Packing + typechecking the package takes a while.
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
}

// Fails early with a pointer to the missing build step, instead of letting
// every test fail with a confusing ENOENT.
export function assertFilesExist(
    pkgDir: string,
    files: string[],
    howToCreate: string
): void {
    for (const file of files) {
        if (!fs.existsSync(file))
            throw new Error(
                `Missing ${path.relative(pkgDir, file)} — run ${howToCreate} in ${path.relative(repoRoot, pkgDir)} first.`
            )
    }
}

// The module specifiers a JS or d.ts file imports from. es-module-lexer picks
// up all import/export forms, including inline `import("...")` type
// references, and correctly ignores comments and strings.
export async function readImportSpecifiers(
    filePath: string
): Promise<Set<string>> {
    const source = fs.readFileSync(filePath, "utf8")
    await initEsModuleLexer()
    const [imports] = parse(source, path.basename(filePath))
    const specifiers = new Set(
        imports.map((imp) => imp.n).filter((name) => name !== undefined)
    )
    // `/// <reference types="..." />` directives aren't imports, but pull in
    // type packages all the same.
    for (const [, types] of source.matchAll(
        /^\/\/\/\s*<reference\s+types\s*=\s*["']([^"']+)["']/gm
    ))
        specifiers.add(types)
    return specifiers
}

// Runs publint (https://publint.dev) over the packed tarball: it checks the
// packaging metadata — `exports`/`files` consistency, entry points that don't
// exist, module format vs. how Node interprets each file, and the like. The
// module-format authority remains the attw pass in `yarn testPackage:attw`.
//
// The tarball (packed by `yarn testPackage:pack`, which applies
// publishConfig) is linted rather than the package dir, which would check the
// dev manifest with its src/ entry points instead.
export function testPublint(
    tarballPath: string,
    knownFalsePositive?: {
        matches: (message: Message) => boolean
        description: string
    }
): void {
    it("passes publint", async () => {
        const tarball = Readable.toWeb(fs.createReadStream(tarballPath))
        const { messages, pkg } = await publint({ pack: { tarball } })

        const unexpected = messages.filter(
            (message) => !knownFalsePositive?.matches(message)
        )
        expect(
            unexpected.map(
                (message) =>
                    `[${message.type}] ${formatMessage(message, pkg, { color: false })}`
            )
        ).toEqual([])

        // If the false positive disappears (fixed upstream, or the bundle
        // changed), the exception should be removed.
        if (knownFalsePositive)
            expect(
                messages.some(knownFalsePositive.matches),
                `publint no longer reports the known false positive (${knownFalsePositive.description}) — remove the exception.`
            ).toBe(true)
    })
}

function writeTsconfig(
    consumerDir: string,
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

export interface PackedPackageOptions {
    // e.g. "@ourworldindata/grapher"
    packageName: string
    tarballPath: string
    // Path of the bundled declaration file inside the package.
    declarationFile: string
    // What `yarn pack` must have written into the packed manifest.
    manifest: {
        main: string
        types: string
        // Exports that must be present (a subset of the packed `exports`).
        exports?: Record<string, unknown>
        // Keys of peerDependencies, in order.
        peerDependencies: string[]
        // Files besides main and types that must be in the tarball.
        files?: string[]
    }
    // Upper bound on the number of tarball entries.
    maxEntries: number
    // Packages the bundled d.ts imports types from. The consumer needs them
    // resolvable, so they're symlinked out of the monorepo node_modules.
    typeDependencies: string[]
    // The only modules the bundled d.ts may import from. Everything else must
    // be inlined into the bundle — any other external import forces consumers
    // to install that package just to typecheck.
    allowedTypeImports: RegExp
    // A consumer file exercising the public API surface. @ts-expect-error
    // lines in it double as a guard that the types are real: if the
    // declarations failed to load and everything collapsed to `any`, tsc would
    // report the suppressions as unused (TS2578) and the typecheck would fail.
    consumerSource: string
}

// Tests that the package, as it would be published (the tarball from
// `yarn testPackage:pack` has publishConfig applied), resolves and typechecks
// for an external TypeScript consumer — both with `moduleResolution: "bundler"`
// (Vite & friends) and `moduleResolution: "nodenext"` (plain Node ESM).
//
// The packed tarball is extracted into a throwaway consumer project whose
// node_modules contains only the packed package plus symlinks to the type
// packages its bundled d.ts is allowed to import from. tsc then typechecks the
// consumer file against it, with `skipLibCheck: true` like virtually all real
// consumers. To still validate our bundled declaration file itself, a third
// tsc run checks a copy of it renamed to `.ts` — skipLibCheck only skips
// `.d.ts` files, so the copy is fully checked while third-party declarations
// stay skipped.
//
// The @arethetypeswrong/cli check over the same tarball runs separately via
// `yarn testPackage:attw`.
export function describePackedPackage(options: PackedPackageOptions): void {
    const { packageName, tarballPath } = options
    let tmpDir: string | undefined
    let consumerDir: string
    let packedDir: string

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
        if (!fs.existsSync(tarballPath))
            throw new Error(
                `Missing ${tarballPath} — run \`yarn build && yarn testPackage:pack\` in the ${packageName} package first.`
            )

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "package-test-"))

        // The tarball is packed by `yarn testPackage:pack` exactly as
        // `yarn npm publish` would.
        const tarResult = spawnSync(
            "tar",
            ["-xzf", tarballPath, "-C", tmpDir],
            { encoding: "utf8" }
        )
        if (tarResult.status !== 0)
            throw new Error(`tar extraction failed:\n${tarResult.stderr}`)

        // Assemble the consumer project.
        consumerDir = path.join(tmpDir, "consumer")
        const nodeModules = path.join(consumerDir, "node_modules")
        packedDir = path.join(nodeModules, packageName)
        fs.mkdirSync(path.dirname(packedDir), { recursive: true })
        // Move (don't symlink) the package into node_modules: tsc resolves the
        // d.ts's own imports from the file's real path.
        fs.renameSync(path.join(tmpDir, "package"), packedDir)
        for (const dep of options.typeDependencies) {
            const target = path.join(nodeModules, dep)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.symlinkSync(path.join(repoRoot, "node_modules", dep), target)
        }

        fs.writeFileSync(
            path.join(consumerDir, "package.json"),
            JSON.stringify(
                { name: "package-consumer", type: "module" },
                null,
                4
            )
        )
        fs.writeFileSync(
            path.join(consumerDir, "main.ts"),
            options.consumerSource
        )
        // Copy of the bundled declaration file, renamed to .ts so tsc fully
        // checks it (skipLibCheck skips .d.ts files).
        fs.copyFileSync(
            path.join(packedDir, options.declarationFile),
            path.join(consumerDir, "declarationCheck.ts")
        )
        writeTsconfig(consumerDir, "tsconfig.bundler.json", {
            moduleResolution: "bundler",
            include: ["main.ts"],
        })
        writeTsconfig(consumerDir, "tsconfig.nodenext.json", {
            moduleResolution: "nodenext",
            include: ["main.ts"],
        })
        writeTsconfig(consumerDir, "tsconfig.dtscheck.json", {
            moduleResolution: "bundler",
            include: ["declarationCheck.ts"],
        })
    })

    afterAll(() => {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    describe("packed package", () => {
        it("contains the dist files, and its manifest points at them", () => {
            const manifest = JSON.parse(
                fs.readFileSync(path.join(packedDir, "package.json"), "utf8")
            ) as {
                main: string
                types: string
                exports: Record<string, unknown>
                dependencies?: Record<string, string>
                peerDependencies?: Record<string, string>
            }
            const expected = options.manifest

            // `yarn pack` must have applied publishConfig.
            expect(manifest.main).toBe(expected.main)
            expect(manifest.types).toBe(expected.types)
            expect(manifest.exports).toBeDefined()
            if (expected.exports)
                expect(manifest.exports).toMatchObject(expected.exports)

            // Everything the package needs at runtime is bundled, so it must
            // not declare any dependencies: `yarn pack` turns `workspace:^`
            // entries into semver ranges of unpublished packages, which would
            // make `npm install` fail outright. Anything consumers do need to
            // bring along is declared as a peer dependency instead.
            expect(manifest.dependencies).toBeUndefined()
            expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(
                expected.peerDependencies
            )

            for (const file of [
                manifest.main,
                manifest.types,
                ...(expected.files ?? []),
            ]) {
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

            // On dev machines, dist/ also accumulates per-module output from
            // the project-references tsc build (dist/src/**) — for grapher over
            // 900 files that must not end up in the tarball. package.json's
            // `files` therefore lists the tsdown artifacts explicitly.
            expect(
                entries.filter((e) => e.startsWith("package/dist/src/"))
            ).toEqual([])
            expect(entries.length).toBeLessThan(options.maxEntries)
        })

        it("only imports from allowed modules in its declaration bundle", async () => {
            const specifiers = await readImportSpecifiers(
                path.join(packedDir, options.declarationFile)
            )
            expect(specifiers.size).toBeGreaterThan(0)
            const disallowed = [...specifiers].filter(
                (specifier) => !options.allowedTypeImports.test(specifier)
            )
            expect(disallowed).toEqual([])
        })

        it("does not augment the global scope or third-party modules", () => {
            // A `declare global` block (or a top-level module augmentation
            // like `declare module "react"`) anywhere in the bundled sources
            // ends up in the bundled declarations, where it silently rewrites
            // those types in every consumer's project — e.g. a Window
            // augmentation would make `window.admin` an `any` for everyone who
            // imports the package. Keep such augmentations out of the
            // published type surface; type globals locally at the use site
            // instead (see getWindowAdmin in GrapherState.tsx).
            const dts = fs.readFileSync(
                path.join(packedDir, options.declarationFile),
                "utf8"
            )
            expect(dts).not.toMatch(/^\s*declare\s+global\b/m)
            expect(dts).not.toMatch(/^\s*declare\s+module\s+["']/m)
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
}
