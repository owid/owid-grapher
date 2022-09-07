import { MigrationInterface, QueryRunner } from "typeorm"

export class NewTablesModel1662556498902 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE tables (
          id int NOT NULL AUTO_INCREMENT,
          datasetId int NOT NULL,
          name varchar(512),
          shortName varchar(255) NOT NULL,
          description TEXT NOT NULL,
          createdAt datetime NOT NULL,
          updatedAt datetime NOT NULL,
          createdByUserId int NOT NULL,
          updatedByUserId int NOT NULL,
          UNIQUE INDEX IDX_44e87eac2fdd00b1fb053388c9 (shortName, datasetId),
          PRIMARY KEY (id)
        ) ENGINE=InnoDB`
        )

        await queryRunner.query(
            `ALTER TABLE tables ADD CONSTRAINT FK_8061417f58748b130995f5d6dc5 FOREIGN KEY (datasetId) REFERENCES datasets(id) ON DELETE NO ACTION ON UPDATE NO ACTION`
        )

        await queryRunner.query(`
        ALTER TABLE variables ADD COLUMN tableId int;
    `)
        await queryRunner.query(`
        ALTER TABLE variables ADD CONSTRAINT fk_variables_tables FOREIGN KEY (tableId) REFERENCES tables(id);
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables DROP FOREIGN KEY fk_variables_tables`
        )
        await queryRunner.query(`ALTER TABLE variables DROP COLUMN tableId`)

        await queryRunner.query(
            `ALTER TABLE tables DROP FOREIGN KEY FK_8061417f58748b130995f5d6dc5`
        )
        await queryRunner.query(
            `DROP INDEX IDX_44e87eac2fdd00b1fb053388c9 ON tables`
        )
        await queryRunner.query(`DROP TABLE tables`)
    }
}
