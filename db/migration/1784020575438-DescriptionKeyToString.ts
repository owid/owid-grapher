import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * descriptionKey changes from an array of bullet points to a single free-form
 * markdown string. Convert existing rows in `variables` and multi-dim configs.
 *
 * The conversion preserves the legacy rendering exactly: a single entry was
 * rendered as prose, multiple entries as a bulleted list (now expressed as a
 * markdown list).
 *
 * Inlined copy of normalizeDescriptionKey from @ourworldindata/types —
 * migrations must stay frozen in time, so we don't import live code.
 */
function descriptionKeyArrayToString(items: string[]): string | null {
    const cleaned = items.map((item) => item.trim()).filter((item) => item)
    if (cleaned.length === 0) return null
    if (cleaned.length === 1) return cleaned[0]
    // Indent continuation lines so multi-line items stay inside their bullet.
    return cleaned
        .map((item) => `- ${item.replaceAll("\n", "\n  ")}`)
        .join("\n")
}

interface MultiDimMetadata {
    descriptionKey?: string | string[]
}

interface MultiDimConfig {
    metadata?: MultiDimMetadata
    views?: { metadata?: MultiDimMetadata }[]
}

// Returns true if the metadata object was modified.
function convertMetadata(metadata: MultiDimMetadata | undefined): boolean {
    if (!metadata || !Array.isArray(metadata.descriptionKey)) return false
    const converted = descriptionKeyArrayToString(metadata.descriptionKey)
    if (converted === null) delete metadata.descriptionKey
    else metadata.descriptionKey = converted
    return true
}

export class DescriptionKeyToString1784020575438 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const variables: { id: number; descriptionKey: string }[] =
            await queryRunner.query(
                `-- sql
                SELECT id, descriptionKey
                FROM variables
                WHERE descriptionKey IS NOT NULL
                    AND JSON_TYPE(descriptionKey) = 'ARRAY'`
            )
        for (const row of variables) {
            const converted = descriptionKeyArrayToString(
                JSON.parse(row.descriptionKey)
            )
            await queryRunner.query(
                `UPDATE variables SET descriptionKey = ? WHERE id = ?`,
                [converted === null ? null : JSON.stringify(converted), row.id]
            )
        }

        const multiDims: { id: number; config: string }[] =
            await queryRunner.query(
                `SELECT id, config FROM multi_dim_data_pages`
            )
        for (const row of multiDims) {
            const config: MultiDimConfig = JSON.parse(row.config)
            let modified = convertMetadata(config.metadata)
            for (const view of config.views ?? []) {
                modified = convertMetadata(view.metadata) || modified
            }
            if (modified) {
                await queryRunner.query(
                    `UPDATE multi_dim_data_pages SET config = ? WHERE id = ?`,
                    [JSON.stringify(config), row.id]
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The array -> string conversion is not reversible item-by-item, but
        // wrapping the string into a one-element array renders identically
        // with the pre-migration code (a single entry was rendered as
        // free-form markdown).
        await queryRunner.query(
            `-- sql
            UPDATE variables
            SET descriptionKey = JSON_ARRAY(descriptionKey)
            WHERE descriptionKey IS NOT NULL
                AND JSON_TYPE(descriptionKey) = 'STRING'`
        )

        const multiDims: { id: number; config: string }[] =
            await queryRunner.query(
                `SELECT id, config FROM multi_dim_data_pages`
            )
        for (const row of multiDims) {
            const config: MultiDimConfig = JSON.parse(row.config)
            let modified = false
            const metadatas = [
                config.metadata,
                ...(config.views ?? []).map((view) => view.metadata),
            ]
            for (const metadata of metadatas) {
                if (metadata && typeof metadata.descriptionKey === "string") {
                    metadata.descriptionKey = [metadata.descriptionKey]
                    modified = true
                }
            }
            if (modified) {
                await queryRunner.query(
                    `UPDATE multi_dim_data_pages SET config = ? WHERE id = ?`,
                    [JSON.stringify(config), row.id]
                )
            }
        }
    }
}
