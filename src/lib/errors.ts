import { readFile } from "fs/promises"
import type { Context } from "hono"
import type { StatusCode } from "hono/utils/http-status"

import errorPage from "../error.html?raw"

/**
 * @description Serves an error as a response to a request with an error page attached
 * @param ctx Express response object
 * @param code Error code
 * @param reason Error reason
 */
export default async function ServeError(
    ctx: Context,
    code: number = 500,
    reason: string
) {
    // serve error
    return ctx.req.header("accept")?.includes("text/html")
        ? ctx.html(
              errorPage
                  .replaceAll("%sveltekit.status%", code.toString())
                  .replaceAll("%sveltekit.error.message%", reason),
              code as StatusCode /*,
        {
            "x-backup-status-message": reason, // glitch default nginx configuration
        }*/
          )
        : ctx.text(reason, code as StatusCode)
}
