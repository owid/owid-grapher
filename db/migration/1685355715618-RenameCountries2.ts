import { MigrationInterface, QueryRunner } from "typeorm"

const renameMap = {
    Timor: "East Timor",
    "Saint Barthélemy": "Saint Barthelemy",
    "Åland Islands": "Aland Islands",
    "Faeroe Islands": "Faroe Islands",
    "Eritrea and Ethiopia": "Ethiopia (former)",
    "United Korea": "Korea (former)",
}

// code adapted from 1607505305417-RenameCountries.ts
export class RenameCountries21685355715618 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [oldName, newName] of Object.entries(renameMap)) {
            console.log(`Renaming ${oldName} to ${newName}`)

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

                // refresh updatedAt timestamp of affected variables
                // to trigger datasync that will refresh their JSON files on S3
                if (affectedVariablesIds.length > 0) {
                    await queryRunner.query(
                        `
                        UPDATE variables
                        SET updatedAt = NOW()
                        WHERE id IN (?)
                    `,
                        [affectedVariablesIds]
                    )
                }

                // swap names, we can't just delete them because there might be old entity ids
                // still on S3. We'll delete the old names in a later migration.
                await queryRunner.query(
                    `
                    UPDATE entities
                    SET name = ?
                    WHERE id = ?
                `,
                    [`${oldName}-temp`, existingEntityId]
                )
                await queryRunner.query(
                    `
                    UPDATE entities
                    SET name = ?
                    WHERE id = ?
                `,
                    [oldName, duplicateEntityId]
                )
                await queryRunner.query(
                    `
                    UPDATE entities
                    SET name = ?
                    WHERE id = ?
                `,
                    [newName, existingEntityId]
                )
            } else {
                // just rename entity if there's no duplicate
                await queryRunner.query(
                    `
                    UPDATE entities
                    SET name = ?
                    WHERE name = ?
                `,
                    [newName, oldName]
                )
            }

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
