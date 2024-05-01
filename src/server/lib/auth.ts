import crypto from "crypto"
import { getCookie } from "hono/cookie"
import type { Context } from "hono"
import { readFile, writeFile } from "fs/promises"
import { z } from "zod"
import * as jose from "jose"
import { AuthSchemas } from "./schemas/index.js"
export let AuthTokens: AuthToken[] = []
export let AuthTokenTO: { [key: string]: NodeJS.Timeout } = {}

export type TokenType = z.infer<typeof AuthSchemas.TokenType>
export type TokenPermission = z.infer<typeof AuthSchemas.TokenPermission>

export interface AuthToken {
    account: string
    token: string
    expire: number

    type?: TokenType // if !type, assume User
    tokenPermissions?: TokenPermission[] // default to user if type is App,
    // give full permissions if type is User
}

export function create(
    id: string,
    expire: number = 24 * 60 * 60 * 1000,
    type: TokenType = "User",
    tokenPermissions?: TokenPermission[]
) {
    let token = {
        account: id,
        token: crypto.randomBytes(36).toString("hex"),
        expire: expire ? Date.now() + expire : 0,

        type,
        tokenPermissions:
            type == "App" ? tokenPermissions || ["user"] : undefined,
    }

    AuthTokens.push(token)
    tokenTimer(token)

    save()

    return token.token
}

export function tokenFor(ctx: Context) {
    return (
        getCookie(ctx, "auth") ||
        (ctx.req.header("authorization")?.startsWith("Bearer ")
            ? ctx.req.header("authorization")?.split(" ")[1]
            : undefined)
    )
}

function getToken(token: string) {
    return AuthTokens.find(
        (e) => e.token == token && (e.expire == 0 || Date.now() < e.expire)
    )
}

export function validate(token: string) {
    return getToken(token)?.account
}

export function getType(token: string): TokenType | undefined {
    return getToken(token)?.type
}

export function getPermissions(token: string): TokenPermission[] | undefined {
    return getToken(token)?.tokenPermissions
}

export function tokenTimer(token: AuthToken) {
    if (!token.expire) return // justincase
    if (Date.now() >= token.expire) {
        invalidate(token.token)
        return
    }

    AuthTokenTO[token.token] = setTimeout(
        () => invalidate(token.token),
        token.expire - Date.now()
    )
}

export function invalidate(token: string) {
    if (AuthTokenTO[token]) {
        clearTimeout(AuthTokenTO[token])
    }

    AuthTokens.splice(
        AuthTokens.findIndex((e) => e.token == token),
        1
    )
    save()
}

export function save() {
    writeFile(
        `${process.cwd()}/.data/tokens.json`,
        JSON.stringify(AuthTokens)
    ).catch((err) => console.error(err))
}

readFile(`${process.cwd()}/.data/tokens.json`)
    .then((buf) => {
        AuthTokens = JSON.parse(buf.toString())
        AuthTokens.forEach((e) => tokenTimer(e))
    })
    .catch((err) => console.error(err))
