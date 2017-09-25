import EventEmitter from 'events'
import { decode as b58Decode } from 'bs58'

import parseKeys from './keys/parse'
import IPFS from './ipfs'
import authToken from './auth-token'
import CRDT from './crdt'
import Auth from './auth'

class Backend extends EventEmitter {
  constructor (options) {
    super()
    this._options = options
    this.room = new EventEmitter()
    this.ipfs = IPFS(options.ipfs)
  }

  async start () {
    const options = this._options
    // Keys
    this._keys = await parseKeys(b58Decode(options.readKey), options.writeKey && b58Decode(options.writeKey))

    // if IPFS node is not online yet, delay the start until it is
    if (!this.ipfs.isOnline()) {
      this.ipfs.once('ready', this.start.bind(this))
      return
    }

    const token = await authToken(this.ipfs, this._keys)
    this.auth = Auth(this._keys, this.room)
    this.crdt = await CRDT(this._options.readKey, token, this._keys, this.ipfs, this.room, this.auth)
    this._observer = this.auth.observer()
    this.crdt.share.access.observeDeep(this._observer)

    this.emit('started')
  }

  stop () {
    this.crdt.share.access.unobserve(this._observer)
    this._observer = null
  }
}

export default Backend