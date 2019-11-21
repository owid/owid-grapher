import { MigrationInterface, QueryRunner } from "typeorm"

export class CaseSensitiveEntityNames1537863850886
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE entities CHANGE name name varchar(255) BINARY NOT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
