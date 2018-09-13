import {MigrationInterface, QueryRunner} from "typeorm"
import {GIT_DATASETS_DIR} from '../settings'
import * as glob from 'glob'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as shell from 'shelljs'
import {quote} from 'shell-quote'

export class ChangeGitFormat1536830436456 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        function exec(cmd: string) {
            console.log(cmd)
            shell.exec(cmd)
        }

        const repoDir = path.join(GIT_DATASETS_DIR, "owid")
        for (const file of glob.sync(path.join(repoDir, '*.csv'))) {
            const datasetName = path.basename(file, ".csv")
            await fs.mkdirp(path.join(repoDir, datasetName))
            exec(`cd ${quote([repoDir])} && git mv ${quote([datasetName+".csv"])} ${quote([datasetName])} && git mv ${quote([datasetName+".json"])} ${quote([datasetName + "/datapackage.json"])}`)
        }
        exec(`cd ${quote([repoDir])} && git commit -m "Restructuring export repo"`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }
}
