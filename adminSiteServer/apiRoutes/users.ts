import { DbPlainUser, UsersTableName, JsonError } from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import { pick } from "lodash"
import { getUserById, updateUser, insertUser } from "../../db/model/User.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { apiRouter } from "../apiRouter.js"
import {
    getRouteWithROTransaction,
    deleteRouteWithRWTransaction,
    putRouteWithRWTransaction,
    postRouteWithRWTransaction,
} from "../functionalRouterHelpers.js"
import * as db from "../../db/db.js"

getRouteWithROTransaction(apiRouter, "/users.json", async (req, res, trx) => ({
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
}))

getRouteWithROTransaction(
    apiRouter,
    "/users/:userId.json",
    async (req, res, trx) => {
        const id = parseIntOrUndefined(req.params.userId)
        if (!id) throw new JsonError("No user id given")
        const user = await getUserById(trx, id)
        return { user }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/users/:userId",
    async (req, res, trx) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const userId = expectInt(req.params.userId)
        await db.knexRaw(trx, `DELETE FROM users WHERE id=?`, [userId])

        return { success: true }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/users/:userId",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const userId = parseIntOrUndefined(req.params.userId)
        const user =
            userId !== undefined ? await getUserById(trx, userId) : null
        if (!user) throw new JsonError("No such user", 404)

        user.fullName = req.body.fullName
        user.isActive = req.body.isActive

        await updateUser(trx, userId!, pick(user, ["fullName", "isActive"]))

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/users/add",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const { email, fullName } = req.body

        await insertUser(trx, {
            email,
            fullName,
        })

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/users/:userId/images/:imageId",
    async (req, res, trx) => {
        const userId = expectInt(req.params.userId)
        const imageId = expectInt(req.params.imageId)
        await trx("images").where({ id: imageId }).update({ userId })
        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/users/:userId/images/:imageId",
    async (req, res, trx) => {
        const userId = expectInt(req.params.userId)
        const imageId = expectInt(req.params.imageId)
        await trx("images")
            .where({ id: imageId, userId })
            .update({ userId: null })
        return { success: true }
    }
)
