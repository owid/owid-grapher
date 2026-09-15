import * as _ from "lodash-es"
import { SourceLine } from "../types.js"
import { BlockEditPlan } from "./planDoc.js"

/**
 * Predicts the ArchieML lines the document should contain after the planned
 * edits are applied. Entries are exact expected strings, or null for lines
 * whose exact styling round-trip we don't predict (replaced/inserted values)
 * — those are covered semantically by the re-plan no-op check instead.
 *
 * Comparing the re-fetched doc against this catches collateral damage: an
 * index-math bug that mangled a neighboring line shows up as a mismatch even
 * when the target blocks themselves ended up correct.
 */
export function buildExpectedLines(
    lines: SourceLine[],
    blockEdits: BlockEditPlan[]
): Array<string | null> {
    const expected: Array<string | null> = lines.map((line) => line.text)
    const deleted = new Set<number>()
    const insertsBefore = new Map<number, number>()

    for (const { match, edits } of blockEdits) {
        for (const edit of edits) {
            switch (edit.kind) {
                case "rename-key": {
                    const property = match.properties.find(
                        (p) => p.key === edit.oldKey
                    )
                    if (!property) break
                    expected[property.lineIndex] = renameKeyInText(
                        lines[property.lineIndex].text,
                        edit.oldKey,
                        edit.newKey
                    )
                    break
                }
                case "rename-block-type":
                    expected[match.openLineIndex] = renameBlockTypeInText(
                        lines[match.openLineIndex].text,
                        edit.oldType,
                        edit.newType
                    )
                    break
                case "set-value": {
                    const property = match.properties.find(
                        (p) => p.key === edit.key
                    )
                    if (property) expected[property.lineIndex] = null
                    break
                }
                case "delete-property": {
                    const property = match.properties.find(
                        (p) => p.key === edit.key
                    )
                    if (!property) break
                    for (
                        let i = property.lineIndex;
                        i <= property.extentEndLineIndex;
                        i++
                    ) {
                        deleted.add(i)
                    }
                    break
                }
                case "insert-property":
                    insertsBefore.set(
                        match.closeLineIndex,
                        (insertsBefore.get(match.closeLineIndex) ?? 0) + 1
                    )
                    break
                case "delete-block":
                    for (
                        let i = match.openLineIndex;
                        i <= match.closeLineIndex;
                        i++
                    ) {
                        deleted.add(i)
                    }
                    break
            }
        }
    }

    const result: Array<string | null> = []
    for (let i = 0; i < expected.length; i++) {
        const inserts = insertsBefore.get(i) ?? 0
        for (let n = 0; n < inserts; n++) result.push(null)
        if (!deleted.has(i)) result.push(expected[i])
    }
    return result
}

/** Compares re-fetched lines against expectations; returns mismatch descriptions */
export function compareToExpectedLines(
    expected: Array<string | null>,
    actualLines: SourceLine[]
): string[] {
    const mismatches: string[] = []
    if (expected.length !== actualLines.length) {
        mismatches.push(
            `expected ${expected.length} lines but the document has ${actualLines.length}`
        )
        return mismatches
    }
    for (let i = 0; i < expected.length; i++) {
        const expectedText = expected[i]
        if (expectedText === null) continue
        if (actualLines[i].text !== expectedText) {
            mismatches.push(
                `line ${i}: expected "${expectedText}" but found "${actualLines[i].text}"`
            )
        }
    }
    return mismatches
}

function renameKeyInText(
    text: string,
    oldKey: string,
    newKey: string
): string | null {
    const pattern = new RegExp(`^(\\s*)${_.escapeRegExp(oldKey)}(\\s*:)`)
    if (!pattern.test(text)) return null // can't predict — fall back to wildcard
    return text.replace(pattern, `$1${newKey}$2`)
}

function renameBlockTypeInText(
    text: string,
    oldType: string,
    newType: string
): string | null {
    const pattern = new RegExp(
        `^(\\s*\\{[.+]+)${_.escapeRegExp(oldType)}(\\}\\s*)$`
    )
    if (!pattern.test(text)) return null
    return text.replace(pattern, `$1${newType}$2`)
}
