/**
 * Gdoc migration definitions. These live under db/ (rather than with the
 * engine in devTools/gdocMigrations/) so that deploy-time db/migration
 * wrappers can import them — the reverse import would create a project
 * reference cycle, since the engine depends on db code.
 */

/**
 * A raw ArchieML block as JSON. Deliberately loosely typed: migration files
 * are frozen once merged, but the OwidRawGdocBlock interfaces keep evolving —
 * a transform typed against them would break the repo's typecheck as soon as
 * a later cleanup PR deletes the deprecated property it references.
 */
export interface RawBlockJson {
    type: string
    value: Record<string, unknown>
}

/**
 * An enriched block as stored in posts_gdocs.content, equally loosely typed.
 * Unlike raw blocks, enriched blocks hold their properties directly (no
 * `value` wrapper), and text properties are span arrays rather than strings.
 */
export type EnrichedBlockJson = { type: string } & Record<string, unknown>

/**
 * Capabilities the engine injects into transforms. The CLI runner backs them
 * with the DB via knex; the deploy-time DB applier backs them with the
 * migration's queryRunner; tests pass stubs.
 */
export interface MigrationHelpers {
    /**
     * Resolves an ourworldindata.org URL to the docs.google.com URL of the
     * published gdoc behind it, following exact-match redirects. Returns
     * null for anything that doesn't cleanly resolve (grapher/explorer
     * pages, query strings, anchors, unknown or ambiguous slugs) — leave
     * such links unchanged.
     */
    resolveOwidUrlToGdocUrl: (url: string) => Promise<string | null>
}

export interface MigrationContext extends MigrationHelpers {
    gdocId: string
}

export type BlockTransformFn = (
    block: RawBlockJson,
    context: MigrationContext
) => RawBlockJson | null | Promise<RawBlockJson | null>

export type EnrichedTransformFn = (
    block: EnrichedBlockJson,
    context: MigrationContext
) => EnrichedBlockJson | null | Promise<EnrichedBlockJson | null>

export interface ComponentGdocMigration {
    name: string
    mode: "component"
    blockType: string
    /**
     * SQL returning a gdocId column, usually against posts_gdocs_components.
     * Only needs to be a superset: the engine re-verifies every match against
     * the freshly fetched doc.
     */
    discover: string
    /**
     * The gdoc-side transform, expressed against the raw ArchieML block.
     * Return the transformed block, the same block for no-op, or null to
     * delete it. Must be idempotent — the engine verifies a migrated doc by
     * asserting the transform has become a no-op on it.
     */
    transform: BlockTransformFn
    /**
     * The DB-side transform, expressed against the enriched block JSON in
     * posts_gdocs.content, applied at deploy time by a thin db/migration
     * wrapper via applyGdocMigrationToDb. This cannot be derived from
     * `transform`: by the time the migration runs, the enriched interfaces
     * have already been renamed, so the typed enriched→raw conversion would
     * silently drop the old-shape properties the transform needs to see.
     * Omit only for migrations that never need to touch stored content.
     */
    dbTransform?: EnrichedTransformFn
}

/**
 * A declarative frontmatter operation. Ops are declarative (rather than a
 * transform function) because the two sides hold different representations:
 * the doc has raw strings (`hide-citation: true`, keys with arbitrary
 * casing) while posts_gdocs.content holds parsed values (booleans, arrays).
 * Each op knows how to express itself on both.
 */
export type FrontmatterOp =
    | { kind: "rename-key"; from: string; to: string }
    | { kind: "remove-key"; key: string }
    | {
          kind: "set-value"
          key: string
          value: string | boolean | number
          /**
           * The parsed value written to posts_gdocs.content; defaults to
           * `value` with "true"/"false" coerced to booleans, mirroring the
           * frontmatter parser
           */
          dbValue?: unknown
      }
    | {
          kind: "map-value"
          key: string
          /**
           * Applied to the raw string value on the doc side and to the
           * parsed value on the DB side — fine for plain-string keys (like
           * `type`), where the two representations coincide; write the
           * function defensively for anything else. Must be idempotent.
           * Return null/undefined to remove the key.
           */
          map: (value: unknown) => unknown
      }

export interface FrontmatterGdocMigration {
    name: string
    mode: "frontmatter"
    /** SQL returning a gdocId column, usually against posts_gdocs.content */
    discover: string
    ops: FrontmatterOp[]
}

export type GdocMigration = ComponentGdocMigration | FrontmatterGdocMigration

/**
 * Structured top-level sections that the ArchieML serializer cannot
 * round-trip — migrations must not touch them.
 */
export const FORBIDDEN_FRONTMATTER_KEYS = ["refs", "faqs", "details"]

function frontmatterOpKeys(op: FrontmatterOp): string[] {
    return op.kind === "rename-key" ? [op.from, op.to] : [op.key]
}

export function defineGdocMigration<M extends GdocMigration>(migration: M): M {
    if (migration.mode === "frontmatter") {
        for (const op of migration.ops) {
            for (const key of frontmatterOpKeys(op)) {
                if (FORBIDDEN_FRONTMATTER_KEYS.includes(key.toLowerCase())) {
                    throw new Error(
                        `frontmatter migration "${migration.name}" touches "${key}" — ` +
                            `${FORBIDDEN_FRONTMATTER_KEYS.join("/")} cannot be round-tripped and are off limits`
                    )
                }
            }
        }
    }
    return migration
}
