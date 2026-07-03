import * as _ from "lodash-es"
import { renameObjectKey } from "./helpers.js"
import {
    ComponentGdocMigration,
    EnrichedBlockJson,
    FrontmatterGdocMigration,
    FrontmatterOp,
    GdocMigration,
    MigrationContext,
} from "./types.js"

/**
 * Structural subset of TypeORM's QueryRunner (and of anything else that can
 * run parameterized SQL), so this module needs no typeorm import and tests
 * can fake it.
 */
export interface ContentQueryRunner {
    query(sql: string, parameters?: unknown[]): Promise<unknown>
}

export interface DbApplyResult {
    scanned: number
    updated: number
}

/**
 * Applies a gdoc migration's dbTransform to every posts_gdocs.content row,
 * for use from a thin deploy-time db/migration wrapper:
 *
 *   export class GdocMigrationFoo1751000000000 implements MigrationInterface {
 *       public async up(queryRunner: QueryRunner): Promise<void> {
 *           await applyGdocMigrationToDb(queryRunner, fooMigration)
 *       }
 *       public async down(): Promise<void> {} // content migrations are not reversible
 *   }
 *
 * Walks the enriched content JSON recursively (matching the historical
 * content-migration pattern) rather than going through the typed
 * enriched↔raw conversion, which by deploy time no longer understands the
 * old-shape content this migration exists to rewrite.
 *
 * Derived state (markdown, posts_gdocs_components, posts_gdocs_links) is NOT
 * regenerated here — run `yarn regenerateGdocMarkdown` and
 * `yarn reconstructPostsGdocsComponents` after deploying.
 */
export async function applyGdocMigrationToDb(
    queryRunner: ContentQueryRunner,
    migration: GdocMigration
): Promise<DbApplyResult> {
    if (migration.mode === "frontmatter") {
        return applyFrontmatterMigrationToDb(queryRunner, migration)
    }
    return applyComponentMigrationToDb(queryRunner, migration)
}

async function fetchContentRows(
    queryRunner: ContentQueryRunner
): Promise<Array<{ id: string; content: string }>> {
    return (await queryRunner.query(
        "SELECT id, content FROM posts_gdocs WHERE content IS NOT NULL"
    )) as Array<{ id: string; content: string }>
}

async function applyComponentMigrationToDb(
    queryRunner: ContentQueryRunner,
    migration: ComponentGdocMigration
): Promise<DbApplyResult> {
    const dbTransform = migration.dbTransform
    if (!dbTransform) {
        throw new Error(
            `migration "${migration.name}" has no dbTransform — nothing to apply to posts_gdocs.content`
        )
    }

    const rows = await fetchContentRows(queryRunner)

    let updated = 0
    for (const row of rows) {
        const content = JSON.parse(row.content) as unknown
        const context: MigrationContext = { gdocId: row.id }
        const result = await transformNode(
            content,
            migration,
            dbTransform,
            context
        )
        if (!result.changed) continue
        await queryRunner.query(
            "UPDATE posts_gdocs SET content = ? WHERE id = ?",
            [JSON.stringify(result.node), row.id]
        )
        updated++
    }

    console.log(
        `gdoc migration "${migration.name}": scanned ${rows.length} posts_gdocs rows, updated ${updated}`
    )
    return { scanned: rows.length, updated }
}

/**
 * Frontmatter fields mirrored into real posts_gdocs columns. When an op
 * changes one of these, the column is re-derived alongside content (the way
 * upsertGdoc does on save) so it doesn't silently desync.
 */
const DENORMALIZED_FRONTMATTER_KEYS = ["type", "slug", "authors"]

async function applyFrontmatterMigrationToDb(
    queryRunner: ContentQueryRunner,
    migration: FrontmatterGdocMigration
): Promise<DbApplyResult> {
    const rows = await fetchContentRows(queryRunner)

    let updated = 0
    for (const row of rows) {
        const parsed = JSON.parse(row.content) as unknown
        if (!_.isPlainObject(parsed)) continue
        const { content, changedKeys } = applyFrontmatterOpsToContent(
            parsed as Record<string, unknown>,
            migration.ops
        )
        if (changedKeys.length === 0) continue

        const sets = ["content = ?"]
        const parameters: unknown[] = [JSON.stringify(content)]
        for (const key of DENORMALIZED_FRONTMATTER_KEYS) {
            if (!changedKeys.includes(key)) continue
            const value = content[key]
            if (value === undefined) {
                console.warn(
                    `gdoc migration "${migration.name}": "${key}" removed from content of ${row.id}; leaving the ${key} column untouched`
                )
                continue
            }
            sets.push(`\`${key}\` = ?`)
            parameters.push(key === "authors" ? JSON.stringify(value) : value)
        }

        await queryRunner.query(
            `UPDATE posts_gdocs SET ${sets.join(", ")} WHERE id = ?`,
            [...parameters, row.id]
        )
        updated++
    }

    console.log(
        `gdoc migration "${migration.name}": scanned ${rows.length} posts_gdocs rows, updated ${updated}`
    )
    return { scanned: rows.length, updated }
}

/** Mirrors the frontmatter parser's boolean coercion for stored values */
function coerceDbScalar(value: string | boolean | number): unknown {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return String(value)
    if (value === "true") return true
    if (value === "false") return false
    return value
}

function findKeyCaseInsensitive(
    object: Record<string, unknown>,
    key: string
): string | undefined {
    const lower = key.toLowerCase()
    return Object.keys(object).find((k) => k.toLowerCase() === lower)
}

/**
 * Applies frontmatter ops to a parsed posts_gdocs.content object. Exported
 * for tests; pure.
 */
export function applyFrontmatterOpsToContent(
    original: Record<string, unknown>,
    ops: FrontmatterOp[]
): { content: Record<string, unknown>; changedKeys: string[] } {
    let content = original
    const changedKeys = new Set<string>()

    for (const op of ops) {
        switch (op.kind) {
            case "rename-key": {
                const actual = findKeyCaseInsensitive(content, op.from)
                if (actual === undefined || actual === op.to) break
                content = renameObjectKey(content, actual, op.to)
                changedKeys.add(actual.toLowerCase())
                changedKeys.add(op.to.toLowerCase())
                break
            }
            case "remove-key": {
                const actual = findKeyCaseInsensitive(content, op.key)
                if (actual === undefined) break
                content = { ...content }
                delete content[actual]
                changedKeys.add(actual.toLowerCase())
                break
            }
            case "set-value": {
                const dbValue =
                    op.dbValue !== undefined
                        ? op.dbValue
                        : coerceDbScalar(op.value)
                const actual = findKeyCaseInsensitive(content, op.key) ?? op.key
                if (_.isEqual(content[actual], dbValue)) break
                content = { ...content, [actual]: dbValue }
                changedKeys.add(actual.toLowerCase())
                break
            }
            case "map-value": {
                const actual = findKeyCaseInsensitive(content, op.key)
                if (actual === undefined) break
                const mapped = op.map(content[actual])
                if (mapped === null || mapped === undefined) {
                    content = { ...content }
                    delete content[actual]
                    changedKeys.add(actual.toLowerCase())
                } else if (!_.isEqual(mapped, content[actual])) {
                    content = { ...content, [actual]: mapped }
                    changedKeys.add(actual.toLowerCase())
                }
                break
            }
        }
    }

    return { content, changedKeys: [...changedKeys] }
}

function isMatchingBlock(
    node: unknown,
    blockType: string
): node is EnrichedBlockJson {
    return (
        _.isPlainObject(node) &&
        (node as Record<string, unknown>).type === blockType
    )
}

interface TransformResult {
    node: unknown
    changed: boolean
    /** The node should be removed from its parent (only honored in arrays) */
    remove: boolean
}

async function transformNode(
    node: unknown,
    migration: ComponentGdocMigration,
    dbTransform: NonNullable<ComponentGdocMigration["dbTransform"]>,
    context: MigrationContext
): Promise<TransformResult> {
    // Transform matching blocks first, then recurse into the (possibly
    // transformed) block's children so nested matches are handled too
    let current = node
    let changed = false

    if (isMatchingBlock(current, migration.blockType)) {
        const transformed = await dbTransform(structuredClone(current), context)
        if (transformed === null)
            return { node: null, changed: true, remove: true }
        if (!_.isEqual(transformed, current)) {
            current = transformed
            changed = true
        }
    }

    if (Array.isArray(current)) {
        const items: unknown[] = []
        for (const item of current) {
            const result = await transformNode(
                item,
                migration,
                dbTransform,
                context
            )
            changed = changed || result.changed
            if (!result.remove) items.push(result.node)
        }
        return { node: changed ? items : current, changed, remove: false }
    }

    if (_.isPlainObject(current)) {
        const object = current as Record<string, unknown>
        let objectChanged = false
        const entries: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(object)) {
            const result = await transformNode(
                value,
                migration,
                dbTransform,
                context
            )
            // Removal is only meaningful inside arrays; a block sitting
            // directly on an object field stays (setting the field to null
            // would lose its meaning) — exceedingly rare, so keep the field
            // as-is and log.
            if (result.remove) {
                console.warn(
                    `gdoc migration "${migration.name}": cannot remove block at object field "${key}" of ${context.gdocId}; leaving unchanged`
                )
                entries[key] = value
            } else {
                entries[key] = result.node
                objectChanged = objectChanged || result.changed
            }
        }
        return {
            node: changed || objectChanged ? entries : current,
            changed: changed || objectChanged,
            remove: false,
        }
    }

    return { node: current, changed, remove: false }
}
