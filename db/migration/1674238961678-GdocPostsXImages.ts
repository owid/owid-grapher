// import { MigrationInterface, QueryRunner } from "typeorm"

// export class GdocPostsXImages1674238961678 implements MigrationInterface {
//     public async up(queryRunner: QueryRunner): Promise<void> {
//         await queryRunner.query("ALTER TABLE posts_gdocs ADD UNIQUE (id)")

//         await queryRunner.query(`CREATE TABLE \`posts_gdocs_x_images\` (
//             \`id\` int NOT NULL AUTO_INCREMENT,
//             \`docId\` varchar(255) NOT NULL,
//             \`imageId\` int NOT NULL,
//             PRIMARY KEY (\`id\`),
//             CONSTRAINT FOREIGN KEY (\`docId\`) REFERENCES \`posts_gdocs\` (\`id\`),
//             CONSTRAINT FOREIGN KEY (\`imageId\`) REFERENCES \`images\` (\`id\`)
//         )`)
//     }

//     public async down(queryRunner: QueryRunner): Promise<void> {
//         await queryRunner.query("DROP TABLE IF EXISTS `posts_gdocs_x_images`")
//     }
// }
