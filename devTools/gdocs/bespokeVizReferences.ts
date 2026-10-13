/*
 * Reads each bespoke bundle's VARIANTS and CONFIG_SPEC out of its
 * src/index.tsx with the tsgo AST — statically, since CI installs only the
 * root dependencies and no bespoke code may run — and hands them to
 * bespokeVizDeclarations.ts, which checks them and builds the registry
 * entries.
 *
 * Only literal declarations can be documented: string literals, arrays of
 * string literals (with or without `as const`), and identifiers bound to
 * either by a local `const` or a named import from a relative module.
 * Anything else (a spread, a computed key, a call, a re-export) fails the
 * build naming the file and the entry, rather than documenting a guess.
 */

import fs from "fs-extra"
import path from "path"

import { API } from "typescript/unstable/sync"
import {
    NodeFlags,
    type Expression,
    type ObjectLiteralExpression,
    type SourceFile,
    type VariableDeclaration,
} from "typescript/unstable/ast"
import {
    isArrayLiteralExpression,
    isAsExpression,
    isExportKeyword,
    isIdentifier,
    isImportDeclaration,
    isNamedImports,
    isNoSubstitutionTemplateLiteral,
    isObjectLiteralExpression,
    isParenthesizedExpression,
    isPropertyAssignment,
    isSatisfiesExpression,
    isStringLiteral,
    isVariableStatement,
} from "typescript/unstable/ast/is"

import type {
    BespokeVizRegistry,
    BundleConfigFieldType,
    BundleVariantSize,
} from "@ourworldindata/types"

import {
    buildBundleReference,
    type DeclaredConfigField,
    type DeclaredVariant,
} from "./bespokeVizDeclarations.js"
import { constStringArrayValues } from "./sidecarFiles.js"

const REPO_ROOT = path.resolve(__dirname, "../..")
const PROJECTS_DIR = path.join(REPO_ROOT, "bespoke/projects")

// Deep enough for a constant defined in terms of another, shallow enough to
// stop an accidental cycle.
const MAX_RESOLVE_DEPTH = 5

interface TsProgram {
    getSourceFile(file: string): SourceFile | undefined
}

interface BundlePaths {
    id: string
    entryFile: string
    tsconfig: string
    docsFile: string
}

function rel(file: string): string {
    return path.relative(REPO_ROOT, file)
}

function bundlePaths(id: string): BundlePaths {
    const projectDir = path.join(PROJECTS_DIR, id)
    const paths = {
        id,
        entryFile: path.join(projectDir, "src/index.tsx"),
        tsconfig: path.join(projectDir, "tsconfig.json"),
        docsFile: path.join(projectDir, "docs.md"),
    }
    if (!fs.existsSync(projectDir))
        throw new Error(
            'Bespoke bundle "' +
                id +
                '" is registered, but has no project at ' +
                rel(projectDir)
        )
    for (const file of [paths.entryFile, paths.tsconfig])
        if (!fs.existsSync(file))
            throw new Error('Bespoke bundle "' + id + '" has no ' + rel(file))
    return paths
}

/** Strips `satisfies`, `as` and parentheses, which say nothing about values */
function unwrap(expression: Expression): Expression {
    let current = expression
    while (
        isSatisfiesExpression(current) ||
        isAsExpression(current) ||
        isParenthesizedExpression(current)
    )
        current = current.expression
    return current
}

function sourceText(sf: SourceFile, node: Expression): string {
    return sf.text.slice(node.pos, node.end).trim()
}

/**
 * Reads values out of the bundle's entry file, following identifiers to their
 * declarations, through named relative imports too. `file` is the entry
 * file, named in every error.
 */
class ValueReader {
    constructor(
        private readonly program: TsProgram,
        private readonly file: string
    ) {}

    private fail(what: string, message: string): never {
        throw new Error(rel(this.file) + ": " + what + " " + message)
    }

    /** The top-level `const` declaration of a name in a file */
    private localConst(
        sf: SourceFile,
        name: string
    ): VariableDeclaration | undefined {
        for (const statement of sf.statements) {
            if (!isVariableStatement(statement)) continue
            const list = statement.declarationList
            if (!(list.flags & NodeFlags.Const)) continue
            for (const decl of list.declarations)
                if (isIdentifier(decl.name) && decl.name.text === name)
                    return decl
        }
        return undefined
    }

    /** The module file a relative import specifier points at */
    private resolveModule(fromFile: string, specifier: string): string {
        const base = path.resolve(path.dirname(fromFile), specifier)
        const stem = base.replace(/\.(js|jsx|ts|tsx)$/, "")
        const candidates = [
            ...(/\.tsx?$/.test(base) ? [base] : []),
            stem + ".ts",
            stem + ".tsx",
            path.join(base, "index.ts"),
            path.join(base, "index.tsx"),
        ]
        const found = candidates.find((candidate) => fs.existsSync(candidate))
        return found ?? base
    }

    /**
     * The declaration an identifier is bound to: a local `const`, or an
     * exported `const` of a relative module it is imported from by name.
     */
    private declarationOf(
        sf: SourceFile,
        name: string,
        what: string
    ): { decl: VariableDeclaration; sf: SourceFile } {
        const local = this.localConst(sf, name)
        if (local) return { decl: local, sf }
        for (const statement of sf.statements) {
            if (!isImportDeclaration(statement)) continue
            const bindings = statement.importClause?.namedBindings
            const isDefault = statement.importClause?.name?.text === name
            const isNamespace =
                bindings !== undefined &&
                !isNamedImports(bindings) &&
                bindings.name.text === name
            const specifier =
                bindings && isNamedImports(bindings)
                    ? bindings.elements.find(
                          (element) => element.name.text === name
                      )
                    : undefined
            if (!isDefault && !isNamespace && !specifier) continue
            if (!isStringLiteral(statement.moduleSpecifier))
                this.fail(what, "imports " + name + " from a non-literal path")
            const moduleName = statement.moduleSpecifier.text
            if (isDefault || isNamespace)
                this.fail(
                    what,
                    "uses " +
                        name +
                        ", a default or namespace import from " +
                        moduleName +
                        " — import it by name"
                )
            if (!moduleName.startsWith("."))
                this.fail(
                    what,
                    "uses " +
                        name +
                        ", imported from the package " +
                        moduleName +
                        " — only relative imports can be read"
                )
            const target = this.resolveModule(sf.fileName, moduleName)
            const targetSf = this.program.getSourceFile(target)
            if (!targetSf)
                this.fail(
                    what,
                    "uses " +
                        name +
                        ", imported from " +
                        moduleName +
                        ", which does not resolve to a source file of the project"
                )
            const exportedName = specifier?.propertyName
                ? specifier.propertyName.text
                : name
            const decl = this.localConst(targetSf, exportedName)
            if (!decl)
                this.fail(
                    what,
                    "uses " +
                        name +
                        ", which " +
                        rel(targetSf.fileName) +
                        " does not declare as a top-level const (re-exports " +
                        "and barrels can't be read)"
                )
            return { decl, sf: targetSf }
        }
        return this.fail(
            what,
            "uses " + name + ", which is neither a local const nor imported"
        )
    }

    private resolvedInitializer(
        sf: SourceFile,
        name: string,
        what: string
    ): { expression: Expression; sf: SourceFile; decl: VariableDeclaration } {
        const { decl, sf: declSf } = this.declarationOf(sf, name, what)
        if (!decl.initializer)
            this.fail(what, "uses " + name + ", which has no value")
        return { expression: decl.initializer, sf: declSf, decl }
    }

    string(sf: SourceFile, node: Expression, what: string, depth = 0): string {
        const expression = unwrap(node)
        if (
            isStringLiteral(expression) ||
            isNoSubstitutionTemplateLiteral(expression)
        )
            return expression.text
        if (isIdentifier(expression) && depth < MAX_RESOLVE_DEPTH) {
            const resolved = this.resolvedInitializer(sf, expression.text, what)
            return this.string(
                resolved.sf,
                resolved.expression,
                what,
                depth + 1
            )
        }
        return this.fail(
            what,
            "is not a string literal: " + sourceText(sf, node)
        )
    }

    stringArray(
        sf: SourceFile,
        node: Expression,
        what: string,
        depth = 0
    ): string[] {
        const expression = unwrap(node)
        if (isArrayLiteralExpression(expression))
            return expression.elements.map((element, index) =>
                this.string(sf, element, what + "[" + index + "]", depth)
            )
        if (isIdentifier(expression) && depth < MAX_RESOLVE_DEPTH) {
            const resolved = this.resolvedInitializer(sf, expression.text, what)
            return (
                constStringArrayValues(resolved.decl) ??
                this.stringArray(
                    resolved.sf,
                    resolved.expression,
                    what,
                    depth + 1
                )
            )
        }
        return this.fail(
            what,
            "is not an array of string literals: " + sourceText(sf, node)
        )
    }

    /**
     * The properties of an object literal, by name. A spread, a computed
     * key, a shorthand or a method fails: none of them can be read.
     */
    properties(
        sf: SourceFile,
        node: Expression,
        what: string
    ): Map<string, Expression> {
        const expression = unwrap(node)
        if (!isObjectLiteralExpression(expression))
            this.fail(what, "is not an object literal: " + sourceText(sf, node))
        return this.objectProperties(sf, expression, what)
    }

    private objectProperties(
        sf: SourceFile,
        object: ObjectLiteralExpression,
        what: string
    ): Map<string, Expression> {
        const properties = new Map<string, Expression>()
        for (const property of object.properties) {
            const name =
                isPropertyAssignment(property) &&
                (isIdentifier(property.name) || isStringLiteral(property.name))
                    ? property.name.text
                    : undefined
            if (!isPropertyAssignment(property) || name === undefined)
                this.fail(
                    what,
                    "has an entry that is not a plain `key: value` " +
                        "property: " +
                        sf.text
                            .slice(property.pos, property.end)
                            .trim()
                            .split("\n")[0]
                )
            properties.set(name, property.initializer)
        }
        return properties
    }
}

/** The initializer of `export const <name> = …` in the entry file */
function exportedConst(sf: SourceFile, name: string, file: string): Expression {
    for (const statement of sf.statements) {
        if (!isVariableStatement(statement)) continue
        if (!statement.modifiers?.some((modifier) => isExportKeyword(modifier)))
            continue
        for (const decl of statement.declarationList.declarations)
            if (
                isIdentifier(decl.name) &&
                decl.name.text === name &&
                decl.initializer
            )
                return decl.initializer
    }
    throw new Error(rel(file) + ": has no `export const " + name + " = …`")
}

function readVariants(
    reader: ValueReader,
    sf: SourceFile,
    file: string
): DeclaredVariant[] {
    const expression = unwrap(exportedConst(sf, "VARIANTS", file))
    if (!isArrayLiteralExpression(expression))
        throw new Error(
            rel(file) +
                ": VARIANTS is not an array literal: " +
                sourceText(sf, expression)
        )
    if (expression.elements.length === 0)
        throw new Error(rel(file) + ": VARIANTS is empty")
    return expression.elements.map((element, index) => {
        const what = "VARIANTS[" + index + "]"
        const properties = reader.properties(sf, element, what)
        const nameNode = properties.get("name")
        if (!nameNode) throw new Error(rel(file) + ": " + what + " has no name")
        const name = reader.string(sf, nameNode, what + ".name")
        const at = 'variant "' + name + '"'
        const description = properties.get("description")
        const defaultSize = properties.get("defaultSize")
        // `component` is code, not documentation, and is never read, nor is
        // `demoConfig`: the reference's default block has no config.
        return {
            name,
            ...(description && {
                description: reader.string(
                    sf,
                    description,
                    at + " description"
                ),
            }),
            ...(defaultSize && {
                // A valid size is the bespoke typecheck's job (`satisfies`)
                defaultSize: reader.string(
                    sf,
                    defaultSize,
                    at + " defaultSize"
                ) as BundleVariantSize,
            }),
        }
    })
}

function readConfigSpec(
    reader: ValueReader,
    sf: SourceFile,
    file: string
): DeclaredConfigField[] {
    const spec = reader.properties(
        sf,
        exportedConst(sf, "CONFIG_SPEC", file),
        "CONFIG_SPEC"
    )
    return [...spec].map(([name, value]) => {
        const what = "CONFIG_SPEC." + name
        const properties = reader.properties(sf, value, what)
        const read = (key: string): string | undefined => {
            const node = properties.get(key)
            return node && reader.string(sf, node, what + "." + key)
        }
        const values = properties.get("values")
        // `parse` is code, not documentation, and is never read. A valid
        // type is the bespoke typecheck's job (`satisfies`).
        const field: DeclaredConfigField = {
            name,
            type: (read("type") ?? "") as BundleConfigFieldType,
        }
        if (values)
            field.values = reader.stringArray(sf, values, what + ".values")
        const format = read("format")
        if (format !== undefined) field.format = format
        const description = read("description")
        if (description !== undefined) field.description = description
        const fieldDefault = read("default")
        if (fieldDefault !== undefined) field.default = fieldDefault
        return field
    })
}

/**
 * The bespoke viz registry: one entry per registered bundle, in registry
 * order. Throws, naming the file, on the first bundle it cannot document.
 */
export function extractBespokeVizReferences(
    bundleIds: string[]
): BespokeVizRegistry {
    const bundles = bundleIds.map(bundlePaths)
    const api = new API({ cwd: REPO_ROOT })
    try {
        const snapshot = api.updateSnapshot({
            openProjects: bundles.map((bundle) => bundle.tsconfig),
        })
        return {
            bundles: bundles.map((bundle) => {
                const project = snapshot.getProject(bundle.tsconfig)
                if (!project)
                    throw new Error(
                        "tsgo could not load project at " + rel(bundle.tsconfig)
                    )
                const program: TsProgram = project.program
                const sf = program.getSourceFile(bundle.entryFile)
                if (!sf)
                    throw new Error(
                        rel(bundle.entryFile) +
                            ": not loaded by tsgo from " +
                            rel(bundle.tsconfig)
                    )
                const reader = new ValueReader(program, bundle.entryFile)
                return buildBundleReference({
                    id: bundle.id,
                    entryFile: rel(bundle.entryFile),
                    variants: readVariants(reader, sf, bundle.entryFile),
                    config: readConfigSpec(reader, sf, bundle.entryFile),
                    ...(fs.existsSync(bundle.docsFile) && {
                        docs: {
                            file: rel(bundle.docsFile),
                            text: fs.readFileSync(bundle.docsFile, "utf-8"),
                        },
                    }),
                })
            }),
        }
    } finally {
        api.close()
    }
}
