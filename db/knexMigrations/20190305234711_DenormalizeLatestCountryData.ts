import * as Knex from "knex"

exports.up = async function (knex: Knex): Promise<any> {
    await knex.schema.createTable("country_latest_data", t => {
        t.string("country_code")
        t.integer("variable_id").references("variables.id")
        t.integer("year")
        t.string("value")
        t.unique(["country_code", "variable_id"])
    })
}

exports.down = async function (knex: Knex): Promise<any> {
    await knex.schema.dropTable("country_latest_data")
}
