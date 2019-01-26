const BodyParser = require('body-parser')
const Ws = require('ws')
const Mongoose = require('mongoose')

const Browser = require('./browser')
const Server = require('./server')


let browser = new Browser()
let server = new Server(browser)

async function main() {
  try {
    await browser.start()
  } finally {
    await browser.release()
  }
}

process.once('beforeExit', () => {
  browser.release()
})
process.once('SIGINT', () => {
  browser.release()
})

if (require.main === module) {
  main()
}
