
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
      require('./example/ts/index.ts')
    }({"./example/ts/index.ts":{"code":"\"use strict\";\n\nvar _add = _interopRequireDefault(require(\"./add.ts\"));\n\nvar _test = _interopRequireDefault(require(\"./test.ts\"));\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\n\n(0, _test[\"default\"])();\n(0, _add[\"default\"])(1, 3);","deps":{"./add.ts":"example\\ts\\add.ts","./test.ts":"example\\ts\\test.ts"}},"example\\ts\\add.ts":{"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports[\"default\"] = _default;\n\nvar _test = _interopRequireDefault(require(\"./test.ts\"));\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\n\n(0, _test[\"default\"])();\n\nfunction _default(a, b) {\n  console.log('靓仔');\n}","deps":{"./test.ts":"example\\ts\\test.ts"}},"example\\ts\\test.ts":{"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports[\"default\"] = _default;\n\nfunction _default() {\n  console.log(2);\n}","deps":{}}}))
  