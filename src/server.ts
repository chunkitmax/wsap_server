import BodyParser from 'body-parser';
import Express, { Application, Response } from 'express';
import Browser from './browser';
import Interpreter from './wapi_interpreter';

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
     * @api {get} /is/loggedin Check if logged in
     * @apiName isLoggedin
     * @apiGroup Auth
     *
     * @apiSuccess {Boolean} status true if logged in
     */
    this.app.get('/is/login', async (_, res) => {
      res.json({
        'status': await this.browser.checkLogin()
      })
    })

    /**
     * @api {get} /qr Get QR code
     * @apiName GetQr
     * @apiGroup Auth
     * 
     * @apiParam (Query) {Boolean} [base64=false] false - return PNG buffer, true - return Base64 string
     * 
     * @apiSuccess {Any} image content type will be application/base64 if bas64 is true, otherwise image/png
     *
     * @apiError {Buffer} Empty buffer with conten type image/png
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
     * @api {get} /chats/unread Get Chat objects having unread messages
     * @apiName GetUnread
     * @apiGroup Chat
     * 
     * @apiSuccess {Boolean} success
     * @apiSuccess {Chat[]} chats array of chat object **unread messages in array chats[i].messages
     *
     * @apiError {Boolean} success
     * @apiError {String} reason
     */
    this.app.get('/chats/unread', async (_,res) => {
      try {
        if (await this.isReady()) {
          this.resSuccess(res, { chats: await this.browser.interpreter!.call('getUnreadMessages', true, true, 1000) })
          return
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    /**
     * @api {get} /chats Get Chat objects
     * @apiName GetChats
     * @apiGroup Chat
     * 
     * @apiParam (Query) {Boolean} [isGroup=false] whether only return groups
     * @apiParam (Query) {String} [name] search by name
     * 
     * @apiSuccess {Boolean} success
     * @apiSuccess {Chat[]} chats array of chat object
     *
     * @apiError {Boolean} success
     * @apiError {String} reason
     */
    this.app.get('/chats', async (req, res) => {
      let isGroup = (req.query && req.query.isGroup) || false
      let name = (req.query && req.query.name) || null
      try {
        if (!await this.isReady()) {
          this.resFailure(res, 'browser not ready')
        } else  {
          let ret = await this.browser.interpreter!.call('getAllChats') as Array<any>
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
     * @api {post} /send/seen/:id Send seen signals
     * @apiName SendSeen
     * @apiGroup Message
     * 
     * @apiParam (Param) {String} id chat id
     * 
     * @apiSuccess {Boolean} success
     *
     * @apiError {Boolean} success
     * @apiError {String} reason
     */
    this.app.post('/send/seen/:id', async (req, res) => { 
      try {
        let chatId = req.params.id!
        if (!await this.isReady()) {
          this.resFailure(res, 'browser not ready')
        } else {
          if (await this.browser.interpreter!!.call(chatId)) {
            this.resSuccess(res, null)
          } else {
            this.resFailure(res, 'api call failed')
          }
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })

    /**
     * @api {post} /send/msg/:id Send & check message
     * @apiName SendMessage
     * @apiGroup Message
     * 
     * @apiParam (Param) {String} id chat id
     * 
     * @apiParam (Data) {String} msg message body
     * 
     * @apiSuccess {Boolean} success
     * @apiSuccess {Message} msgObj
     *
     * @apiError {Boolean} success
     * @apiError {String} reason
     */
    this.app.post('/send/msg/:id', async (req, res) => {
      try {
        let chatId = req.body.id!
        let msg = req.body.msg!
        if (!await this.isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (chatId && msg) {
          let ret = await this.browser.interpreter!.callAsync('sendMessage', chatId, msg)
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
     * @api {get} /send/:id/:op? Get messages
     * @apiName GetMessage
     * @apiGroup Message
     * 
     * @apiParam (Param) {String} id chat id
     * @apiParam (Param) {String="more"} [op] operation more - load more messages
     * 
     * @apiParam (Query) {Boolean} [includeMe=true]
     * @apiParam (Query) {Boolean} [includeNoti=true]
     * 
     * @apiSuccess {Boolean} success
     * @apiSuccess {Message[]} msgs
     *
     * @apiError {Boolean} success
     * @apiError {String} reason
     */
    this.app.get('/msgs/:id/:op?', async (req, res) => {
      let id = (req.params && req.params.id) || null
      let op = (req.params && req.params.op) || null
      let includeMe = (req.query && req.query.includeMe) || true
      let includeNoti = (req.query && req.query.includeNoti) || true
      try {
        if (!await this.isReady()) {
          this.resFailure(res, 'browser not ready')
        } else if (id) {
          if (typeof op === 'string' && op.toLowerCase() == 'more') {
            await this.browser.interpreter!.callAsync('loadEarlierMessages', id)
          }
          this.resSuccess(res, { msgs: await this.browser.interpreter!.call('getAllMessagesInChat', id, includeMe, includeNoti) })
        } else {
          this.resFailure(res, 'invalid id')
        }
      } catch (err) {
        this.resFailure(res, err)
      }
    })
  }

  private resSuccess(res: Response, obj: object|null) {
    res.json({
      success: true,
      ...obj
    })
  }

  private resFailure(res: Response, reason: Error|string) {
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

  private async isReady(): Promise<boolean> {
    return this.browser.interpreter !== undefined && (await this.browser.interpreter.call('isLoggedIn') as boolean)
  }
}
