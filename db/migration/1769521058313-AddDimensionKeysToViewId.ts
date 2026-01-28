import { MigrationInterface, QueryRunner } from "typeorm"

type ExplorerViewRow = { id: number; dimensions: string }
type MultiDimConfigRow = { id: number; config: string }

// Inline slugify logic to avoid external dependencies in migrations.
function slugify(str: string): string {
    const normalizedStr = str.replace(/[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (match) => {
        const subscriptMap: Record<string, string> = {
            "₀": "0",
            "₁": "1",
            "₂": "2",
            "₃": "3",
            "₄": "4",
            "₅": "5",
            "₆": "6",
            "₇": "7",
            "₈": "8",
            "₉": "9",
        }
        const superscriptMap: Record<string, string> = {
            "⁰": "0",
            "¹": "1",
            "²": "2",
            "³": "3",
            "⁴": "4",
            "⁵": "5",
            "⁶": "6",
            "⁷": "7",
            "⁸": "8",
            "⁹": "9",
        }
        return subscriptMap[match] || superscriptMap[match] || match
    })

    return normalizedStr
        .toLowerCase()
        .trim()
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w\- /]+/g, "")
        .replace(/ +/g, "-")
        .replace(/\//g, "")
}

function escapeSqlString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "''")
}

// Old format: values only (keys ignored).
function dimensionsToLegacyViewId(dimensions: Record<string, string>): string {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => slugify(value))
        .join("__")
        .toLowerCase()
}

// New canonical format: key=value pairs.
function dimensionsToCanonicalViewId(
    dimensions: Record<string, string>
): string {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${slugify(key)}=${slugify(value)}`)
        .join("__")
        .toLowerCase()
}

async function backfillExplorerViewIds(
    queryRunner: QueryRunner,
    toViewId: (dimensions: Record<string, string>) => string
): Promise<void> {
    await queryRunner.query(`-- sql
        ALTER TABLE explorer_views
        MODIFY COLUMN viewId VARCHAR(512) NOT NULL
    `)

    const rows: ExplorerViewRow[] = await queryRunner.query(`-- sql
        SELECT id, dimensions FROM explorer_views
    `)

    if (rows.length === 0) return

    await queryRunner.query(`-- sql
        CREATE TEMPORARY TABLE temp_explorer_view_ids (
            id INT PRIMARY KEY,
            viewId VARCHAR(512) NOT NULL
        )
    `)

    const CHUNK_SIZE = 200
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        const values = chunk
            .map((row) => {
                const dimensions = JSON.parse(row.dimensions) as Record<
                    string,
                    string
                >
                const viewId = escapeSqlString(toViewId(dimensions))
                return `(${row.id}, '${viewId}')`
            })
            .join(", ")

        await queryRunner.query(`-- sql
            INSERT INTO temp_explorer_view_ids (id, viewId)
            VALUES ${values}
        `)
    }

    await queryRunner.query(`-- sql
        UPDATE explorer_views ev
        JOIN temp_explorer_view_ids tmp ON ev.id = tmp.id
        SET ev.viewId = tmp.viewId
    `)

    await queryRunner.query(`-- sql
        DROP TEMPORARY TABLE temp_explorer_view_ids
    `)
}

async function backfillMultiDimViewIds(
    queryRunner: QueryRunner,
    direction: "to-canonical" | "to-legacy"
): Promise<void> {
    await queryRunner.query(`-- sql
        ALTER TABLE multi_dim_x_chart_configs
        MODIFY COLUMN viewId VARCHAR(512) NOT NULL
    `)

    const rows: MultiDimConfigRow[] = await queryRunner.query(`-- sql
        SELECT id, config FROM multi_dim_data_pages
    `)

    const mappings: Array<{
        multiDimId: number
        oldViewId: string
        newViewId: string
    }> = []

    for (const row of rows) {
        const config = JSON.parse(row.config) as {
            views?: Array<{ dimensions?: Record<string, string> }>
        }
        if (!config.views?.length) continue

        for (const view of config.views) {
            if (!view.dimensions) continue
            const legacyViewId = dimensionsToLegacyViewId(view.dimensions)
            const canonicalViewId = dimensionsToCanonicalViewId(view.dimensions)
            const oldViewId =
                direction === "to-canonical" ? legacyViewId : canonicalViewId
            const newViewId =
                direction === "to-canonical" ? canonicalViewId : legacyViewId
            mappings.push({
                multiDimId: row.id,
                oldViewId,
                newViewId,
            })
        }
    }

    if (mappings.length > 0) {
        await queryRunner.query(`-- sql
            CREATE TEMPORARY TABLE temp_multi_dim_view_ids (
                multiDimId INT UNSIGNED NOT NULL,
                oldViewId VARCHAR(512) NOT NULL,
                newViewId VARCHAR(512) NOT NULL,
                PRIMARY KEY (multiDimId, oldViewId)
            )
        `)

        const CHUNK_SIZE = 200
        for (let i = 0; i < mappings.length; i += CHUNK_SIZE) {
            const chunk = mappings.slice(i, i + CHUNK_SIZE)
            const values = chunk
                .map(({ multiDimId, oldViewId, newViewId }) => {
                    const escapedOld = escapeSqlString(oldViewId)
                    const escapedNew = escapeSqlString(newViewId)
                    return `(${multiDimId}, '${escapedOld}', '${escapedNew}')`
                })
                .join(", ")

            await queryRunner.query(`-- sql
                INSERT INTO temp_multi_dim_view_ids (multiDimId, oldViewId, newViewId)
                VALUES ${values}
            `)
        }

        await queryRunner.query(`-- sql
            UPDATE multi_dim_x_chart_configs mdxcc
            JOIN temp_multi_dim_view_ids tmp
              ON mdxcc.multiDimId = tmp.multiDimId
             AND (mdxcc.viewId = tmp.oldViewId OR mdxcc.viewId = tmp.newViewId)
            SET mdxcc.viewId = tmp.newViewId
        `)

        await queryRunner.query(`-- sql
            DROP TEMPORARY TABLE temp_multi_dim_view_ids
        `)
    }
}

export class AddDimensionKeysToViewId1769521058313
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await backfillExplorerViewIds(queryRunner, dimensionsToCanonicalViewId)
        await backfillMultiDimViewIds(queryRunner, "to-canonical")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await backfillExplorerViewIds(queryRunner, dimensionsToLegacyViewId)
        await backfillMultiDimViewIds(queryRunner, "to-legacy")

        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            MODIFY COLUMN viewId VARCHAR(255) NOT NULL
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_x_chart_configs
            MODIFY COLUMN viewId VARCHAR(255) NOT NULL
        `)
    }
}
