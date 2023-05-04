import { MigrationInterface, QueryRunner } from "typeorm"

const renameMap = {
    Timor: "East Timor",
    "Saint Barthélemy": "Saint Barthelemy",
    "Åland Islands": "Aland Islands",
}

// code adapted from 1607505305417-RenameCountries.ts
export class RenameCountries21683196062637 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [oldName, newName] of Object.entries(renameMap)) {
            console.log(
                `Renaming ${oldName} to ${newName} and deleting ${oldName} from entities table`
            )

            const duplicateEntity = await queryRunner.query(
                `
                SELECT id
                FROM entities
                WHERE name = ?
            `,
                [newName]
            )

            if (duplicateEntity[0]) {
                const duplicateEntityId = duplicateEntity[0].id

                const affectedVariables = await queryRunner.query(
                    `
                    SELECT DISTINCT variableId
                    FROM data_values
                    WHERE entityId = ?
                `,
                    [duplicateEntityId]
                )
                const affectedVariablesIds = affectedVariables.map(
                    (variable: any) => variable.variableId
                )

                const existingEntity = await queryRunner.query(
                    `
                    SELECT id
                    FROM entities
                    WHERE name = ?
                `,
                    [oldName]
                )
                const existingEntityId = existingEntity[0].id
                await queryRunner.query(
                    `
                    UPDATE data_values
                    SET entityId = ?
                    WHERE entityId = ?
                `,
                    [existingEntityId, duplicateEntityId]
                )

                await queryRunner.query(
                    `
                    DELETE FROM entities
                    WHERE id = ?
                `,
                    [duplicateEntityId]
                )

                // refresh updatedAt timestamp of affected variables
                // to trigger datasync that will refresh their JSON files on S3
                await queryRunner.query(
                    `
                    UPDATE variables
                    SET updatedAt = NOW()
                    WHERE id IN (?)
                `,
                    [affectedVariablesIds]
                )
            }

            await queryRunner.query(
                `
                UPDATE entities
                SET name = ?
                WHERE name = ?
            `,
                [newName, oldName]
            )
            await queryRunner.query(
                `
                UPDATE country_name_tool_countrydata
                SET owid_name = ?
                WHERE owid_name = ?
            `,
                [newName, oldName]
            )
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<any> {}
}
