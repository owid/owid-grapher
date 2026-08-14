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

        await this.verify(queryRunner)
    }

    /**
     * The whole refactor rests on the patch rows holding exactly what
     * chart_configs.patch holds, so prove it here rather than in a rehearsal:
     * a later migration drops that column, and this is the last point at which
     * the two can be compared.
     */
    private async verify(queryRunner: QueryRunner): Promise<void> {
        for (const { table, resolvedPointer } of OWNERS) {
            // Every owner row must have come out of the backfill with a pointer.
            const [{ unpointed }] = await queryRunner.query(`-- sql
                SELECT COUNT(*) AS unpointed FROM ${table}
                WHERE patchConfigId IS NULL
            `)
            if (Number(unpointed) > 0) {
                throw new Error(
                    `${unpointed} ${table} rows have no patchConfigId after backfill`
                )
            }

            // ...and the new row must hold the authored config verbatim, in both
            // columns, since after the rename `config` is what `patch` was.
            const [{ mismatched }] = await queryRunner.query(`-- sql
                SELECT COUNT(*) AS mismatched
                FROM ${table} o
                JOIN chart_configs resolved ON resolved.id = o.${resolvedPointer}
                JOIN chart_configs patch ON patch.id = o.patchConfigId
                WHERE patch.patch <> resolved.patch
                    OR patch.full <> resolved.patch
            `)
            if (Number(mismatched) > 0) {
                throw new Error(
                    `${mismatched} ${table} patch rows do not match their source patch`
                )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
