import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameEswatiniBackToSwaziland1544803202664
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        // If a Swaziland entity exists, we want to map it to Eswatini
        // before renaming Eswatini to Swaziland.
        await queryRunner.query(`
            UPDATE data_values
            SET entityId = (SELECT id FROM entities WHERE name = 'Eswatini')
            WHERE entityId = (SELECT id FROM entities WHERE name = 'Swaziland')
        `)
        await queryRunner.query(`
            DELETE FROM entities
            WHERE name = 'Swaziland'
        `)
        await queryRunner.query(`
            UPDATE entities
            SET name = 'Swaziland'
            WHERE name = 'Eswatini'
        `)
        await queryRunner.query(`
            UPDATE country_name_tool_countrydata
            SET owid_name = 'Swaziland'
            WHERE owid_name = 'Eswatini'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
