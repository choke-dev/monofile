import * as Accounts from "./accounts.js"
import type { Context, Handler as RequestHandler } from "hono"
import ServeError from "../lib/errors.js"
import * as auth from "./auth.js"
import { setCookie } from "hono/cookie"
import { z } from "zod"

/**
 * @description Middleware which adds an account, if any, to ctx.get("account")
 */
export const getAccount: RequestHandler = function (ctx, next) {
    let account = Accounts.getFromToken(auth.tokenFor(ctx)!)
    if (account?.suspension)
        setCookie(ctx, "auth", "")
    ctx.set("account", account)
    return next()
}

/**
 * @description Middleware which blocks requests which do not have ctx.get("account") set
 */
export const requiresAccount: RequestHandler = function (ctx, next) {
    if (!ctx.get("account")) {
        return ServeError(ctx, 401, "not logged in")
    }
    return next()
}

/**
 * @description Middleware which blocks requests that have ctx.get("account").admin set to a falsy value
 */
export const requiresAdmin: RequestHandler = function (ctx, next) {
    if (!ctx.get("account").admin) {
        return ServeError(ctx, 403, "you are not an administrator")
    }
    return next()
}

/**
 * @description Blocks requests based on the permissions which a token has. Does not apply to routes being accessed with a token of type `User`
 * @param tokenPermissions Permissions which your route requires.
 * @returns Express middleware
 */
export const requiresPermissions = function (
    ...tokenPermissions: auth.TokenPermission[]
): RequestHandler {
    return function (ctx, next) {
        let token = auth.tokenFor(ctx)!
        let type = auth.getType(token)

        if (type == "App") {
            let permissions = auth.getPermissions(token)

            if (!permissions) return ServeError(ctx, 403, "insufficient permissions")
            else {
                for (let v of tokenPermissions) {
                    if (!permissions.includes(v as auth.TokenPermission)) {
                        return ServeError(ctx, 403, "insufficient permissions")
                    }
                }
                return next()
            }
        } else return next()
    }
}

/**
 * @description Blocks requests based on whether or not the token being used to access the route is of type `User`.
 */

export const noAPIAccess: RequestHandler = function (ctx, next) {
    if (auth.getType(auth.tokenFor(ctx)!) == "App")
        return ServeError(ctx, 403, "apps are not allowed to access this endpoint")
    else return next()
}

/**
  @description Add a restriction to this route; the condition must be true to allow API requests.
*/

export const assertAPI = function (
    condition: (acc: Accounts.Account, token: string) => boolean
): RequestHandler {
    return function (ctx, next) {
        let reqToken = auth.tokenFor(ctx)!
        if (
            auth.getType(reqToken) == "App" &&
            condition(ctx.get("account"), reqToken)
        )
            return ServeError(
                ctx,
                403,
                "apps are not allowed to access this endpoint"
            )
        else return next()
    }
}

export const issuesToMessage = function(issues: z.ZodIssue[]) {
    return issues.map(e => `${e.path}: ${e.code} :: ${e.message}`).join("; ")
}

export const scheme = function(scheme: z.ZodTypeAny): RequestHandler {
    return async function(ctx, next) {
        let chk = scheme.safeParse(await ctx.req.json())
        if (chk.success) return next()
        else return ServeError(ctx, 400, issuesToMessage(chk.error.issues))
    }
}

// Not really middleware but a utility

export const login = (ctx: Context, account: string) => setCookie(ctx, "auth", auth.create(account, 3 * 24 * 60 * 60 * 1000), {
    path: "/",
    sameSite: "Strict",
    secure: true,
    httpOnly: true
})