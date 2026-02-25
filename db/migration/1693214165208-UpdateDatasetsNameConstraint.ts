import { MigrationInterface, QueryRunner } from "typeorm"

export class UpdateDatasetsNameConstraint1693214165208 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets
            DROP INDEX datasets_name_namespace_d3d60d22_uniq;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE datasets
            ADD UNIQUE KEY datasets_name_namespace_d3d60d22_uniq (name, namespace);
        `)
    }
}
