// EXTREME BANDAID SOLUTION
//
// SHOULD BE FIXED IN SVELTEKIT REWRITE

import web from "./web/api.json" assert { type: "json" }
import v0 from "./v0/api.json" assert { type: "json" }
import v1 from "./v1/api.json" assert { type: "json" }

export default [web, v0, v1]
