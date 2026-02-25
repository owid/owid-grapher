import { MigrationInterface, QueryRunner } from "typeorm"

// Inline the slugify logic to avoid external dependencies in migrations
function slugify(str: string): string {
    // Convert subscript and superscript numbers to regular numbers
    const normalizedStr = str.replace(/[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (match) => {
        const subscriptMap: { [key: string]: string } = {
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
        const superscriptMap: { [key: string]: string } = {
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

// Inline the dimensionsToViewId logic
function dimensionsToViewId(
    dimensions: Record<string, string> // Keys: dimension slugs, values: choice slugs
): string {
    return Object.entries(dimensions)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([_, value]) => slugify(value))
        .join("__")
        .toLowerCase()
}

export class AddViewIdToExplorerViews1764317847438 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add viewId column as nullable
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            ADD COLUMN viewId VARCHAR(255) NULL
        `)

        // Fetch all existing rows
        const rows = await queryRunner.query(`-- sql
            SELECT id, dimensions FROM explorer_views
        `)

        // Update the explorer_views table in batches
        if (rows.length > 0) {
            // Create temporary table
            await queryRunner.query(`-- sql
                CREATE TEMPORARY TABLE temp_explorer_view_ids (
                    id INT PRIMARY KEY,
                    viewId VARCHAR(255) NOT NULL
                )
            `)

            // Compute viewIds and insert in batches
            const CHUNK_SIZE = 200
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE)

                // Build VALUES clause for batch insert
                const values = chunk
                    .map((row: any) => {
                        const dimensions = JSON.parse(row.dimensions)
                        const viewId = dimensionsToViewId(dimensions)
                        return `(${row.id}, '${viewId}')`
                    })
                    .join(", ")

                await queryRunner.query(`-- sql
                    INSERT INTO temp_explorer_view_ids (id, viewId)
                    VALUES ${values}
                `)
            }

            // Update explorer_views from temporary table with single query
            await queryRunner.query(`-- sql
                UPDATE explorer_views ev
                JOIN temp_explorer_view_ids tmp ON ev.id = tmp.id
                SET ev.viewId = tmp.viewId
            `)

            // Drop temporary table
            await queryRunner.query(`-- sql
                DROP TEMPORARY TABLE temp_explorer_view_ids
            `)
        }

        // Make column NOT NULL
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            MODIFY COLUMN viewId VARCHAR(255) NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            DROP COLUMN viewId
        `)
    }
}
