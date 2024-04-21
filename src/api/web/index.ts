import { Hono } from "hono"
import type Files from "../../lib/files.js"
import go from "./go.js"
export default function install(root: Hono, files: Files) {
    const router = new Hono()
    router.route("/go", go(files))
    root.route("/api/v1", router)
}
