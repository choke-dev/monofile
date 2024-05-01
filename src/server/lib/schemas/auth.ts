import {z} from "zod"

export const TokenType = z.enum(["App", "User"])
export const TokenPermission = z.enum([
    "user", // permissions to /auth/me, with email docked
    "email", // adds email back to /auth/me
    "private", // allows app to read private files
    "upload", // allows an app to upload under an account
    "manage", // allows an app to manage an account's files
    "customize", // allows an app to change customization settings
    "admin", // only available for accounts with admin
    // gives an app access to all admin tools
])
const BaseToken = z.object({
    sub: z.string(),
    purpose: TokenType
})
export const JwtPayload = z.discriminatedUnion(
    "purpose",
    [
        BaseToken.extend({purpose: z.literal("User")}),
        BaseToken.extend({purpose: z.literal("App"), permissions: z.array(TokenPermission).default(['user'])})
    ]
)