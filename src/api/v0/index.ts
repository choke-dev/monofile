import { Hono } from "hono"
import type Files from "../../lib/files.js"
import primaryApi from "./primaryApi.js"
import adminRoutes from "./adminRoutes.js"
import authRoutes from "./authRoutes.js"
import fileApiRoutes from "./fileApiRoutes.js"

export default function install(root: Hono, files: Files) {
    const router = new Hono()
    router.route("/", primaryApi(files, root))
    router.route("/admin", adminRoutes(files))
    router.route("/auth", authRoutes(files))
    router.route("/files", fileApiRoutes(files))
    root.route("/", router)
}
