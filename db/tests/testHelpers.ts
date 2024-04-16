import { Knex } from "knex"

export async function cleanTestDb(
    knexInstance: Knex<any, unknown[]>
): Promise<void> {
    await knexInstance.raw("DELETE FROM chart_dimensions")
    await knexInstance.raw("DELETE FROM chart_revisions")
    await knexInstance.raw("DELETE from charts")
    await knexInstance.raw("DELETE FROM posts_gdocs")
    await knexInstance.raw("DELETE FROM users")
}

export function sleep(time: number, value: any): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}
