import * as Accounts from "$lib/accounts"
import * as auth from "$lib/auth.js"
import { error } from "@sveltejs/kit"
import RangeParser from "range-parser"
import { files_singleton as files } from "$lib/files"

const get: import("./$types").RequestHandler = async ({
    params,
    cookies,
    request,
    url,
}) => {
    const { fileId } = params
    const token =
        cookies.get("auth") ??
        (request.headers.get("authorization")?.startsWith("Bearer ")
            ? request.headers.get("authorization")?.split(" ")[1]
            : undefined)!
    const account = Accounts.getFromToken(token)

    const file = files.files[fileId]
    if (!file) throw error(404, "file not found")
    const lastModified = new Date(file.lastModified)
    if (file.visibility == "private") {
        if (account?.id != file.owner) {
            throw error(403, "you do not own this file")
        }

        if (
            auth.getType(token) == "App" &&
            auth.getPermissions(token)?.includes("private")
        ) {
            throw error(403, "insufficient permissions")
        }
    }
    let range: RangeParser.Range | undefined
    if (file.chunkSize && request.headers.get("range")) {
        let ranges = RangeParser(
            file.sizeInBytes,
            request.headers.get("range") || ""
        )
        if (ranges) {
            if (typeof ranges == "number")
                throw error(416, "unsatisfiable ranges")
            if (ranges.length > 1)
                throw error(400, "multiple ranges not supported")
            range = ranges[0]
        }
    }

    let stream: ReadableStream | undefined
    if (request.method == "HEAD") {
        stream = undefined
    } else {
        stream = files.readFileStream(fileId, range)
    }

    return new Response(stream, {
        status: range ? 206 : 200,
        headers: {
            "Content-Length": file.sizeInBytes,
            ...(range && {
                "Content-Length": (range.end - range.start + 1).toString(),
                "Content-Range": `bytes ${range.start}-${range.end}/${file.sizeInBytes}`,
            }),
            "Content-Type": file.mime,
            ETag: file.md5,
            "Content-Disposition": `${
                url.searchParams.get("attachment") == "1"
                    ? "attachment"
                    : "inline"
            }; filename="${encodeURI(file.filename.replaceAll("\n", "\\n"))}"`,
            "Access-Control-Allow-Origin": "*",
            "Content-Security-Policy": "sandbox allow-scripts",
            // TERRIFYING
            "Last-Modified":
                `${
                    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                        lastModified.getUTCDay()
                    ]
                }, ${lastModified.getUTCDate()} ` +
                `${
                    [
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec",
                    ][lastModified.getUTCMonth()]
                }` +
                ` ${lastModified.getUTCFullYear()} ${lastModified
                    .getUTCHours()
                    .toString()
                    .padStart(2, "0")}` +
                `:${lastModified
                    .getUTCMinutes()
                    .toString()
                    .padStart(2, "0")}:${lastModified
                    .getUTCSeconds()
                    .toString()
                    .padStart(2, "0")} GMT`,
        },
    })
}

export const GET = get
export const HEAD = get
