import {z} from "zod"
import { FileId, FileVisibility } from "./files.js"

export const StringPassword = z.string().min(8,"password must be at least 8 characters")
export const Password =
    z.object({
        hash: z.string(),
        salt: z.string()
    })
export const Username =
    z.string()
        .min(3, "username too short")
        .max(20, "username too long")
        .regex(/^[A-Za-z0-9_\-\.]+$/, "username contains invalid characters")

export namespace Settings {
    export const Theme = z.discriminatedUnion("theme", [
        z.object({
            theme: z.literal("catppuccin"),
            variant: z.enum(["latte","frappe","macchiato","mocha","adaptive"]),
            accent: z.enum([
                "rosewater",
                "flamingo",
                "pink",
                "mauve",
                "red",
                "maroon",
                "peach",
                "yellow",
                "green",
                "teal",
                "sky",
                "sapphire",
                "blue",
                "lavender"
            ])
        }),
        z.object({
            theme: z.literal("custom"),
            id: FileId
        })
    ])
    export const BarSide = z.enum(["top","left","bottom","right"])
    export const Interface = z.object({
        theme: Theme.default({theme: "catppuccin", variant: "adaptive", accent: "sky"}),
        barSide: BarSide.default("left")
    })
    export const Links = z.object({
        color: z.string().toLowerCase().length(6).regex(/^[a-f0-9]+$/,"illegal characters").optional(),
        largeImage: z.boolean().default(false)
    })
    export const User = z.object({
        interface: Interface.default({}), links: Links.default({})
    })
}
export const Suspension =
    z.object({
        reason: z.string(),
        until: z.number().nullable()
    })
export const Account =
    z.object({
        id: z.string(),
        username: Username,
        email: z.optional(z.string().email("must be an email")),
        password: Password,
        files: z.array(z.string()),
        admin: z.boolean(),
        defaultFileVisibility: FileVisibility,

        settings: Settings.User,
        suspension: Suspension.optional()
    })