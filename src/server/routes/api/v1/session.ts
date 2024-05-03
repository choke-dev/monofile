// Modules


import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

// Libs

import Files from "../../../lib/files.js"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import {
    getAccount,
    login,
    requiresAccount,
    scheme
} from "../../../lib/middleware.js"
import ServeError from "../../../lib/errors.js"
import { AccountSchemas } from "../../../lib/schemas/index.js"
import { z } from "zod"

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

router.use(getAccount)

export default function (files: Files) {
    router.post("/",scheme(z.object({
        username: AccountSchemas.Username,
        password: AccountSchemas.StringPassword
    })), async (ctx) => {
        const body = await ctx.req.json()

        if (ctx.get("account"))
            return ServeError(ctx, 400, "you are already logged in")

        const account = Accounts.getFromUsername(body.username)

        if (!account || !Accounts.password.check(account.id, body.password)) {
            return ServeError(ctx, 400, "username or password incorrect")
        }

        if (account.suspension) {
            if (account.suspension.until && Date.now() > account.suspension.until) delete account.suspension;
            else return ServeError(
                ctx, 
                403, 
                `account ${account.suspension.until 
                    ? `suspended until ${new Date(account.suspension.until).toUTCString()}` 
                    : "suspended indefinitely"
                }: ${account.suspension.reason}`)
        }

        login(ctx, account.id)
        return ctx.text("logged in")
    })

    router.get("/", requiresAccount, ctx => {
        let sessionToken = auth.tokenFor(ctx)
        return ctx.json({
            expiry: auth.AuthTokens.find(
                (e) => e.token == sessionToken
            )?.expire,
        })
    })

    router.delete("/", requiresAccount, (ctx) => {
        auth.invalidate(auth.tokenFor(ctx)!)
        return ctx.text("logged out")
    })

    return router
}
