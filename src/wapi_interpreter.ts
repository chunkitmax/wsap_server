import Assert from 'assert';
import { WebDriver } from 'selenium-webdriver';

export default class Interpreter {

  private browser: WebDriver
  private apiList: Array<string> = []

  constructor(browser: WebDriver, apiList: Array<string>) {
    this.browser = browser
    this.apiList = apiList
  }

  private to_script(args: any): string {
    return args.map((v: any) => {
      if (typeof(v) == 'string') {
        return `"${v}"`
      } else {
        return v.toString()
      }
    }).join(',')
  }

  public async call(funcName: string, ...args: Array<any>): Promise<Object|Array<any>> {
    Assert(this.apiList.indexOf(funcName) >= 0)
    return JSON.parse(await this.browser.executeScript(`
      return JSON.stringify(window.WAPI.${funcName}(${this.to_script(args)}))
    `))
  }

  public async callAsync(funcName: string, ...args: Array<any>): Promise<Object|Array<any>> {
    Assert(this.apiList.indexOf(funcName) >= 0)
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
