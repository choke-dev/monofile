// This is monofile.
import monofile from "../../monofile"

const hook: import("./$types").RequestHandler = (req) => {
    console.log("[MONOFILE]", req.request.method, req.url.pathname)
    return monofile.fetch(req.request) ?? console.log("[MONOFILE]", "Returned undefined!")

}

export const GET = hook
export const HEAD = hook
export const POST = hook
export const PUT = hook
export const PATCH = hook
export const DELETE = hook
export const OPTIONS = hook
