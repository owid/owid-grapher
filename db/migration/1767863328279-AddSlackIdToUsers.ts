import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSlackIdToUsers1767863328279 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN slackId VARCHAR(255) NULL;
        `)

        const updates = [
            { fullName: "Angela Wenham", slackId: "U06U7HMGJSU" },
            { fullName: "Antoinette Finnegan", slackId: "U0550KX9ZG9" },
            { fullName: "Bastian Herre", slackId: "U01Q41A9PJS" },
            { fullName: "Bertha Rohenkohl", slackId: "U07TQ8APT1T" },
            { fullName: "Bobbie Macdonald", slackId: "U0117V5H16U" },
            { fullName: "Charlie Giattino", slackId: "U01310BHF4J" },
            { fullName: "Daniel Bachler", slackId: "U01TSHGPXRV" },
            { fullName: "Edouard Mathieu", slackId: "U01129F6DQQ" },
            { fullName: "Esteban Ortiz-Ospina", slackId: "U3E8LTA3X" },
            { fullName: "Fiona Spooner", slackId: "U01T5MG8DTM" },
            { fullName: "Hannah Ritchie", slackId: "U4U46QBJ5" },
            { fullName: "Ike Saunders", slackId: "U036Q593X54" },
            { fullName: "Joe Hasell", slackId: "U3GSPFCV6" },
            { fullName: "Lucas Rodés-Guirao", slackId: "U01THNNPDCG" },
            { fullName: "Marcel Gerber", slackId: "U011L616WE5" },
            { fullName: "Martin Račák", slackId: "U06S4C4KGJZ" },
            { fullName: "Marwa Boukarim", slackId: "U03DTUH6T7S" },
            { fullName: "Matthieu Bergel", slackId: "ULG7KK63Z" },
            { fullName: "Max Roser", slackId: "U3E5PRWNN" },
            { fullName: "Mojmir Vinkler", slackId: "U02US02AWA1" },
            { fullName: "Natalie Reynolds-Garcia", slackId: "U03QPP629GW" },
            { fullName: "Pablo Arriagada", slackId: "U03DR3BKE5R" },
            { fullName: "Pablo Rosado", slackId: "U02UVHS46AZ" },
            { fullName: "Sophia Mersmann", slackId: "U04QE4CFUKC" },
            { fullName: "Tuna Acisu", slackId: "U07437LD7JR" },
            { fullName: "Valerie Muigai", slackId: "U027C4D5B7F" },
            { fullName: "Veronika Samborska", slackId: "U053NDCFT7C" },
        ]

        for (const { fullName, slackId } of updates) {
            await queryRunner.query(
                `
                UPDATE users
                SET slackId = ?
                WHERE fullName = ?;
                `,
                [slackId, fullName]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN slackId;
        `)
    }
}
