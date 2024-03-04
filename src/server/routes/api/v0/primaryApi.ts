import bodyParser from "body-parser"
import { Hono } from "hono"

import * as Accounts from "../../../lib/accounts.js"
import * as auth from "../../../lib/auth.js"
import RangeParser, { type Range } from "range-parser"
import ServeError from "../../../lib/errors.js"
import Files, { WebError } from "../../../lib/files.js"
import { getAccount, requiresPermissions } from "../../../lib/middleware.js"
import FormDataParser, { Field } from "../../../lib/formdata.js"
import {Readable} from "node:stream"
import {ReadableStream as StreamWebReadable} from "node:stream/web"
export let primaryApi = new Hono<{
    Variables: {
        account: Accounts.Account
    }
}>()

primaryApi.use(getAccount)

export default function (files: Files) {
    primaryApi.get(
        "/file/:fileId",
        async (ctx): Promise<Response> => {
            const fileId = (ctx.req.param() as {fileId: string}).fileId

            let acc = ctx.get("account") as Accounts.Account

            let file = files.files[fileId]
            ctx.header("Access-Control-Allow-Origin", "*")
            ctx.header("Content-Security-Policy", "sandbox allow-scripts")
            ctx.header("Content-Disposition", `${ctx.req.query("attachment") == "1" ? "attachment" : "inline"}; filename="${file.filename.replaceAll("\n","\\n")}"`)

            if (file) {
                if (file.visibility == "private") {
                    if (acc?.id != file.owner) {
                        return ServeError(ctx, 403, "you do not own this file")
                    }

                    if (
                        auth.getType(auth.tokenFor(ctx)!) == "App" &&
                        auth
                            .getPermissions(auth.tokenFor(ctx)!)
                            ?.includes("private")
                    ) {
                        return ServeError(ctx, 403, "insufficient permissions")
                    }
                }

                let range: Range | undefined

                ctx.header("Content-Type", file.mime)
                if (file.sizeInBytes) {
                    ctx.header("Content-Length", file.sizeInBytes.toString())

                    if (file.chunkSize && ctx.req.header("Range")) {
                        let ranges = RangeParser(file.sizeInBytes, ctx.req.header("Range") || "")

                        if (ranges) {
                            if (typeof ranges == "number")
                                return ServeError(ctx, ranges == -1 ? 416 : 400, ranges == -1 ? "unsatisfiable ranges" : "invalid ranges")
                            if (ranges.length > 1) return ServeError(ctx, 400, "multiple ranges not supported")
                            range = ranges[0]
                        }
                    }
                }

                return files
                    .readFileStream(fileId, range)
                    .then(async (stream) => {
                        if (range) {
                            ctx.status(206)
                            ctx.header(
                                "Content-Length",
                                (range.end - range.start + 1).toString()
                            )
                            ctx.header(
                                "Content-Range",
                                `bytes ${range.start}-${range.end}/${file.sizeInBytes}`
                            )
                        }

                        return ctx.req.method == "HEAD" ? ctx.body(null) : ctx.stream(async (webStream) => {
                            webStream.pipe(Readable.toWeb(stream) as ReadableStream).catch(e => {}) // emits an AbortError for some reason so this catches that
                        })
                    })
                    .catch((err) => {
                        return ServeError(ctx, err.status, err.message)
                    })
            } else {
                return ServeError(ctx, 404, "file not found")
            }
        }
    )
    // upload handlers

    primaryApi.post(
        "/upload",
        requiresPermissions("upload"),
        (ctx) => { return new Promise((resolve,reject) => {
            let acc = ctx.get("account") as Accounts.Account

            if (!ctx.req.header("Content-Type")?.startsWith("multipart/form-data")) {
                ctx.status(400)
                resolve(ctx.body("[err] must be multipart/form-data"))
            }

            if (!ctx.req.raw.body) {
                ctx.status(400)
                resolve(ctx.body("[err] body must be supplied"))
            }

            let file = files.createWriteStream(acc.id)
            let formDataParser = new FormDataParser('')
            
            Readable.fromWeb(ctx.req.raw.body as StreamWebReadable)
                .pipe(formDataParser)
                .on("data", async (field: Field) => {
                    if (field.headers["content-disposition"]?.filename) {
                        field.pipe(file)
                    } else {
                        switch(field.headers["content-disposition"]?.name) {
                            case "uploadId":
                                file.setUploadId((await field.collect(65536).catch(e => {formDataParser.destroy(new WebError(413, e.message))}))?.toString() || "")
                        }
                    }
                })
                .on("end", async () => {
                    if (!file.writableEnded) await new Promise((res, rej) => {file.once("finish", res); file.once("error", res)})
                    if (file.errored || !(await file.commit().catch(e => file.error = e))) {
                        ctx.status(file.error instanceof WebError ? file.error.statusCode : 500)
                        resolve(`[err] ${file.error instanceof WebError ? file.error.message : file.error?.toString()}`)
                        return
                    }
                    
                    resolve(ctx.body(file.uploadId!))
                })
        })}
    )
/*
    primaryApi.post(
        "/clone",
        requiresPermissions("upload"),
        async ctx => {
            let acc = ctx.get("account") as Accounts.Account

            try {
                return axios
                    .get(req.body.url, { responseType: "arraybuffer" })
                    .then((data: AxiosResponse) => {
                        files
                            .uploadFile(
                                {
                                    owner: acc?.id,
                                    filename:
                                        req.body.url.split("/")[
                                            req.body.url.split("/").length - 1
                                        ] || "generic",
                                    mime: data.headers["content-type"],
                                    uploadId: req.body.uploadId,
                                },
                                Buffer.from(data.data)
                            )
                            .then((uID) => res.send(uID))
                            .catch((stat) => {
                                res.status(stat.status)
                                res.send(`[err] ${stat.message}`)
                            })
                    })
                    .catch((err) => {
                        console.log(err)
                        return res.text(`[err] failed to fetch data`, 400)
                    })
            } catch {
                return ctx.text("[err] an error occured", 500)
            }
        }
    )
    */
    return primaryApi
}
