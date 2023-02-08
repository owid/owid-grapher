import { MigrationInterface, QueryRunner } from "typeorm"

export class AddImagesTable1673967387686 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // A record of images that have been uploaded to this server's S3 instance
        // originalWidth can be null because of SVGs
        // googleId isn't UNIQUE because people can rename files and in that case we want to re-upload the photo
        // without breaking previously published articles
        await queryRunner.query(`CREATE TABLE \`images\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`googleId\` varchar(511) NOT NULL,
            \`filename\` varchar(255) NOT NULL,
            \`defaultAlt\` varchar(1023) NOT NULL,
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
