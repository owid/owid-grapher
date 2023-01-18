import { MigrationInterface, QueryRunner } from "typeorm"

export class AddImagesTable1673967387686 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`images\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`googleId\` varchar(511) DEFAULT NULL,
            \`filename\` varchar(255) DEFAULT NULL,
            \`defaultAlt\` varchar(1023) DEFAULT NULL,
            \`updatedAt\` BIGINT,
            PRIMARY KEY (\`id\`),
            UNIQUE(\`filename\`),
            UNIQUE(\`googleId\`)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE images`)
    }
}
