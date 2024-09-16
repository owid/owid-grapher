import { MigrationInterface, QueryRunner } from "typeorm"

export class AlignUpdatedAtOfCharts1726480222201 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE chart_configs cf
            INNER JOIN charts c ON c.configId = cf.id
            SET cf.updatedAt = LEAST(cf.updatedAt, c.updatedAt)
            WHERE c.updatedAt IS NOT NULL;
        `)
    }

    public async down(): Promise<void> {
        throw new Error(
            "Cannot automatically revert migration 'AlignUpdatedAtOfCharts1726480222201'"
        )
    }
}
