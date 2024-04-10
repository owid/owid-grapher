import { Knex } from "knex"

export async function cleanTestDb(
    knexInstance: Knex<any, unknown[]>
): Promise<void> {
    await knexInstance.raw("DELETE FROM users")
    await knexInstance.raw("DELETE from charts")
}

export function sleep(time: number, value: any): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}
