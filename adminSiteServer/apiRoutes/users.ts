import * as _ from "lodash-es"
import { DbPlainUser, UsersTableName, JsonError } from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import { getUserById, updateUser, insertUser } from "../../db/model/User.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import * as db from "../../db/db.js"
import { HonoContext } from "../authentication.js"

export async function getUsers(
    _c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    return {
        users: await trx
            .select(
                "id" satisfies keyof DbPlainUser,
                "email" satisfies keyof DbPlainUser,
                "fullName" satisfies keyof DbPlainUser,
                "isActive" satisfies keyof DbPlainUser,
                "isSuperuser" satisfies keyof DbPlainUser,
                "createdAt" satisfies keyof DbPlainUser,
                "updatedAt" satisfies keyof DbPlainUser,
                "lastLogin" satisfies keyof DbPlainUser,
                "lastSeen" satisfies keyof DbPlainUser
            )
            .from<DbPlainUser>(UsersTableName)
            .orderBy("lastSeen", "desc"),
    }
}

export async function getUserByIdHandler(
    c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const id = parseIntOrUndefined(c.req.param("userId"))
    if (!id) throw new JsonError("No user id given")
    const user = await getUserById(trx, id)
    return { user }
}

export async function deleteUser(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    if (!c.get("user").isSuperuser)
        throw new JsonError("Permission denied", 403)

    const userId = expectInt(c.req.param("userId")!)
    await db.knexRaw(trx, `DELETE FROM users WHERE id=?`, [userId])

    return { success: true }
}

export async function updateUserHandler(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    if (!c.get("user").isSuperuser)
        throw new JsonError("Permission denied", 403)

    const userId = parseIntOrUndefined(c.req.param("userId"))
    const user = userId !== undefined ? await getUserById(trx, userId) : null
    if (!user || userId === undefined) throw new JsonError("No such user", 404)

    const body = await c.req.json()
    user.fullName = body.fullName
    user.isActive = body.isActive

    await updateUser(trx, userId, _.pick(user, ["fullName", "isActive"]))

    return { success: true }
}

export async function addUser(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    if (!c.get("user").isSuperuser)
        throw new JsonError("Permission denied", 403)

    const { email, fullName } = await c.req.json()

    await insertUser(trx, {
        email,
        fullName,
    })

    return { success: true }
}

export async function addImageToUser(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const userId = expectInt(c.req.param("userId")!)
    const imageId = expectInt(c.req.param("imageId")!)
    await trx("images").where({ id: imageId }).update({ userId })
    return { success: true }
}

export async function removeUserImage(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const userId = expectInt(c.req.param("userId")!)
    const imageId = expectInt(c.req.param("imageId")!)
    await trx("images").where({ id: imageId, userId }).update({ userId: null })
    return { success: true }
}
