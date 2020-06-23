import { MigrationInterface, QueryRunner } from "typeorm"
import { query } from "db/db"

export class DropPasswordResets1592583704439 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE password_resets")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE `password_resets` (`id` int(11) NOT NULL AUTO_INCREMENT, `email` varchar(255) NOT NULL, `token` varchar(255) NOT NULL, `createdAt` datetime NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8;"
        )
    }
}
