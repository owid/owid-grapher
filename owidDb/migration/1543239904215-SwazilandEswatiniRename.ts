import { MigrationInterface, QueryRunner } from "typeorm"

export class SwazilandEswatiniRename1543239904215
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE entities
            SET name = 'Eswatini'
            WHERE name = 'Swaziland'
        `)
        await queryRunner.query(`
            UPDATE country_name_tool_countrydata
            SET owid_name = 'Eswatini'
            WHERE owid_name = 'Swaziland'
        `)
        const countrydataIds = await queryRunner.query(`
            SELECT id FROM country_name_tool_countrydata
            WHERE owid_name = 'Eswatini'
            LIMIT 1
        `)
        const eswatiniId = countrydataIds[0].id
        await queryRunner.query(
            `
            INSERT INTO
                country_name_tool_countryname (country_name, owid_country)
            VALUES
                ('Eswatini', ?)
        `,
            [eswatiniId]
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
