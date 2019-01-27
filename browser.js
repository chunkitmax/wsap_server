const Fs = require('fs')
const Interpreter = require('./wapi_interpreter')
const Selenium = require('selenium-webdriver'),
      Builder = Selenium.Builder,
      By = Selenium.By,
      Until = Selenium.until


class Browser {

  constructor() {
    this.browser = null
    this.funcList = []
    this.interpreter = null
  }
  
  async release() {
    if (this.browser)
      await this.browser.quit()
    this.browser = null
  }

  // QR code should be displayed on WHITE background
  async getQr() {
    if (!await this.checkLogin()) {
      await this.browser.wait(Until.elementLocated(By.css('* img[alt="Scan me!"]')))
      let rememberMe = await this.browser.findElement(By.xpath('//input[@name="rememberMe"]'))
      if (!rememberMe) {
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

  async start() {
    this.browser = await new Builder().forBrowser('firefox')
                                      .usingServer('http://localhost:4444/wd/hub')
                                      .build()
    await this.browser.get('https://web.whatsapp.com/')
    await this.browser.wait(Until.titleIs('WhatsApp'))
    while (true) {
      try {
        if (await this.checkLogin()) {
          await this._routine()
        }
        await this.browser.wait(Until.elementLocated(By.css('#pane-side')), 5000)
      } catch (e) {
        if (this.browser == null)
          break
      }
    }
  }

  async _routine() {
    // wait for side panels (supposed to appear after login)
    await this.browser.wait(Until.elementLocated(By.css('#pane-side')))
    while (!this._injectScript()) {
      if (!await this.checkLogin())
        return;
      this.browser.sleep(5000)
    }
    await this.browser.wait(Until.elementsLocated(By.xpath(`//div[text()="WhatsApp Web"]`)))
  }

  async _injectScript() {
    let wapiScript = Fs.readFileSync('./WAPI.js', 'utf-8')
    await this.browser.executeScript(wapiScript)
    let wapi = JSON.parse(await this.browser.executeScript('return JSON.stringify(Object.keys(window.WAPI))'))
    if (wapi) {
      this.funcList = wapi.filter(v => !v.startsWith('_'))
      this.interpreter = new Interpreter(this.browser, this.funcList)
      return true
    }
    return false
  }

  async checkLogin() {
    try {
      await this.browser.findElement(By.xpath(`//div[text()="WhatsApp Web"]`))
      return false
    } catch (e) {
      return true
    }
  }
}

module.exports = Browser