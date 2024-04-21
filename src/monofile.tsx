import { Hono } from "hono"
import fs from "fs"
import { readFile } from "fs/promises"
import { files_singleton } from "./lib/files.js"
import { fileURLToPath } from "url"
import { dirname } from "path"
import v0 from "./api/v0/index.js"
import v1 from "./api/v1/index.js"
import preview_and_verify from "./api/web/index.js"

// We need to import config.json at run time because split is a genius. Ideally we would use .env files for this
const config = JSON.parse(
    // Don't use __dirname. For all we know this fyle could be a hashed chunk.
    // Also if this were NixOS you can't modify the built folder after build
    fs.readFileSync(process.cwd() + "/config.json", "utf-8")
)

declare const MONOFILE_VERSION: string // see vite.config.ts
const app = new Hono()

// app.get(
//     "/assets/*",
//     serveStatic({
//         rewriteRequestPath: (path) => {
//             return path.replace("/assets", "/assets")
//         },
//     })
// )

// app.get(
//     "/vite/*",
//     serveStatic({
//         rewriteRequestPath: (path) => {
//             return path.replace("/vite", "/dist/vite")
//         },
//     })
// )

// respond to the MOLLER method
// get it?
// haha...

app.on(["MOLLER"], "*", async (ctx) => {
    ctx.header("Content-Type", "image/webp")
    return ctx.body(await readFile("./assets/moller.png"))
})

//app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))

// check for ssl, if not redirect
if (config.trustProxy) {
    // app.enable("trust proxy")
}
if (config.forceSSL) {
    app.use(async (ctx, next) => {
        if (new URL(ctx.req.url).protocol == "http") {
            return ctx.redirect(
                `https://${ctx.req.header("host")}${
                    new URL(ctx.req.url).pathname
                }`
            )
        } else {
            return next()
        }
    })
}

app.get("/server", (ctx) =>
    ctx.json({
        ...config,
        version: MONOFILE_VERSION,
        files: Object.keys(files.files).length,
    })
)

// funcs

// init data

const __dirname = dirname(fileURLToPath(import.meta.url))
if (!fs.existsSync(__dirname + "/../.data/"))
    fs.mkdirSync(__dirname + "/../.data/")

// discord
let files = files_singleton
globalThis.__files = files // Kill me
v0(app, files)
v1(app, files)
preview_and_verify(app, files)

// moved here to ensure it's matched last
app.get("/:fileId", async (ctx) =>
    app.fetch(
        new Request(
            new URL(
                `/api/v1/file/${ctx.req.param("fileId")}`,
                ctx.req.raw.url
            ).href,
            ctx.req.raw
        ),
        ctx.env
    )
)

console.log("This is monofile.")

export default app
