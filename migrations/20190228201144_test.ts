import * as Knex from "knex";

exports.up = async function (knex: Knex): Promise<any> {
    return knex.schema.createTable("test", t => {
        t.increments('id').unsigned().primary()
        t.string('name').notNullable()
    })
};

exports.down = async function (knex: Knex): Promise<any> {
    throw new Error()
};
