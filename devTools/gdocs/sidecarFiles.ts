/*
 * Helpers for reading sidecar files, shared by the reference pipelines.
 *
 * They live here rather than in generate-gdocs-references.ts because that
 * script runs main() on import, so nothing can import from it.
 */

import * as yaml from "yaml"

import type { VariableDeclaration } from "typescript/unstable/ast"
import {
    isArrayLiteralExpression,
    isAsExpression,
    isStringLiteral,
} from "typescript/unstable/ast/is"

import { assertWellFormedFences } from "./sidecarExamples.js"

// Trailing newline: without it, any tool that adds one (an editor, a hook)
// makes the committed file differ from what the generator writes, and the
// staleness check fails on a file nobody meaningfully changed.
export function toJsonFile(value: unknown): string {
    return JSON.stringify(value, null, 2) + "\n"
}

// The values of a 'const xs = ["a", "b"] as const' declaration; undefined for
// any other shape of variable declaration.
export function constStringArrayValues(
    decl: VariableDeclaration
): string[] | undefined {
    const initializer = decl.initializer
    if (!initializer || !isAsExpression(initializer)) return undefined
    const expression = initializer.expression
    if (!isArrayLiteralExpression(expression)) return undefined
    const values: string[] = []
    for (const element of expression.elements) {
        if (!isStringLiteral(element)) return undefined
        values.push(element.text)
    }
    return values
}

export function parseSidecar(
    text: string,
    sidecarPathRel: string
): { frontMatter: Record<string, unknown>; body: string } {
    let rest = text
    let frontMatter: Record<string, unknown> = {}
    const fmMatch = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/.exec(rest)
    if (fmMatch) {
        let parsed: unknown
        try {
            parsed = yaml.parse(fmMatch[1])
        } catch (err) {
            throw new Error(
                sidecarPathRel +
                    " has invalid YAML front matter: " +
                    (err instanceof Error ? err.message : String(err)),
                { cause: err }
            )
        }
        if (parsed === null || parsed === undefined) parsed = {}
        if (typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error(
                sidecarPathRel + " front matter is not a YAML mapping"
            )
        frontMatter = parsed as Record<string, unknown>
        rest = rest.slice(fmMatch[0].length)
    }
    const body = rest.trim()
    assertWellFormedFences(body, sidecarPathRel)
    return { frontMatter, body }
}

export function inspect(value: unknown): string {
    return JSON.stringify(value) ?? String(value)
}

export function assertAllowedKeys(
    fm: Record<string, unknown>,
    allowed: string[],
    file: string
): void {
    for (const key of Object.keys(fm)) {
        if (!allowed.includes(key))
            throw new Error(
                file +
                    ' has unknown front-matter key "' +
                    key +
                    '" — allowed: ' +
                    allowed.join(", ")
            )
    }
}

export function parseOptionalTitle(
    fm: Record<string, unknown>,
    file: string
): string | undefined {
    if (fm.title === undefined) return undefined
    if (typeof fm.title !== "string" || fm.title.trim().length === 0)
        throw new Error(file + ": title must be a non-empty string")
    return fm.title.trim()
}
