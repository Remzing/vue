/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  //! 真正的编译过程都在这个 `baseCompile` 函数里执行
  //! r005 01 解析模板字符串生成 AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    //! r005 02 优化语法树
    optimize(ast, options)
  }
  //! r005 03 生成代码
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
