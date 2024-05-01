import { Hono } from "hono"
import * as Accounts from "../../../lib/accounts.js"
import { HttpBindings } from "@hono/node-server"
import pkg from "../../../../../package.json" assert {type: "json"}
import config, { ClientConfiguration } from "../../../lib/config.js"
import type Files from "../../../lib/files.js"

const router = new Hono<{
    Variables: {
        account: Accounts.Account
    },
    Bindings: HttpBindings
}>()

export default function(files: Files) {
    
    router.get("/", async (ctx) =>
        ctx.json({
            version: pkg.version,
            files: Object.keys(files.files).length,
            totalSize: Object.values(files.files).filter(e => e.sizeInBytes).reduce((acc,cur)=>acc+cur.sizeInBytes!,0),
            maxDiscordFiles: config.maxDiscordFiles,
            maxDiscordFileSize: config.maxDiscordFileSize,
            accounts: config.accounts
        } as ClientConfiguration)
    )

    return router
}
