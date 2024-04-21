import { Hono } from "hono"
import account from "./account.js"
import session from "./session.js"
import file from "./file/index.js"
import individual from "./file/individual.js"
import type Files from "../../lib/files.js"

export default function install(root: Hono, files: Files) {
    const router = new Hono()
    router.route("/account", account(files))
    router.route("/session", session(files))
    router.route("/file", file(files)) // /file API
    router.route("/file", individual(files, root)) // /file/:id
    root.route("/api/v1", router)
}
