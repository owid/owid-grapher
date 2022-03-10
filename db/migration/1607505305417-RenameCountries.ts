import { MigrationInterface, QueryRunner } from "typeorm"

const renameMap = {
    Swaziland: "Eswatini",
    Macedonia: "North Macedonia",
    "Czech Republic": "Czechia",
    Timor : "East Timor",
}

export class RenameCountries1607505305417 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        for (const [oldName, newName] of Object.entries(renameMap)) {
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

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
