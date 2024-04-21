// import { defineConfig } from "vite"
// import { svelte } from "@sveltejs/vite-plugin-svelte"
// import autoPreprocess from "svelte-preprocess"
// import { resolve } from "path"
// import devServer from "@hono/vite-dev-server"
// import pkg from "./package.json" assert { type: "json" }

// export default defineConfig({
//     build: {
//         target: "esnext",
//         outDir: "./dist",
//         // assetsDir: "static/vite",
//         // rollupOptions: {
//         //     input: {
//         //         main: resolve(__dirname, "src/index.html"),
//         //         download: resolve(__dirname, "src/download.html"),
//         //         error: resolve(__dirname, "src/error.html"),
//         //     },
//         // },
//     },
//     define: {
//         MONOFILE_VERSION: JSON.stringify(pkg.version),
//     },
//     plugins: [
//         svelte({
//             preprocess: autoPreprocess(),
//         }),
//     ],
// })

import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"
import pkg from "./package.json" assert { type: "json" }

export default defineConfig({
    plugins: [sveltekit()],
    define: {
        MONOFILE_VERSION: JSON.stringify(pkg.version),
    },
})
