const Express = require('express')
const BodyParser = require('body-parser')


class Server {
  
  constructor(browser, port=8080) {
    this.browser = browser
    this.app = Express()
    this.app.use(BodyParser.json())
    this.app.use(BodyParser.urlencoded({ extended: true }))
    this._initApp()
    this.app.listen(port)
  }

  _initApp() {
    this.app.get('/qr', async (req, res) => {
      let retBase64 = (req.query && !!req.query.base64) || false
      let ret = await this.browser.getQr()
      if (ret) {
        ret = ret.split('base64,')[1]
        if (retBase64) {
          res.setHeader('Content-Type', 'application/base64')
          res.end(ret)
        } else {
          res.setHeader('Content-Type', 'image/png')
          let buf = Buffer.from(ret, 'base64')
          res.end(buf)
        }
      } else {
        res.setHeader('Content-Type', 'image/png')
        res.end(Buffer.from(""))
      }
    })

    this.app.get('/chats', async (req, res) => {
      let isGroup = (req.query && req.query.isGroup) || false
      let name = (req.query && req.query.name) || null
      try {
        if (!await this._isReady()) {
          this.resFailure(res, 'browser not ready')
        } else {
          let ret = await this.browser.interpreter.call('getAllChats')
          if (name) {
            ret = ret.filter(v => v.name === name)
          }
          if (isGroup) {
            ret = ret.filter(v => v.isGroup)
          }
          this.resSuccess(res, { chats: ret })
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    this.app.get('/chats/unread', async (_,res) => {
      try {
        if (await this._isReady()) {
          this.resSuccess(res, { chats: await this.browser.interpreter.call('getUnreadMessages', true, true, 1000) })
          return
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    this.app.post('/send/seen', async (req, res) => {
      let chatId = (req.body && req.body.id) || null
      try {
        if (!await this._isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (chatId) {
          if (await this.browser.interpreter.call(chatId)) {
            this.resSuccess(res, null)
          } else {
            this.resFailure(res, 'api call failed')
          }
        } else {
          this.resFailure(res, 'invalid chat id')
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    this.app.post('/send/msg', async (req, res) => {
      let chatId = (req.body && req.body.id) || null
      let msg = (req.body && req.body.msg) || null
      try {
        if (!await this._isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (chatId && msg) {
          let ret = await this.browser.interpreter.callAsync('sendMessage', chatId, msg)
          if (typeof (ret) != 'boolean' && ret) {
            this.resSuccess(res, { msgObj: ret })
          } else if (ret) {
            this.resFailure(res, 'failed (after 30 attempts)')
          } else {
            this.resFailure(res, 'cannot find chat obj')
          }
        } else {
          this.resFailure(res, 'invalid id/msg')
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    this.app.get('/msgs/:id/:op?', async (req, res) => {
      let id = (req.params && req.params.id) || null
      let op = (req.params && req.params.op) || null
      let includeMe = (req.query && req.query.includeMe) || true
      let includeNoti = (req.query && req.query.includeNoti) || true
      try {
        if (!await this._isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (id) {
          if (op == 'more') {
            await this.browser.interpreter.callAsync('loadEarlierMessages', id)
          }
          this.resSuccess(res, { msgs: await this.browser.interpreter.call('getAllMessagesInChat', id, includeMe, includeNoti) })
        } else {
          this.resFailure(res, 'invalid id')
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })
  }

  resSuccess(res, obj) {
    res.json({
      success: true,
      ...obj
    })
  }

  resFailure(res, reason) {
    if (typeof reason === 'object') {
      if (reason.stack) {
        res.json({
          success: false,
          reason: reason.stack
        })
      } else {
        res.json({
          succes: false,
          ...reason
        })
      }
    } else {
      res.json({
        success: false,
        reason
      })
    }
  }

  async _isReady() {
    return !!this.browser.interpreter && await this.browser.interpreter.call('isLoggedIn')
  }
}

module.exports = Server
