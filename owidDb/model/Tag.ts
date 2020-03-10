import { QueryBuilder } from "knex"

export namespace Tag {
    export interface Row {
        id: number
        name: string
        parentId: number
        specialType: string
        isBulkImport: boolean
    }

    export type Field = keyof Row

    export const table = "tags"

    export function select<K extends keyof Row>(
        ...args: K[]
    ): { from: (query: QueryBuilder) => Promise<Pick<Row, K>[]> } {
        return {
            from: query => query.select(...args) as any
        }
    }
}
