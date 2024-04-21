import { writable } from "svelte/store"
//import type Pulldown from "./pulldowns/Pulldown.svelte"
import type { SvelteComponent } from "svelte"
import type { Account } from "../../lib/accounts"
import type { FilePointer } from "../../lib/files"

type cfg = {
    maxDiscordFiles: number
    maxDiscordFileSize: number
    targetChannel: string
    requestTimeout: number
    maxUploadIdLength: number
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
    }
    trustProxy: boolean
    forceSSL: boolean
}

export let refreshNeeded = writable(false)
export let pulldownManager = writable<SvelteComponent>()
export let account = writable<
    (Account & { sessionCount: number; sessionExpires: number }) | undefined
>()
export let serverStats = writable<
    (cfg & { version: string; files: number }) | undefined
>()
export let files = writable<(FilePointer & { id: string })[]>([])

export let fetchAccountData = function () {
    fetch("/auth/me")
        .then(async (response) => {
            if (response.status == 200) {
                account.set(await response.json())
            } else {
                account.set(undefined)
            }
        })
        .catch((err) => {
            console.error(err)
        })
}

export let fetchFilePointers = function () {
    fetch("/files/list", { cache: "no-cache" })
        .then(async (response) => {
            if (response.status == 200) {
                files.set(await response.json())
            } else {
                files.set([])
            }
        })
        .catch((err) => {
            console.error(err)
        })
}

export let refresh_stats = () => {
    fetch("/server")
        .then(async (data) => {
            serverStats.set(await data.json())
        })
        .catch((err) => {
            console.error(err)
        })
}

fetchAccountData()
