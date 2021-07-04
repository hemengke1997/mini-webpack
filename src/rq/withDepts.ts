const fileListWithDeps = {
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
    'deps': {}
  }
};

(function list(fileList) {
  function require(filePath: keyof typeof fileList) {
    let exports = {};
    let _path = fileList[filePath].deps
    function absRequire(path: keyof typeof _path) {
      return require(fileList[filePath].deps[path])
    }
    
    (function(exports, require, code){
      eval(fileList[filePath].code)
    }(exports, absRequire, fileList[filePath].code))
    
  
    return exports;
  }
  require('index.js')
}(fileListWithDeps))