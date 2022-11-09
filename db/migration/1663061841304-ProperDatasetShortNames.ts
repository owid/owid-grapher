import { MigrationInterface, QueryRunner } from "typeorm"

// remove insitution and version from dataset short names
const RENAME_MAP = {
    bp_energy_mix__bp_2022: "bp_energy_mix",
    carbon_dioxide_emissions_by_sector__cait_2022_08_10:
        "carbon_dioxide_emissions_by_sector",
    dummy__dummy_2020_01_01: "dummy",
    electricity_mix__energy_2022_08_03: "electricity_mix",
    energy_mix__bp_2022_07_14: "energy_mix",
    faostat_ef__faostat_2022_05_17: "faostat_ef",
    faostat_ei__faostat_2022_05_17: "faostat_ei",
    faostat_ek__faostat_2022_05_17: "faostat_ek",
    faostat_el__faostat_2022_05_17: "faostat_el",
    faostat_emn__faostat_2022_05_17: "faostat_emn",
    faostat_ep__faostat_2022_05_17: "faostat_ep",
    faostat_esb__faostat_2022_05_17: "faostat_esb",
    faostat_fa__faostat_2022_05_17: "faostat_fa",
    faostat_fbsc__faostat_2022_05_17: "faostat_fbsc",
    faostat_fo__faostat_2022_05_17: "faostat_fo",
    faostat_fs__faostat_2022_05_17: "faostat_fs",
    faostat_lc__faostat_2022_05_17: "faostat_lc",
    faostat_qcl__faostat_2022_05_17: "faostat_qcl",
    faostat_qi__faostat_2022_05_17: "faostat_qi",
    faostat_qv__faostat_2022_05_17: "faostat_qv",
    faostat_rfb__faostat_2022_05_17: "faostat_rfb",
    faostat_rfn__faostat_2022_05_17: "faostat_rfn",
    faostat_rl__faostat_2022_05_17: "faostat_rl",
    faostat_rp__faostat_2022_05_17: "faostat_rp",
    faostat_rt__faostat_2022_05_17: "faostat_rt",
    faostat_scl__faostat_2022_05_17: "faostat_scl",
    faostat_sdgb__faostat_2022_05_17: "faostat_sdgb",
    faostat_tcl__faostat_2022_05_17: "faostat_tcl",
    faostat_ti__faostat_2022_05_17: "faostat_ti",
    fossil_fuel_production__energy_2022_07_20: "fossil_fuel_production",
    ggdc_maddison__2020_10_01: "ggdc_maddison",
    global_primary_energy__energy_2022_09_09: "global_primary_energy",
    greenhouse_gas_emissions_by_sector__cait_2022_08_10:
        "greenhouse_gas_emissions_by_sector",
    methane_emissions_by_sector__cait_2022_08_10: "methane_emissions_by_sector",
    nitrous_oxide_emissions_by_sector__cait_2022_08_10:
        "nitrous_oxide_emissions_by_sector",
    primary_energy_consumption__energy_2022_07_29: "primary_energy_consumption",
    statistical_review__bp_2022_07_14: "statistical_review",
    un_sdg__2022_07_07: "un_sdg",
    un_wpp__2022_07_11: "un_wpp",
    wdi__2022_05_26: "wdi",
}

export class ProperDatasetShortNames1663061841304
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
            await queryRunner.query(
                `UPDATE datasets SET shortName = '${newName}' WHERE shortName = '${oldName}';`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
            await queryRunner.query(
                `UPDATE datasets SET shortName = '${oldName}' WHERE shortName = '${newName}';`
            )
        }
    }
}
