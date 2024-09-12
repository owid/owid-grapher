import { MigrationInterface, QueryRunner } from "typeorm"

export class RedirectChartsRouteToDataRoute1725917619555
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE FROM redirects WHERE source = "/data"
        `)
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target) VALUES ("/charts", "/data")
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target) VALUES ("/data", "#entries")
        `)
        await queryRunner.query(`-- sql
            DELETE FROM redirects WHERE source = "/charts"
        `)
    }
}
