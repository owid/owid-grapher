import {MigrationInterface, QueryRunner} from "typeorm";
import {Chart} from '../model/Chart'

export class CoreEconRemoveLogos1546730871436 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        const charts = await Chart.find()
        for (let chart of charts) {
            if (chart.config.internalNotes === "core-econ.org") {
                chart.config.hideLogo = true
                await chart.save()
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }
}
