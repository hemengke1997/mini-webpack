webpack实现对多文件的打包压缩。并实现了自己的require，在浏览器中兼容cjs的引用写法。

# Require

## 实现

这里有引用关系的两个文件，`index.js`和`add.js`

```js
// index.js
const add = require('add.js').default
add(3,33)

// add.js
exports.default = function add(a, b) { console.log(a * b) }
```

在这里`require`和`export`两个关键词是`node.js`环境下支持的，在浏览器环境下并不具备。我们要自己进行实现：

```js
// add.js
let exports = {}
exports.default = function add(a, b) { console.log(a * b) }
return exports

// index.js
// 在引用的时候，相当于执行了被引用的文件，所以获取了它return的结果，也就是exports

const addExports = require('add.js')
const add = addExports.default
```

那么对于简单的一对一的引用，我们可以通过一个立即执行函数来实现浏览器中的`require`

```tsx
(function list(fileList) {
  function require(filePath: keyof typeof fileList) {
    let exports = {};
  
    eval(fileList[filePath])
  
    return exports;
  }
  require('index.js')
}({
  'index.js':`
    const add = require('add.js').default
    add(3,33)
  `,
  'add.js': `
    exports.default = function add(a, b) { console.log(a * b) }
  `
}))
```

简单来说就是对于每一个被引用的文件，执行再返回自己`exports`的部分。

## 结构优化

但是正常的引用关系应该是树形，应当是这个结构：

```js
const fileList = {
  'index.js': {
    'code': `
      const add = require('add.js').default
      add(3,33)
    `,
    'deps': {
      'add.js': {
        'code': `
        exports.default = function add(a, b) { console.log(a * b) }
        `
      }
    }
  }
}
```

`add.js`作为deps被收集在`index.js`中。

但这样的结构，在`add.js`被多个文件引用的时候，难以避免去打包多次。相互引用也变得难以处理。所以我们转变思路。

把绝对路径存在`deps`中，凡是被引用的文件都以绝对路径为key存放在fileList中。这样就避免了多层嵌套的结构，使其扁平化。也就是这样

```js
const fileList = {
  'index.js': {
    'code': `
      const add = require('add.js').default
      add(3,33)
    `,
    'deps': {
      'add.js': 'add.js'
    }
  },
  'add.js': {
    'code': `
    exports.default = function add(a, b) { console.log(a * b) }
    `,
    'depts': {}
  }
}
```

这样就使文件在关系中始终是唯一的。保证了它的唯一性。

这时我们需要修改一下嵌套访问时的require方法：

```js
    let _path = fileList[filePath].deps
    
    function absRequire(path: keyof typeof _path) {
      return require(fileList[filePath].deps[path])
    }
    
    (function(exports, require, code){
      eval(fileList[filePath].code)
    }(exports, absRequire, fileList[filePath].code))
```

这样当我们在内层访问require时，就会跳出嵌套，从最外层访问文件。

自己实现的require方法属于一种垫片处理。通过这个方法我们能使浏览器读懂node下的require逻辑。

# Webpack

## 实现

这里我们准备三个文件：

```js
// add.js
import test from './test.js'
test()
export default function(a,b) {console.log(a + b)}

// index.js
import add from './add.js'
import test from './test.js'
test()
add(1,3)

// test.js
export default function() { console.log(2) }
```

引用关系是

- `index`引用了`add`和`test`
- `add`引用了`test`

不存在相互引用。但是`add`和`index`都引用了同一个`test`，也就是存在了多次引用。

### 依赖处理

在调用`webpack`的时候我们会提供一个`entry`作为入口，然后根据这个入口进行收集依赖。我们这里定义一个方法用来根据入口分析所有的依赖。

在分析所有的依赖前，我们需要先分析入口文件的依赖。我们希望返回的结果是

- 文件绝对路径，作为唯一标识
- 文件依赖
- 代码字符串

用`fs`得到入口文件的字符串：

```tsx
let file = fs.readFileSync(filePath, "utf-8");
```

接着我们要使用`babel`对`import`语法模块进行分析，拿到依赖关系。并且顺路使用`babel`的`preset`包进行降级，使`import`语法转化为`require`，这样就可以使用我们实现的`require`对文件进行打包了。

```tsx
let ast = parse(file, { sourceType: "unambiguous" });

// 拿到依赖关系，以相对路径为key，绝对路径为value
let deps = Object.create(null);
  traverse(ast, {
    ImportDeclaration({ node }) {
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
  
```

最后将我们想要的结果进行返回

```tsx
  return {
    filePath,
    deps: deps as Record<string, any>,
    code,
  };
```

然后我们开始分析剩余模块

```tsx
function parseModules(entry: string) {
  const entryInfo = getModuleInfo(entry); // 拿到入口文件信息
}
```

分析剩余模块是反复分析deps里面的绝对路径的文件，然后push到所有模块信息内的过程。这样就可以实现我们require中扁平化的数据结构。

这里我们写一个递归方法

```tsx
function getDeepDeps(fileList: Record<string, any>[], deps: Record<string, any>) {
  let _fileList = [...fileList] 
  Object.values(deps).forEach((value) => {
    const info = getModuleInfo(value, options);
    
    if(!info) return
    _fileList.push(info);

    getDeepDeps(_fileList, info.deps, options);
  });

  return _fileList
}
```

我们把所有模块信息作为第一个参数，把要分析的deps作为第二个参数，这样就可以把所有文件都进行分析，然后return出来。

我们在parseModules中调用它：

```tsx
function parseModules(entry: string) {
  const entryInfo = getModuleInfo(entry);

  if(!entryInfo) return

  const fileList = getDeepDeps([entryInfo], entryInfo.deps);
}
```

此时我们fileList的结构是这样的

```tsx
const fileList = [
  {
    filePath: './index.js',
    deps: {
      './add.js': 'src/add.js'
    },
    code: `xxxx`
  }
]
```

我们要把他们转化为这样

```tsx
const fileList = {
  './index.js': {
    code: "xxx",
    deps: {
      './add.js': 'src/add.js'
    }
  }
}
```

做一下转化：

```tsx
  let depsGragh = Object.create(null);
  
  fileList.forEach((f) => {
    depsGragh[f.filePath] = {
      code: f.code,
      deps: f.deps,
    };
  });

  return depsGragh;
```

这样我们就导出了`require`方法需要的结构类型，传入进去即可。

```tsx
export function bundle(entry: string) {
  // 因为depsGragh不能直接转化为字符串，所以要先使用srtingify方法转化。
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
```

这样我们就实现了小小`webpack`。

### typescript解析支持

- ts文件在引用文件时会省略后缀名，这会使我们的`fs`无法正确引入文件。
- ts文件需要转化。

如果没有后缀名，我们会在`babel`解析路径的时候给他添加上。

ts文件的转化通过引入`ts-node`进行：

```tsx
import * as tsNode from "ts-node"

const tsc =  tsNode.register({
  compilerOptions: {
    module: "ES2015" // 需要指定我们使用的是ES module
  }
})

file = tsc.compile(file, filePath)
```

