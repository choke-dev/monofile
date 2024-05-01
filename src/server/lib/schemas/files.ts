import {z} from "zod"
import config from "../config.js"

export const FileId = z.string()
    .regex(/^[A-Za-z0-9_\-\.\!\=\:\&\$\,\+\;\@\~\*\(\)\']+$/,"file ID uses invalid characters")
    .max(config.maxUploadIdLength,"file ID too long")
    .min(1, "you... *need* a file ID")
export const FileVisibility = z.enum(["public", "anonymous", "private"])
export const FileTag = z.string().toLowerCase().max(30, "tag length too long")
export const FilePointer = z.object({
    filename: z.string().max(256, "filename too long"),
    mime: z.string().max(256, "mimetype too long"),
    messageids: z.array(z.string()),
    owner: z.optional(z.string()),
    sizeInBytes: z.optional(z.number()),
    tag: z.optional(FileTag),
    visibility: z.optional(FileVisibility).default("public"),
    chunkSize: z.optional(z.number()),
    lastModified: z.optional(z.number()),
    md5: z.optional(z.string())
})