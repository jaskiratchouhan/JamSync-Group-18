import fs from "fs";
import spec from "./swagger.ts"

fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
console.log("Wrote openapi.json");