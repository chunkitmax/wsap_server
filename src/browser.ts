import Fs from 'fs';
import { Builder, By, until as Until, WebDriver } from 'selenium-webdriver';

import Interpreter from './wapi_interpreter';

export default class Browser {

  private browser?: WebDriver | null
  private funcList: Array<string> = []
  public interpreter?: Interpreter | null
  
  public async release(): Promise<void> {
    if (this.browser)
      await this.browser.quit()
    this.browser = null
  }

  // QR code should be displayed on WHITE background
  public async getQr(): Promise<string | null> {
    if (this.browser && !await this.checkLogin()) {
      await this.browser.wait(Until.elementLocated(By.css('* img[alt="Scan me!"]')))
      let rememberMe = await this.browser.findElement(By.xpath('//input[@name="rememberMe"]'))
      if (!rememberMe.isSelected) {
        rememberMe.click()
      }
      try {
        (await this.browser.findElement(By.xpath(`//div[text()="Click to reload QR code"]`))).click()
        await this.browser.wait(async driver => {
          try {
            await driver.findElement(By.xpath(`//div[text()="Click to reload QR code"]`))
            return false
          } catch (e) {
            return true
          }
        })
      } catch (e) {}
      let qrImg = await this.browser.findElement(By.css('* img[alt="Scan me!"]'))
      return (await qrImg.getAttribute('src'))
    } else {
      return null
    }
  }

  public async start(): Promise<void> {
    this.browser = await new Builder().forBrowser('firefox')
                                      .usingServer('http://localhost:4444/wd/hub')
                                      .build()
    await this.browser.get('https://web.whatsapp.com/')
    await this.browser.wait(Until.titleIs('WhatsApp'))
    while (true) {
      try {
        if (await this.checkLogin()) {
          await this.routine()
        }
        await this.browser.wait(Until.elementLocated(By.css('#pane-side')), 5000)
      } catch (e) {
        if (this.browser == null)
          break
      }
    }
  }

  private async routine(): Promise<void> {
    if (this.browser) {
      // wait for side panels (supposed to appear after login)
      await this.browser.wait(Until.elementLocated(By.css('#pane-side')))
      while (!this.injectScript()) {
        if (!await this.checkLogin())
          return;
        this.browser.sleep(5000)
      }
      await this.browser.wait(Until.elementsLocated(By.xpath(`//div[text()="WhatsApp Web"]`)))
    } else {
      throw new Error('Browser has not been initialized')
    }
  }

  private async injectScript() {
    if (this.browser) {
      let wapiScript = Fs.readFileSync('./WAPI.js', 'utf-8')
      await this.browser.executeScript(wapiScript)
      let wapi = JSON.parse(await this.browser.executeScript('return JSON.stringify(Object.keys(window.WAPI))')) as Array<any>
      if (wapi) {
        this.funcList = wapi.filter(v => !v.startsWith('_'))
        this.interpreter = new Interpreter(this.browser, this.funcList)
        return true
      }
      return false
    } else {
      throw new Error('Browser has not been initialized')
    }
  }

  public async checkLogin() {
    try {
      if (this.browser) {
        await this.browser.findElement(By.xpath(`//div[text()="WhatsApp Web"]`))
        return false
      } else {
        return false
      }
    } catch (e) {
      return true
    }
  }
}