import { MigrationInterface, QueryRunner } from "typeorm"

const dataInsightFolders = [
    {
        fullName: "Veronika Samborska",
        folderId: "1lf6B3ZwvlbdqN3ZrVupBYxPYv8BDurm_",
    },
    {
        fullName: "Tuna Acisu",
        folderId: "1t91VSec_SSuYsosJ6CbmxJjtWjzHCEM6",
    },
    {
        fullName: "Sophia Mersmann",
        folderId: "1FD2xUGrxwgdkuK-oVYtvMLveCNKSRoP6",
    },
    {
        fullName: "Saloni Dattani",
        folderId: "1Dl4DVbgsqE7QlE6oLI0vhxP9Sy7R56lE",
    },
    {
        fullName: "Pablo Rosado",
        folderId: "1VP-IfDXdzWqvTpWmPEQVeD0KK9OQpkGi",
    },
    {
        fullName: "Pablo Arriagada",
        folderId: "1PxWdGVpPTDm4_fQtfDQCJb2hT-DOAdiq",
    },
    {
        fullName: "Max Roser",
        folderId: "15dhFas82-odMTLYcczr-09ELNPJw_DkI",
    },
    {
        fullName: "Marcel Gerber",
        folderId: "1hnMXxCBeKEO0WjxUrWGKN6QDgBU-PZ5U",
    },
    {
        fullName: "Lars Yencken",
        folderId: "1BVB73dlCxbcaZvUEdZIw_D9tin-9KXcf",
    },
    {
        fullName: "Hannah Ritchie",
        folderId: "1yRKGEW-cHDrP6GmN9eV1-Pd3DI4GWuOw",
    },
    {
        fullName: "Fiona Spooner",
        folderId: "1R4IORiq5_uUFUs3GT7lrLVXhJ1p80fnc",
    },
    {
        fullName: "Esteban Ortiz-Ospina",
        folderId: "1Ju2r2gvyls_Ux4xynNYyqD6YpErKLlHl",
    },
    {
        fullName: "Edouard Mathieu",
        folderId: "1GsRq07-h8E1DK07XxDQZKTuBLGVu-J_W",
    },
    {
        fullName: "Daniel Bachler",
        folderId: "1l2LBStwDTpyXnwn8vULAs5ZscXDxx3Tu",
    },
    {
        fullName: "Charlie Giattino",
        folderId: "13FSJHpGtGZvCROi_xMFmLt6reHa17IlH",
    },
    {
        fullName: "Bastian Herre",
        folderId: "1zsaHsfC06RKBxUCqqsfiGfhrWY0Jv47z",
    },
    {
        fullName: "Ike Saunders",
        folderId: "1N8WAbwIITxWlyXK7vGvjudTe0RS_ey4e",
    },
    {
        fullName: "Admin User",
        folderId: "1adt6cz5LcK0rIjVyiq4L_rNMqzE6qgpb",
    },
]

export class AddDataInsightFolderIds1739195264083
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN dataInsightFolderId VARCHAR(36) NULL;
        `)

        for (const { fullName, folderId } of dataInsightFolders) {
            await queryRunner.query(
                `-- sql
                    UPDATE users
                    SET dataInsightFolderId = ?
                    WHERE fullName = ?;
                `,
                [folderId, fullName]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN dataInsightFolderId;
        `)
    }
}
