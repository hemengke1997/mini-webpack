// @babel/parser  @babel/traverse @babel/core @babel/preset-env
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

// 1. 分析单个模块
function getModuleInfo(filePath) {
  // a. 引入文件
  const file = fs.readFileSync(filePath, "utf-8");

  // b. 转换语法树AST
  const ast = parser.parse(file, { sourceType: "module" });

  // c. 收集依赖
  let deps = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const p = node.source.value;
      const dirname = path.dirname(filePath);
      const absPath = path.join(dirname, p);

      deps[p] = absPath;
    },
  });

  // d. es6 转 es5
  const { code } = babel.transformFromAstSync(ast, "", {
    presets: ["@babel/preset-env"],
  });

  return {
    filePath,
    deps,
    code,
  };
}

// 从一个入口文件开始，分析所有的依赖
function parseModules(entry) {
  const entryInfo = getModuleInfo(entry);

  const fileList = [entryInfo];

  getDeepDeps(fileList, entryInfo.deps);

  let depsGragh = {};

  fileList.forEach((f) => {
    depsGragh[f.filePath] = {
      code: f.code,
      deps: f.deps,
    };
  });

  return depsGragh;
}

function getDeepDeps(fileList, deps) {
  Object.keys(deps).forEach((key) => {
    const info = getModuleInfo(deps[key]);
    fileList.push(info);
    getDeepDeps(fileList, info.deps);
  });
}



function bundle(entry) {
  const depsGragh = JSON.stringify(parseModules(entry));

  return `
    (function(depsGragh){
      function require(filePath) {
        let exports = {};
  
        function absRequire(path) {
          return require(depsGragh[filePath].deps[path])
        }
        
    
        (function (exports, require, code) {
          eval(code);
        })(exports, absRequire, depsGragh[filePath].code);
    
        return exports;
      }
      require('${entry}')
    }(${depsGragh}))
  `;
}

const content = bundle("./src/index.js");

!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", content);
