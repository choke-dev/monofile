import { Hono } from "hono"
import Files from "../../../lib/files.js"

const router = new Hono()

module.exports = function (files: Files) {
    return router
}
