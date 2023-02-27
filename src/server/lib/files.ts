import axios from "axios";
import Discord, { Client, TextBasedChannel } from "discord.js";
import { readFile, writeFile } from "fs";
import { Readable } from "node:stream";
import { files } from "./accounts";

export let id_check_regex = /[A-Za-z0-9_\-\.\!]+/
export let alphanum = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")

// bad solution but whatever

export function generateFileId() {
    let fid = ""
    for (let i = 0; i < 5; i++) {
        fid += alphanum[Math.floor(Math.random()*alphanum.length)]
    }
    return fid
}

export interface FileUploadSettings {
    name?: string,
    mime: string,
    uploadId?: string,
    owner?:string,
    anonymous?:boolean
}

export interface Configuration {
    maxDiscordFiles: number,
    maxDiscordFileSize: number,
    targetGuild: string,
    targetChannel: string,
    requestTimeout: number,
    maxUploadIdLength: number,

    accounts: {
        registrationEnabled: boolean,
        requiredForUpload: boolean
    }
}

export interface FilePointer {
    filename:string,
    mime:string,
    messageids:string[],
    owner?:string,
    sizeInBytes?:number,
    tag?:string,
    anonymous?:boolean
}

export interface StatusCodeError {
    status: number,
    message: string
}

/*  */

export default class Files {

    config: Configuration
    client: Client
    files: {[key:string]:FilePointer} = {}
    uploadChannel?: TextBasedChannel

    constructor(client: Client, config: Configuration) {

        this.config = config;
        this.client = client;

        client.on("ready",() => {
            console.log("Discord OK!")
        
            client.guilds.fetch(config.targetGuild).then((g) => {
                g.channels.fetch(config.targetChannel).then((a) => {
                    if (a?.isTextBased()) {
                        this.uploadChannel = a
                    }
                })
            })
        })

        readFile(process.cwd()+"/.data/files.json",(err,buf) => {
            if (err) {console.log(err);return}
            this.files = JSON.parse(buf.toString() || "{}")
        })

    }
    
    uploadFile(settings:FileUploadSettings,fBuffer:Buffer):Promise<string|StatusCodeError> {
        return new Promise<string>(async (resolve,reject) => {
            if (!this.uploadChannel) {
                reject({status:503,message:"server is not ready - please try again later"})
                return
            }

            if (!settings.name || !settings.mime) {
                reject({status:400,message:"missing name/mime"});
                return
            }

            if (!settings.owner && this.config.accounts.requiredForUpload) {
                reject({status:401,message:"an account is required for upload"});
                return
            }
    
            let uploadId = (settings.uploadId || generateFileId()).toString();
    
            if ((uploadId.match(id_check_regex) || [])[0] != uploadId || uploadId.length > this.config.maxUploadIdLength) {
                reject({status:400,message:"invalid id"});return
            }
            
            if (this.files[uploadId] && (settings.owner ? this.files[uploadId].owner != settings.owner : true)) {
                reject({status:400,message:"you are not the owner of this file id"});
                return
            }

            if (settings.name.length > 128) {
                reject({status:400,message:"name too long"}); 
                return
            }

            if (settings.mime.length > 128) {
                reject({status:400,message:"mime too long"}); 
                return
            }
    
            // get buffer
            if (fBuffer.byteLength >= (this.config.maxDiscordFileSize*this.config.maxDiscordFiles)) {
                reject({status:400,message:"file too large"}); 
                return
            }
            
            // generate buffers to upload
            let toUpload = []
            for (let i = 0; i < Math.ceil(fBuffer.byteLength/this.config.maxDiscordFileSize); i++) {
                toUpload.push(
                    fBuffer.subarray(
                        i*this.config.maxDiscordFileSize,
                        Math.min(
                            fBuffer.byteLength,
                            (i+1)*this.config.maxDiscordFileSize
                        )
                    )
                )
            }
    
            // begin uploading
            let uploadTmplt:Discord.AttachmentBuilder[] = toUpload.map((e) => {
                return new Discord.AttachmentBuilder(e)
                            .setName(Math.random().toString().slice(2))
            })
            let uploadGroups = []
            for (let i = 0; i < Math.ceil(uploadTmplt.length/10); i++) {
                uploadGroups.push(uploadTmplt.slice(i*10,((i+1)*10)))
            }
    
            let msgIds = []
    
            for (let i = 0; i < uploadGroups.length; i++) {

                let ms = await this.uploadChannel.send({
                    files:uploadGroups[i]
                }).catch((e) => {console.error(e)})

                if (ms) {
                    msgIds.push(ms.id)
                } else {
                    reject({status:500,message:"please try again"}); return
                }
            }
    
            // save

            if (settings.owner) {
                files.index(settings.owner,uploadId)
            }

            resolve(await this.writeFile(
                uploadId,
                {
                    filename:settings.name,
                    messageids:msgIds,
                    mime:settings.mime,
                    sizeInBytes:fBuffer.byteLength,

                    owner:settings.owner,
                    anonymous: typeof settings.anonymous == "boolean" ? settings.anonymous : false
                }
            ))
        })
    }
    
    // fs

    writeFile(uploadId: string, file: FilePointer):Promise<string> {
        return new Promise((resolve, reject) => {

            this.files[uploadId] = file
            
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {
                
                if (err) {
                    reject({status:500,message:"please try again"}); 
                    delete this.files[uploadId];
                    return
                }

                resolve(uploadId)
                
            })

        }) 
    }

    // todo: move read code here

    readFileStream(uploadId: string):Promise<{dataStream:Readable,contentType:string,byteSize?:number}> {
        return new Promise(async (resolve,reject) => {
            if (!this.uploadChannel) {
                reject({status:503,message:"server is not ready - please try again later"})
                return
            }

            if (this.files[uploadId]) {
                let file = this.files[uploadId]

                let dataStream = new Readable({
                    read(){}
                })

                resolve({
                    contentType: file.mime,
                    dataStream: dataStream,
                    byteSize: file.sizeInBytes
                })
        
                for (let i = 0; i < file.messageids.length; i++) {
                    let msg = await this.uploadChannel.messages.fetch(file.messageids[i]).catch(() => {return null})
                    if (msg?.attachments) {
                        let attach = Array.from(msg.attachments.values())
                        for (let i = 0; i < attach.length; i++) {
                            let d = await axios.get(attach[i].url,{responseType:"arraybuffer"}).catch((e:Error) => {console.error(e)})
                            if (d) {
                                dataStream.push(d.data)
                            } else {
                                reject({status:500,message:"internal server error"})
                                dataStream.destroy(new Error("file read error"))
                                return
                            }
                        }
                    }
                }

                dataStream.push(null)
                
            } else {
                reject({status:404,message:"not found"})
            }
        })
    }

    unlink(uploadId:string):Promise<void> {
        return new Promise((resolve,reject) => {
            let tmp = this.files[uploadId];
            if (tmp.owner) {
                files.deindex(tmp.owner,uploadId)
            }
            delete this.files[uploadId];
            writeFile(process.cwd()+"/.data/files.json",JSON.stringify(this.files),(err) => {
                if (err) {
                    this.files[uploadId] = tmp
                    reject()
                } else {
                    resolve()
                }
            })

        })
    }

    getFilePointer(uploadId:string):FilePointer {
        return this.files[uploadId]
    }

}
