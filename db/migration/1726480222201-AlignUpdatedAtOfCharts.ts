import { MigrationInterface, QueryRunner } from "typeorm"

export class AlignUpdatedAtOfCharts1726480222201 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE chart_configs cf
            INNER JOIN charts c ON c.configId = cf.id
            SET cf.updatedAt = LEAST(cf.updatedAt, c.updatedAt)
            WHERE c.updatedAt IS NOT NULL;
        `)

        await queryRunner.query(`
            ALTER TABLE charts
            MODIFY updatedAt datetime DEFAULT NULL;
        `)
        await queryRunner.query(`
            ALTER TABLE chart_configs
            MODIFY updatedAt datetime DEFAULT NULL;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE charts
            MODIFY updatedAt datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
        `)
        await queryRunner.query(`
            ALTER TABLE chart_configs
            MODIFY updatedAt datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
        `)

        // We can't automatically revert the data changes
    }
}
