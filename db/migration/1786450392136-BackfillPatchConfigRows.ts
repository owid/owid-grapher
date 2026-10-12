import { MigrationInterface, QueryRunner } from "typeorm"
import { v7 as uuidv7 } from "uuid"

// The three owners whose authored config layer moves into a chart_configs row
// of its own. `resolvedPointer` is the column naming the owner's merged config,
// whose `patch` column we are copying out.
const OWNERS = [
    {
        table: "charts",
        resolvedPointer: "configId",
        tmpTable: "tmpPatchConfigIdxChart",
    },
    {
        table: "multi_dim_x_chart_configs",
        resolvedPointer: "chartConfigId",
        tmpTable: "tmpPatchConfigIdxMultiDimView",
    },
    {
        table: "narrative_charts",
        resolvedPointer: "chartConfigId",
        tmpTable: "tmpPatchConfigIdxNarrativeChart",
    },
] as const

export class BackfillPatchConfigRows1786450392136 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, resolvedPointer, tmpTable } of OWNERS) {
            const owners: { id: number }[] = await queryRunner.query(`-- sql
                SELECT id FROM ${table}
            `)
            if (owners.length === 0) continue

            // Create a temporary table to hold the mapping of owner id → new
            // patch config id. The new ids are UUIDv7, which is not available
            // in MySQL, so we mint them here
            await queryRunner.query(`-- sql
                CREATE TABLE ${tmpTable} (
                    uuid char(36) NOT NULL PRIMARY KEY,
                    ownerId INT NOT NULL
                )
            `)
            await queryRunner.query(
                `-- sql
                    INSERT INTO ${tmpTable} (uuid, ownerId) VALUES ?
                `,
                [owners.map((owner) => [uuidv7(), owner.id])]
            )

            // Copy each owner's authored config into a row of its own. The
            // timestamps come from the source row so chart-sync's comparisons
            // don't read these as changes.
            await queryRunner.query(`-- sql
                INSERT INTO chart_configs (id, patch, full, createdAt, updatedAt)
                SELECT tmp.uuid, cc.patch, cc.patch, cc.createdAt, cc.updatedAt
                FROM ${tmpTable} tmp
                JOIN ${table} o ON o.id = tmp.ownerId
                JOIN chart_configs cc ON cc.id = o.${resolvedPointer}
            `)

            // Point each owner at the row just created for it
            await queryRunner.query(`-- sql
                UPDATE ${table} o
                JOIN ${tmpTable} tmp ON tmp.ownerId = o.id
                SET o.patchConfigId = tmp.uuid
            `)

            // Drop the temporary table
            await queryRunner.query(`-- sql
                DROP TABLE ${tmpTable}
            `)
        }

        // Every owner now points at a row of its own, so require the pointer
        for (const { table } of OWNERS) {
            await queryRunner.query(`-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN patchConfigId char(36) NOT NULL
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table } of OWNERS) {
            await queryRunner.query(`-- sql
                ALTER TABLE ${table}
                MODIFY COLUMN patchConfigId char(36) NULL
            `)
        }

        for (const { table, tmpTable } of OWNERS) {
            await queryRunner.query(`-- sql
                CREATE TABLE ${tmpTable} (uuid char(36) NOT NULL PRIMARY KEY)
            `)

            await queryRunner.query(`-- sql
                INSERT INTO ${tmpTable} (uuid)
                SELECT patchConfigId FROM ${table} WHERE patchConfigId IS NOT NULL
            `)

            await queryRunner.query(`-- sql
                UPDATE ${table} SET patchConfigId = NULL
            `)

            await queryRunner.query(`-- sql
                DELETE cc FROM chart_configs cc
                JOIN ${tmpTable} tmp ON tmp.uuid = cc.id
            `)

            await queryRunner.query(`-- sql
                DROP TABLE ${tmpTable}
            `)
        }
    }
}
