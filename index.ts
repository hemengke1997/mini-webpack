import fs from "fs"

import { bundle } from "./src/webpack";

const content = bundle("./example/ts/index.ts", {
  ts: true
});


!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", content);