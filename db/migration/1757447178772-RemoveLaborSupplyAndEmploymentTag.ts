import { MigrationInterface, QueryRunner } from "typeorm"

// Migrate all FKs that point to "Labor Supply & Employment" to point to
// "Labor Force Participation & Employment", then delete the old tag.
export class RemoveLaborSupplyAndEmploymentTag1757447178772
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const [oldId, newId] = await queryRunner
            .query(
                `-- sql
                SELECT 
                (SELECT id FROM tags WHERE name = 'Labor Supply & Employment') as oldId,
                (SELECT id FROM tags WHERE name = 'Labor Force Participation & Employment') as newId`
            )
            .then((rows) => [rows[0]?.oldId, rows[0]?.newId])

        if (!oldId || !newId) {
            console.error("One or both tag IDs not found, abort")
            return
        }

        const tablesToUpdate = [
            {
                tableName: "chart_tags",
                fkColumn: "tagId",
                constraints: ["tagId", "chartId"],
            },
            {
                tableName: "dataset_tags",
                fkColumn: "tagId",
                constraints: ["tagId", "datasetId"],
            },
            {
                tableName: "explorer_tags",
                fkColumn: "tagId",
                constraints: ["tagId", "explorerSlug"],
            },
            {
                tableName: "featured_metrics",
                fkColumn: "parentTagId",
                constraints: ["parentTagId", "url", "incomeGroup"],
            },
            {
                tableName: "post_tags",
                fkColumn: "tag_id",
                constraints: ["tag_id", "post_id"],
            },
            {
                tableName: "posts_gdocs_x_tags",
                fkColumn: "tagId",
                constraints: ["tagId", "gdocId"],
            },
            {
                tableName: "tag_graph",
                fkColumn: "childId",
                constraints: ["childId", "parentId"],
            },
            {
                tableName: "tag_graph",
                fkColumn: "parentId",
                constraints: ["childId", "parentId"],
            },
            {
                tableName: "tags",
                fkColumn: "parentId",
                constraints: ["parentId", "name"],
            },
            {
                tableName: "tags_variables_topic_tags",
                fkColumn: "tagId",
                constraints: ["tagId", "variableId"],
            },
        ]

        for (const { tableName, fkColumn, constraints } of tablesToUpdate) {
            // Build the join conditions for all constraint columns except the one we're updating
            const otherConstraintColumns = constraints.filter(
                (col) => col !== fkColumn
            )
            const joinConditions = otherConstraintColumns
                .map((col) => `t1.${col} = t2.${col}`)
                .join(" AND ")

            if (joinConditions) {
                // Delete rows with oldId that would conflict with existing newId rows
                const deleteQuery = `-- sql
                    DELETE t1 FROM ${tableName} t1
                    INNER JOIN ${tableName} t2 
                    ON ${joinConditions}
                    WHERE t1.${fkColumn} = ? 
                    AND t2.${fkColumn} = ?
                `

                const result = await queryRunner.query(deleteQuery, [
                    oldId,
                    newId,
                ])

                if (result.affectedRows > 0) {
                    console.log(
                        `Removed ${result.affectedRows} duplicate rows from ${tableName}`
                    )
                }
            }

            // Now update all remaining rows with oldId to newId
            const updateQuery = `-- sql
                UPDATE ${tableName} 
                SET ${fkColumn} = ? 
                WHERE ${fkColumn} = ?
            `

            const updateResult = await queryRunner.query(updateQuery, [
                newId,
                oldId,
            ])

            if (updateResult.affectedRows > 0) {
                console.log(
                    `Updated ${updateResult.affectedRows} rows in ${tableName}`
                )
            }
        }

        // Delete the old tag
        await queryRunner.query(`DELETE FROM tags WHERE id = ?`, [oldId])
        console.log(`Deleted tag with id ${oldId}`)
    }

    public async down(_: QueryRunner): Promise<void> {
        // Irreversible migration
    }
}
