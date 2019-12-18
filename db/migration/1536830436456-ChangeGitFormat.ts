import { MigrationInterface, QueryRunner } from "typeorm"

export class ChangeGitFormat1536830436456 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        /* async function execAndLog(cmd: string) {
            console.log(cmd)
            await exec(cmd)
        }

        const repoDir = path.join(GIT_DATASETS_DIR, "owid")
        for (const file of glob.sync(path.join(repoDir, '*.csv'))) {
            const datasetName = path.basename(file, ".csv")
            await fs.mkdirp(path.join(repoDir, datasetName))
            await execAndLog(`cd ${quote([repoDir])} && git mv ${quote([datasetName+".csv"])} ${quote([datasetName])} && git mv ${quote([datasetName+".json"])} ${quote([datasetName + "/datapackage.json"])}`)
        }
        await execAndLog(`cd ${quote([repoDir])} && git commit -m "Restructuring export repo"`)*/
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
