(function list(fileList) {
  function require(filePath) {
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