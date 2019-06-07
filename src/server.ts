import BodyParser from 'body-parser';
import Express, { Application } from 'express';
import Browser from './browser';

export default class Server {

  private browser: Browser
  private app: Application
  
  constructor(browser: Browser, port=8080) {
    this.browser = browser
    this.app = Express()
    this.app.use(BodyParser.json())
    this.app.use(BodyParser.urlencoded({ extended: true }))
    this.initApp()
    this.app.listen(port)
  }

  private initApp() {
    /**
     * Check if whatsapp is logged in
     * 
     * Return:
     *    status: boolean
     */
    this.app.get('/is/login', async (_, res) => {
      res.json({
        'status': await this.browser.checkLogin()
      })
    })

    /**
     * Get QR code before login
     * 
     * Endpoint:
     *    <server url>/qr
     * Query:
     *    base64: boolean (default: false - return PNG, true - return Base64 String)
     * Return:
     *    (base64)? Base64 string : PNG buffer
     *      ** return empty buffer if logged in (please check content length)
     */
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

    /**
     * Get Chat objects
     * 
     * Endpoint:
     *    <server url>/chats
     * Query:
     *    isGroup: boolean (default: false, true - only return groups)
     *    name: string (default: null, any - search by name)
     * Return:
     *    success: boolean
     *    reason: string / object (undefined if succeed)
     *    chats: array of chat object (undefined if failed)
     */
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

    /**
     * Get Chat objects having unread messages
     * 
     * Endpoint:
     *    <server url>/chats/unread
     * Return:
     *    success: boolean
     *    reason: string / object (undefined if succeed)
     *    chats: array of chat object (undefined if failed)
     *      ** unread messages in array chats[i].messages
     */
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

    /**
     * Send seen signals
     * 
     * Endpoint:
     *    <server url>/send/seen
     * Data:
     *    id: string    chat id
     * Return:
     *    success: boolean
     *    reason: string / object (undefined if succeed)
     */
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

    /**
     * Send & check message (w/ 30 attempts)
     * 
     * Endpoint:
     *    <server url>/send/msg
     * Data:
     *    id: string    chat id
     *    msg: string   message body
     * Return:
     *    success: boolean
     *    reason: string / object (undefined if succeed)
     *    msgObj: msg object (undefined if failed)
     */
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

    /**
     * Get messages
     * 
     * Endpoint:
     *    <server url>/msgs/:id/:op?
     * Param:
     *    id: string    chat id
     *    op: string    operation [more - load more messages]
     * Query:
     *    includeMe: boolean (default: true)
     *    includeNoti: boolean (default: true)
     * Return:
     *    success: boolean
     *    reason: string / object (undefined if succeed)
     *    msgs: array of message object (undefined if failed)
     */
    this.app.get('/msgs/:id/:op?', async (req, res) => {
      let id = (req.params && req.params.id) || null
      let op = (req.params && req.params.op) || null
      let includeMe = (req.query && req.query.includeMe) || true
      let includeNoti = (req.query && req.query.includeNoti) || true
      try {
        if (!await this._isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (id) {
          if (typeof op === 'strings' && op.toLowerCase() == 'more') {
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
