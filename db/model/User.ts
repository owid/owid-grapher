import { BCryptHasher } from "../hashers.js"
import {
    DbPlainUser,
    DbInsertUser,
    UsersTableName,
} from "@ourworldindata/types"
import { KnexReadWriteTransaction, KnexReadonlyTransaction } from "../db.js"
export async function setPassword(
    knex: KnexReadWriteTransaction,
    id: number,
    password: string
): Promise<void> {
    const h = new BCryptHasher()
    const encrypted = await h.encode(password)
    await updateUser(knex, id, { password: encrypted })
}

export async function getUserById(
    knex: KnexReadonlyTransaction,
    id: number
): Promise<DbPlainUser | undefined> {
    return knex<DbPlainUser>(UsersTableName).where({ id }).first()
}

export async function getUserByEmail(
    knex: KnexReadonlyTransaction,
    email: string
): Promise<DbPlainUser | undefined> {
    return knex<DbPlainUser>(UsersTableName).where({ email }).first()
}

export async function insertUser(
    knex: KnexReadWriteTransaction,
    user: DbInsertUser
): Promise<number[]> {
    return knex(UsersTableName).insert(user)
}

export async function updateUser(
    knex: KnexReadWriteTransaction,
    id: number,
    user: Partial<DbInsertUser>
): Promise<void> {
    return knex(UsersTableName).where({ id }).update(user)
}

export async function deleteUser(
    knex: KnexReadWriteTransaction,
    id: number
): Promise<void> {
    return knex(UsersTableName).where({ id }).delete()
}
