import "dotenv/config"

export interface Configuration {
    port: number
    requestTimeout: number
    trustProxy: boolean
    forceSSL: boolean
    discordToken: string
    maxDiscordFiles: number
    maxDiscordFileSize: number
    maxUploadIdLength: number
    targetGuild: string
    targetChannel: string
    accounts: {
        registrationEnabled: boolean
        requiredForUpload: boolean
    }
    mail: {
        transport: {
            host: string
            port: number
            secure: boolean
        }
        send: {
            from: string
        }
        user: string
        pass: string
    }
}

export interface ClientConfiguration {
    version: string
    files: number
    maxDiscordFiles: number
    maxDiscordFileSize: number
    accounts: {
        registrationEnabled: boolean
        requiredForUpload: boolean
    }
}

export default {
    port: Number(process.env.PORT),
    requestTimeout: Number(process.env.REQUEST_TIMEOUT),
    trustProxy: process.env.TRUST_PROXY === "true",
    forceSSL: process.env.FORCE_SSL === "true",
    discordToken: process.env.DISCORD__TOKEN,
    maxDiscordFiles: Number(process.env.MAX__DISCORD_FILES),
    maxDiscordFileSize: Number(process.env.MAX__DISCORD_FILE_SIZE),
    maxUploadIdLength: Number(process.env.MAX__UPLOAD_ID_LENGTH),
    targetGuild: process.env.TARGET__GUILD,
    targetChannel: process.env.TARGET__CHANNEL,
    accounts: {
        registrationEnabled:
            process.env.ACCOUNTS__REGISTRATION_ENABLED === "true",
        requiredForUpload: process.env.ACCOUNTS__REQUIRED_FOR_UPLOAD === "true",
    },

    mail: {
        transport: {
            host: process.env.MAIL__HOST,
            port: Number(process.env.MAIL__PORT),
            secure: process.env.MAIL__SECURE === "true",
        },
        send: {
            from: process.env.MAIL__SEND_FROM,
        },
        user: process.env.MAIL__USER,
        pass: process.env.MAIL__PASS,
    },
} as Configuration
