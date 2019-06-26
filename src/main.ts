import Browser from './browser'
import Server from './server'

async function main(): Promise<void> {
  let browser = new Browser()
  let server = new Server(browser)

  process.once('beforeExit', () => {
    browser.release()
  })
  process.once('SIGINT', () => {
    browser.release()
  })
  
  try {
    await browser.start()
  } finally {
    await browser.release()
  }
}

if (require.main === module) {
  main()
}
