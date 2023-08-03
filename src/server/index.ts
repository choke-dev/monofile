import bodyParser from "body-parser"
import multer, {memoryStorage} from "multer"
import cookieParser from "cookie-parser";
import Discord, { IntentsBitField, Client } from "discord.js"
import express from "express"
import fs, { link } from "fs"
import axios, { AxiosResponse } from "axios"
import bytes from "bytes";

import ServeError from "./lib/errors"
import Files from "./lib/files"
import * as auth from "./lib/auth"
import * as Accounts from "./lib/accounts"

import { authRoutes, auth_setFilesObj } from "./routes/authRoutes";
import { fileApiRoutes, setFilesObj } from "./routes/fileApiRoutes";
import { adminRoutes, admin_setFilesObj } from "./routes/adminRoutes";
import { Range } from "range-parser";

require("dotenv").config()

const multerSetup = multer({storage:memoryStorage()})
let pkg = require(`${process.cwd()}/package.json`)
let app = express()
let config = require(`${process.cwd()}/config.json`)

app.use("/static/assets",express.static("assets"))
app.use("/static/style",express.static("out/style"))
app.use("/static/js",express.static("out/client"))

//app.use(bodyParser.text({limit:(config.maxDiscordFileSize*config.maxDiscordFiles)+1048576,type:["application/json","text/plain"]}))
app.use(cookieParser())

app.use("/auth",authRoutes)
app.use("/admin",adminRoutes)
app.use("/files",fileApiRoutes)
// funcs

// init data

if (!fs.existsSync(__dirname+"/../.data/")) fs.mkdirSync(__dirname+"/../.data/")



// discord

let client = new Client({intents:[
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
],rest:{timeout:config.requestTimeout}})

let files = new Files(client,config)

setFilesObj(files)
auth_setFilesObj(files)
admin_setFilesObj(files)

// routes (could probably make these use routers)

// index, clone

app.get("/", function(req,res) {
    res.sendFile(process.cwd()+"/pages/index.html")
})

// upload handlers

app.post("/upload",multerSetup.single('file'),async (req,res) => {
    if (req.file) {
        try {
            let prm = req.header("monofile-params")
            let params:{[key:string]:any} = {}
            if (prm) {
                params = JSON.parse(prm)
            }

            files.uploadFile({
                owner: auth.validate(req.cookies.auth),

                uploadId:params.uploadId,
                name:req.file.originalname,
                mime:req.file.mimetype
            },req.file.buffer)
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })
        } catch {
            res.status(400)
            res.send("[err] bad request")
        }
    } else {
        res.status(400)
        res.send("[err] bad request")
    }
})

app.post("/clone", bodyParser.json({type: ["text/plain","application/json"]}) ,(req,res) => {
    try {
        axios.get(req.body.url,{responseType:"arraybuffer"}).then((data:AxiosResponse) => {

            files.uploadFile({
                owner: auth.validate(req.cookies.auth),

                name:req.body.url.split("/")[req.body.url.split("/").length-1] || "generic",
                mime:data.headers["content-type"],
                uploadId:req.body.uploadId
            },Buffer.from(data.data))
                .then((uID) => res.send(uID))
                .catch((stat) => {
                    res.status(stat.status);
                    res.send(`[err] ${stat.message}`)
                })

        }).catch((err) => {
            console.log(err)
            res.status(400)
            res.send(`[err] failed to fetch data`)
        })
    } catch {
        res.status(500)
        res.send("[err] an error occured")
    }
})

// serve files & download page

app.get("/download/:fileId",(req,res) => {
    if (files.getFilePointer(req.params.fileId)) {
        let file = files.getFilePointer(req.params.fileId)

        if (file.visibility == "private" && Accounts.getFromToken(req.cookies.auth)?.id != file.owner) {
            ServeError(res,403,"you do not own this file")
            return
        }

        fs.readFile(process.cwd()+"/pages/download.html",(err,buf) => {
            let fileOwner = file.owner ? Accounts.getFromId(file.owner) : undefined;
            if (err) {res.sendStatus(500);console.log(err);return}
            res.send(
                buf.toString()
                .replace(/\$FileId/g,req.params.fileId)
                .replace(/\$Version/g,pkg.version)
                .replace(/\$FileSize/g,file.sizeInBytes ? bytes(file.sizeInBytes) : "[File size unknown]")
                .replace(/\$FileName/g,
                    file.filename
                        .replace(/\&/g,"&amp;")
                        .replace(/\</g,"&lt;")
                        .replace(/\>/g,"&gt;")
                )
                .replace(/\<\!\-\-metaTags\-\-\>/g,
                    (
                        file.mime.startsWith("image/") 
                        ? `<meta name="og:image" content="https://${req.headers.host}/file/${req.params.fileId}" />` 
                        : (
                            file.mime.startsWith("video/")
                            ? (
                                `<meta property="og:video:url" content="https://${req.headers.host}/cpt/${req.params.fileId}/video.${file.mime.split("/")[1] == "quicktime" ? "mov" : file.mime.split("/")[1]}" />
                                <meta property="og:video:secure_url" content="https://${req.headers.host}/cpt/${req.params.fileId}/video.${file.mime.split("/")[1] == "quicktime" ? "mov" : file.mime.split("/")[1]}" />
                                <meta property="og:type" content="video.other">
                                <!-- honestly probably good enough for now -->
                                <meta property="twitter:image" content="0">`
                                // quick lazy fix as a fallback
                                // mayeb i'll improve this later, but probably not.
                                + ((file.sizeInBytes||0) >= 26214400 ? `
                                <meta property="og:video:width" content="1280">
                                <meta property="og:video:height" content="720">` : "")
                            )
                            : ""
                        )
                    )
                    + (
                        fileOwner?.embed?.largeImage && file.visibility!="anonymous"
                        ? `<meta name="twitter:card" content="summary_large_image">`
                        : ""
                    )
                    + `\n<meta name="theme-color" content="${fileOwner?.embed?.color && file.visibility!="anonymous" && (req.headers["user-agent"]||"").includes("Discordbot") ? `#${fileOwner.embed.color}` : "rgb(30, 33, 36)"}">`
                )
                .replace(/\<\!\-\-preview\-\-\>/g,
                    file.mime.startsWith("image/") 
                    ? `<div style="min-height:10px"></div><img src="/file/${req.params.fileId}" />` 
                    : (
                        file.mime.startsWith("video/")
                        ? `<div style="min-height:10px"></div><video src="/file/${req.params.fileId}" controls></video>`
                        : (
                            file.mime.startsWith("audio/")
                            ? `<div style="min-height:10px"></div><audio src="/file/${req.params.fileId}" controls></audio>`
                            : ""
                        )
                    )
                )
                .replace(/\$Uploader/g,!file.owner||file.visibility=="anonymous" ? "Anonymous" : `@${fileOwner?.username || "Deleted User"}`)
            )
        })
    } else {
        ServeError(res,404,"file not found")
    }
})

app.get("/server",(req,res) => {
    res.send(JSON.stringify({
        ...config,
        version:pkg.version,
        files:Object.keys(files.files).length
    }))
})

app.get(["/file/:fileId", "/cpt/:fileId/*", "/:fileId"], async (req:express.Request,res:express.Response) => {
    
    let file = files.getFilePointer(req.params.fileId)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Security-Policy","sandbox allow-scripts")
    if (req.query.attachment == "1") res.setHeader("Content-Disposition", "attachment")
    
    if (file) {
        
        if (file.visibility == "private" && Accounts.getFromToken(req.cookies.auth)?.id != file.owner) {
            ServeError(res,403,"you do not own this file")
            return
        }

        let range: Range | undefined

        res.setHeader("Content-Type",file.mime)
        if (file.sizeInBytes) {
            res.setHeader("Content-Length",file.sizeInBytes)
            
            if (file.chunkSize) {
                let rng = req.range(file.sizeInBytes)
                if (rng) {

                    // error handling
                    if (typeof rng == "number") {
                        res.status(rng == -1 ? 416 : 400).send()
                        return
                    }
                    if (rng.type != "bytes") {
                        res.status(400).send();
                        return
                    }

                    // set ranges var
                    let rngs = Array.from(rng)
                    if (rngs.length != 1) { res.status(400).send(); return }
                    range = rngs[0]
                    
                }
            }
        }

        // supports ranges
        

        files.readFileStream(req.params.fileId, range).then(async stream => {

            if (range) {
                res.status(206)
                res.header("Content-Length", (range.end-range.start + 1).toString())
                res.header("Content-Range", `bytes ${range.start}-${range.end}/${file.sizeInBytes}`)
            }
            stream.pipe(res)
            
        }).catch((err) => {
            ServeError(res,err.status,err.message)
        })

    } else {
        ServeError(res, 404, "file not found")
    }
    
})

app.head(["/file/:fileId", "/cpt/:fileId/*", "/:fileId"], (req: express.Request, res:express.Response) => {
    let file = files.getFilePointer(req.params.fileId)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Content-Security-Policy","sandbox allow-scripts")
    if (req.query.attachment == "1") res.setHeader("Content-Disposition", "attachment")
    if (!file) {
        res.status(404)
        res.send()
    } else {
        res.setHeader("Content-Type",file.mime)
        if (file.sizeInBytes) {
            res.setHeader("Content-Length",file.sizeInBytes)
        }
        if (file.chunkSize) {
            res.setHeader("Accept-Ranges", "bytes")
        }
    }
})

/*
    routes should be in this order:
    
    index
    api
    dl pages
    file serving
*/

// listen on 3000 or MONOFILE_PORT

app.listen(process.env.MONOFILE_PORT || 3000,function() {
    console.log("Web OK!")
})

client.login(process.env.TOKEN)