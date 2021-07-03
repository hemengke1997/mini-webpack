import type { EntryOptionsType } from "../../types"

import fs from "fs"
import path from "path"
import * as babel from "@babel/core"
import * as tsNode from "ts-node"

import { handleTSPath } from "../../utils"

const { traverse, parse } = babel
const tsc =  tsNode.register({
  compilerOptions: {
    module: "ES2015"
  }
})

// 1. 分析单个模块
function getModuleInfo(filePath: string, options?: EntryOptionsType) {
  // a. 引入文件
  let file = fs.readFileSync(filePath, "utf-8");

  if(options?.ts) {
    
    file = tsc.compile(file, filePath)
    
  }

  // b. 转换语法树AST
  let ast = parse(file, { sourceType: "unambiguous" });

  if(!ast) return

  // c. 收集依赖
  let deps = Object.create(null);
  traverse(ast, {
    ImportDeclaration({ node }) {
      
      if(options?.ts && handleTSPath(node.source.value)) {
        node.source.value = node.source.value + '.ts'
      }
      let p = node.source.value;
      const dirname = path.dirname(filePath);
      const absPath = path.join(dirname, p);
      


      deps[p] = absPath;
    },
  });
  
  // d. es6 转 es5
  const { code } = babel.transformFromAstSync(ast , file, {
    presets: ["@babel/preset-env"],
  }) as babel.BabelFileResult ;
  

  return {
    filePath,
    deps: deps as Record<string, any>,
    code,
  };
}

// 从一个入口文件开始，分析所有的依赖
function parseModules(entry: string, options?: EntryOptionsType) {
  const entryInfo = getModuleInfo(entry, options);

  if(!entryInfo) return

  const fileList = getDeepDeps([entryInfo], entryInfo.deps, options);

  let depsGragh = Object.create(null);
  
  fileList.forEach((f) => {
    depsGragh[f.filePath] = {
      code: f.code,
      deps: f.deps,
    };
  });

  return depsGragh;
}

function getDeepDeps(fileList: Record<string, any>[], deps: Record<string, any>, options?: EntryOptionsType) {
  let _fileList = [...fileList] 
  Object.values(deps).forEach((value) => {
    const info = getModuleInfo(value, options);
    
    if(!info) return
    _fileList.push(info);

    getDeepDeps(_fileList, info.deps, options);
  });

  return _fileList
}


export function bundle(entry: string, options?: EntryOptionsType) {
  const depsGragh = JSON.stringify(parseModules(entry, options));
  return `
    (function(depsGragh){
      function require(filePath) {
        let exports = {};

        function absRequire(path) {
          return require(depsGragh[filePath].deps[path])
        }

        (function(exports, require, code){
          eval(code)
        })(exports, absRequire, depsGragh[filePath].code)

        return exports;
      }
      require('${entry}')
    }(${depsGragh}))
  `;
}
