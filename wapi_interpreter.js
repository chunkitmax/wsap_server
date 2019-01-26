const Assert = require('assert')

class Interpreter {

  constructor(browser, apiFuncs) {
    this.browser = browser
    this.apiFuncs = apiFuncs
  }

  to_script(args) {
    return args.map(v => {
      if (typeof(v) == 'string') {
        return `"${v}"`
      } else {
        return v.toString()
      }
    }).join(',')
  }

  async call(funcName, ...args) {
    Assert(this.apiFuncs.indexOf(funcName) >= 0)
    return JSON.parse(await this.browser.executeScript(`
      return JSON.stringify(window.WAPI.${funcName}(${this.to_script(args)}))
    `))
  }

  async callAsync(funcName, ...args) {
    Assert(this.apiFuncs.indexOf(funcName) >= 0)
    try {
      return await this.browser.executeAsyncScript(`
        return JSON.stringify(window.WAPI.${funcName}(${[this.to_script(args), 'arguments[arguments.length - 1]'].join(',')}))
      `)
    } catch (e) {
      console.error(e)
      return false
    }
  }
}

module.exports = Interpreter
