import { MigrationInterface, QueryRunner } from "typeorm"

export class AddTagGraph1716401298509 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE tag_graph (
                parentId INT NOT NULL,
                childId INT NOT NULL,
                weight INT NOT NULL DEFAULT 100,
                PRIMARY KEY (parentId, childId),
                FOREIGN KEY (parentId) REFERENCES tags (id),
                FOREIGN KEY (childId) REFERENCES tags (id),
                INDEX (childId),
                CONSTRAINT chk_no_self_link CHECK (parentId != childId)
            )`)

        // create root tag
        await queryRunner.query(`-- sql
            INSERT INTO tags (name) VALUES ("tag-graph-root")`)

        // populate tag_graph with the existing relationships from the tags table
        await queryRunner.query(`-- sql
            INSERT INTO tag_graph (parentId, childId)
            SELECT parentId, id
            FROM tags
            WHERE parentId IS NOT NULL`)

        // insert edges between the 10 top level tags and the root tag
        await queryRunner.query(`-- sql
          INSERT INTO tag_graph (parentId, childId)
            SELECT 
                (SELECT id FROM tags WHERE name = 'tag-graph-root'),
                id
            FROM tags
            WHERE name IN (
                "Population and Demographic Change",
                "Health",
                "Food and Agriculture",
                "Energy and Environment",
                "Poverty and Economic Development",
                "Education and Knowledge",
                "Innovation and Technological Change",
                "Living Conditions, Community and Wellbeing",
                "Human Rights and Democracy",
                "Violence and War"
            )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE tag_graph`)
        await queryRunner.query(`-- sql
            DELETE FROM tags WHERE name = "tag-graph-root"`)
    }
}
