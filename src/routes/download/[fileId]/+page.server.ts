import * as Accounts from "$lib/accounts"
import { files_singleton as files } from "$lib/files"
import { error } from "@sveltejs/kit"

export const load: import("./$types").PageServerLoad = async ({
    params,
    url,
    cookies,
    request,
}) => {
    const acc = Accounts.getFromToken(cookies.get("auth")!)
    const { fileId } = params
    const host = url.host

    const file = files[fileId]
    if (file) {
        if (file.visibility == "private" && acc?.id != file.owner) {
            throw error(403, "you do not own this file")
        }
        let fileOwner = file.owner ? Accounts.getFromId(file.owner) : undefined
        return {
            embedColor:
                fileOwner?.embed?.color &&
                file.visibility != "anonymous" &&
                request.headers.get("user-agent")?.includes("Discordbot")
                    ? `#${fileOwner.embed.color}`
                    : "rgb(30, 33, 36)",
            mime: file.mime,
            size: file.sizeInBytes,
            filename: file.filename,
            url: `https://${host}/file/${fileId}`,
            owner:
                !file.owner || file.visibility == "anonymous"
                    ? "Anonymous"
                    : `@${fileOwner?.username || "Deleted User"}`,
            visibility: file.visibility,
            largeImage:
                fileOwner?.embed?.largeImage &&
                file.visibility != "anonymous" &&
                file.mime.startsWith("image/"),
            id: fileId,
        }
    } else throw error(404, "file not found")
}

export const csr = false
