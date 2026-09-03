import { MigrationInterface, QueryRunner } from "typeorm"

export class DropVariableAdminChartConfig1786544778108 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const orphans = await queryRunner.query(`-- sql
            SELECT patchConfigIdAdmin AS id FROM variables
            WHERE patchConfigIdAdmin IS NOT NULL
        `)

        // MySQL can reject dropping a column and its foreign key in one ALTER
        await queryRunner.query(`-- sql
            ALTER TABLE variables DROP FOREIGN KEY fk_variables_grapherConfigIdAdmin
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE variables DROP COLUMN patchConfigIdAdmin
        `)

        if (orphans.length > 0) {
            await queryRunner.query(
                `DELETE FROM chart_configs WHERE id IN (?)`,
                [orphans.map((row: { id: string }) => row.id)]
            )
        }
    }

    // Restores the column, not the data
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables
            ADD COLUMN patchConfigIdAdmin CHAR(36)
                CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
            ADD UNIQUE KEY patchConfigIdAdmin (patchConfigIdAdmin),
            ADD CONSTRAINT fk_variables_grapherConfigIdAdmin
                FOREIGN KEY (patchConfigIdAdmin) REFERENCES chart_configs (id)
                ON DELETE RESTRICT ON UPDATE RESTRICT
        `)
    }
}
