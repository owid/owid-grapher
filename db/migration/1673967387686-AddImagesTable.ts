import { MigrationInterface, QueryRunner } from "typeorm"

export class AddImagesTable1673967387686 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // TODO: probably shouldn't have DEFAULT NULLs
        // originalWidth can be null because of SVGs
        // googleId isn't UNIQUE because people can rename files and in that case we want to re-upload the photo
        // without breaking previously published articles
        await queryRunner.query(`CREATE TABLE \`images\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`googleId\` varchar(511) DEFAULT NULL,
            \`filename\` varchar(255) DEFAULT NULL,
            \`defaultAlt\` varchar(1023) DEFAULT NULL,
            \`originalWidth\` int DEFAULT NULL,
            \`updatedAt\` BIGINT,
            PRIMARY KEY (\`id\`),
            UNIQUE(\`filename\`),
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE images`)
    }
}
