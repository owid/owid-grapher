import { MigrationInterface, QueryRunner } from "typeorm"

export class AddVariableOrdering1534794937009 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE variables ADD columnOrder INTEGER NOT NULL DEFAULT 0"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD `createdByUserId` int NULL"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD CONSTRAINT `FK_d717ea97450b05d06316d69501a` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
