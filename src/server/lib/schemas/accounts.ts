import {z} from "zod"
import { FileVisibility } from "./files.js"

export const StringPassword = z.string().min(8,"password must be at least 8 characters")
export const Password =
    z.object({
        hash: z.string(),
        salt: z.string()
    })
export const Username =
    z.string().min(3, "username too short").max(20, "username too long").regex(/[A-Za-z0-9_\-\.]+/, "username contains invalid characters")
export const Account =
    z.object({
        id: z.string(),
        username: Username,
        email: z.optional(z.string().email("must be an email")),
        password: Password,
        files: z.array(z.string()),
        admin: z.boolean(),
        defaultFileVisibility: FileVisibility
    })