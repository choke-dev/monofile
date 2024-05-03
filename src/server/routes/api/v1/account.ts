// Modules

import { type Context, Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

// Libs

import Files from "../../../lib/files.js"
import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import {
    assertAPI,
    getAccount,
    issuesToMessage,
    login,
    noAPIAccess,
    requiresAccount,
    requiresPermissions,
    scheme,
} from "../../../lib/middleware.js"
import ServeError from "../../../lib/errors.js"
import { CodeMgr, sendMail } from "../../../lib/mail.js"

import Configuration from "../../../lib/config.js"
import { AccountSchemas, FileSchemas } from "../../../lib/schemas/index.js"
import { z } from "zod"

const router = new Hono<{
    Variables: {
        account: Accounts.Account
        target: Accounts.Account
    }
}>()

type UserUpdateParameters = Partial<
    Omit<Accounts.Account, "password"> & {
        password: string
        currentPassword?: string
    }
>
type Message = [200 | 400 | 401 | 403 | 429 | 501, string]

// there's probably a less stupid way to do this than `K in keyof Pick<UserUpdateParameters, T>`
// @Jack5079 make typings better if possible

type Validator<
    T extends keyof Partial<Accounts.Account>
> =
    /**
     * @param actor The account performing this action
     * @param target The target account for this action
     * @param params Changes being patched in by the user
     */
    (
        actor: Accounts.Account,
        target: Accounts.Account,
        params: UserUpdateParameters &
            {
                [K in keyof Pick<
                    UserUpdateParameters,
                    T
                >]-?: UserUpdateParameters[K]
            },
        ctx: Context
    ) => Accounts.Account[T] | Message

type SchemedValidator<
    T extends keyof Partial<Accounts.Account>
> = {
    validator: Validator<T>,
    schema: z.ZodTypeAny
}

const validators: {
    [T in keyof Partial<Accounts.Account>]: SchemedValidator<T>
} = {
    defaultFileVisibility: {
        schema: FileSchemas.FileVisibility,
        validator: (actor, target, params) => {
            return params.defaultFileVisibility
        }
    },
    email: {
        schema: AccountSchemas.Account.shape.email.nullable(),
        validator: (actor, target, params, ctx) => {
            if (
                !params.currentPassword || // actor on purpose here to allow admins
                (params.currentPassword &&
                    Accounts.password.check(actor.id, params.currentPassword))
            )
                return [401, "current password incorrect"]

            if (!params.email) {
                if (target.email) {
                    sendMail(
                        target.email,
                        `Email disconnected`,
                        `<b>Hello there!</b> Your email address (<span code>${target.email}</span>) has been disconnected from the monofile account <span username>${target.username}</span>. Thank you for using monofile.`
                    ).catch()
                }
                return undefined
            }

            if (actor.admin) return params.email || undefined

            // send verification email

            if (
                (CodeMgr.codes.verifyEmail.byUser.get(target.id)?.length ||
                    0) >= 2
            )
                return [429, "you have too many active codes"]

            let code = new CodeMgr.Code("verifyEmail", target.id, params.email)

            sendMail(
                params.email,
                `Hey there, ${target.username} - let's connect your email`,
                `<b>Hello there!</b> You are recieving this message because you decided to link your email, <span code>${
                    params.email.split("@")[0]
                }<span style="opacity:0.5">@${
                    params.email.split("@")[1]
                }</span></span>, to your account, <span username>${
                    target.username
                }</span>. If you would like to continue, please <a href="https://${ctx.req.header(
                    "Host"
                )}/go/verify/${code.id}"><span code>click here</span></a>, or go to https://${ctx.req.header(
                    "Host"
                )}/go/verify/${code.id}.`
            )

            return [200, "please check your inbox"]
        },
    },
    password: {
        schema: AccountSchemas.StringPassword,
        validator: (actor, target, params) => {
            if (
                !params.currentPassword || // actor on purpose here to allow admins
                (params.currentPassword &&
                    Accounts.password.check(actor.id, params.currentPassword))
            )
                return [401, "current password incorrect"]

            if (target.email) {
                sendMail(
                    target.email,
                    `Your login details have been updated`,
                    `<b>Hello there!</b> Your password on your account, <span username>${target.username}</span>, has been updated` +
                        `${actor != target ? ` by <span username>${actor.username}</span>` : ""}. ` +
                        `Please update your saved login details accordingly.`
                ).catch()
            }

            return Accounts.password.hash(params.password)
        }
    },
    username: {
        schema: AccountSchemas.Username,
        validator: (actor, target, params) => {
            if (
                !params.currentPassword || // actor on purpose here to allow admins
                (params.currentPassword &&
                    Accounts.password.check(actor.id, params.currentPassword))
            )
                return [401, "current password incorrect"]

            if (Accounts.getFromUsername(params.username))
                return [400, "account with this username already exists"]

            if (target.email) {
                sendMail(
                    target.email,
                    `Your login details have been updated`,
                    `<b>Hello there!</b> Your username on your account, <span username>${target.username}</span>, has been updated` +
                        `${actor != target ? ` by <span username>${actor.username}</span>` : ""} to <span username>${params.username}</span>. ` +
                        `Please update your saved login details accordingly.`
                ).catch()
            }

            return params.username
        }
    },
    admin: {
        schema: z.boolean(),
        validator: (actor, target, params) => {
            if (actor.admin && !target.admin) return params.admin
            else if (!actor.admin) return [400, "cannot promote yourself"]
            else return [400, "cannot demote an admin"]
        }
    },
    suspension: {
        schema: AccountSchemas.Suspension.nullable(),
        validator: (actor, target, params) => {
            if (!actor.admin) return [400, "only admins can modify suspensions"]
            return params.suspension || undefined
        }
    },
    settings: {
        schema: AccountSchemas.Settings.User.partial(),
        validator: (actor, target, params) => {
            let base = AccountSchemas.Settings.User.default({}).parse(target.settings)

            let visit = (bse: Record<string, any>, nw: Record<string, any>) => {
                for (let [key,value] of Object.entries(nw)) {
                    if (typeof value == "object") visit(bse[key], value)
                    else bse[key] = value
                }
            }

            visit(base, params.settings)
            
            return AccountSchemas.Settings.User.parse(base) // so that toLowerCase is called again... yeah that's it
        }
    },
}

router.use(getAccount)
router.all("/:user", async (ctx, next) => {
    let acc =
        ctx.req.param("user") == "me"
            ? ctx.get("account")
            : ctx.req.param("user").startsWith("@")
              ? Accounts.getFromUsername(ctx.req.param("user").slice(1))
              : Accounts.getFromId(ctx.req.param("user"))
    if (acc != ctx.get("account") && !ctx.get("account")?.admin)
        return ServeError(ctx, 403, "you cannot manage this user")
    if (!acc) return ServeError(ctx, 404, "account does not exist")

    ctx.set("target", acc)

    return next()
})

function isMessage(object: any): object is Message {
    return (
        Array.isArray(object) &&
        object.length == 2 &&
        typeof object[0] == "number" &&
        typeof object[1] == "string"
    )
}

export default function (files: Files) {
    router.post("/", scheme(z.object({
        username: AccountSchemas.Username,
        password: AccountSchemas.StringPassword
    })), async (ctx) => {
        const body = await ctx.req.json()
        if (!Configuration.accounts.registrationEnabled) {
            return ServeError(ctx, 403, "account registration disabled")
        }

        if (auth.validate(getCookie(ctx, "auth")!)) {
            return ServeError(ctx, 400, "you are already logged in")
        }

        if (Accounts.getFromUsername(body.username)) {
            return ServeError(
                ctx,
                400,
                "account with this username already exists"
            )
        }

        return Accounts.create(body.username, body.password)
            .then((account) => {
                login(ctx, account)
                return ctx.text("logged in")
            })
            .catch((e) => {
                console.error(e)
                return ServeError(ctx, 500, e instanceof z.ZodError ? issuesToMessage(e.issues) : "internal server error")
            })
    })

    router.patch(
        "/:user",
        requiresAccount,
        requiresPermissions("manage"),
        async (ctx) => {
            const body = (await ctx.req.json()) as UserUpdateParameters
            const actor = ctx.get("account")!
            const target = ctx.get("target")!
            if (Array.isArray(body)) return ServeError(ctx, 400, "invalid body")

            let results: (
                | [
                      keyof Accounts.Account,
                      Accounts.Account[keyof Accounts.Account],
                  ]
                | Message
            )[] = (
                Object.entries(body).filter(
                    (e) => e[0] !== "currentPassword"
                ) as [
                    keyof Accounts.Account,
                    UserUpdateParameters[keyof Accounts.Account],
                ][]
            ).map(([x, v]) => {
                if (!validators[x])
                    return [
                        400,
                        `the ${x} parameter cannot be set or is not a valid parameter`,
                    ] as Message

                let validator = validators[x]!

                let check = validator.schema.safeParse(v)
                if (!check.success)
                    return [400, issuesToMessage(check.error.issues)]

                return [
                    x,
                    validator.validator(actor, target, body as any, ctx),
                ] as [
                    keyof Accounts.Account,
                    Accounts.Account[keyof Accounts.Account],
                ]
            })

            let allMsgs = results.map((v) => {
                if (isMessage(v)) return v
                target[v[0]] = v[1] as never // lol
                return [200, "OK"] as Message
            })

            await Accounts.save()

            if (allMsgs.length == 1)
                return ctx.text(
                    ...(allMsgs[0]!.reverse() as [Message[1], Message[0]])
                ) // im sorry
            else return ctx.json(allMsgs)
        }
    )

    router.delete("/:user", requiresAccount, noAPIAccess, async (ctx) => {
        let acc = ctx.get("target")

        auth.AuthTokens.filter((e) => e.account == acc?.id).forEach((token) => {
            auth.invalidate(token.token)
        })

        await Accounts.deleteAccount(acc.id)

        if (acc.email) {
            await sendMail(
                acc.email,
                "Notice of account deletion",
                `Your account, <span username>${acc.username}</span>, has been removed. Thank you for using monofile.`
            ).catch()
            return ctx.text("OK")
        }

        return ctx.text("account deleted")
    })

    router.get("/:user", requiresAccount, async (ctx) => {
        let acc = ctx.get("target")
        let sessionToken = auth.tokenFor(ctx)!

        return ctx.json({
            ...acc,
            password: undefined,
            email:
                auth.getType(sessionToken) == "User" ||
                auth.getPermissions(sessionToken)?.includes("email")
                    ? acc.email
                    : undefined,
            activeSessions: auth.AuthTokens.filter(
                (e) =>
                    e.type != "App" &&
                    e.account == acc.id &&
                    (e.expire > Date.now() || !e.expire)
            ).length,
        })
    })

    return router
}
