const fs = require('fs/promises')
const path = require('path')
const { Socket } = require('net')
const { chdir, cwd } = require('process')
const Glob = require('glob')
const { promisify } = require('util')
const { createReadStream, createWriteStream } = require('fs')
const { Duplex } = require('stream')

const glob = promisify(Glob)

const BASE_PATH = '/sys/kernel/config'
const USB_GADGETS_PATH = `${BASE_PATH}/usb_gadget`

class Gadget {
  constructor (opts = {}) {
    const {
      id = '',
      udc = '',
      idVendor = '0x0000',
      idProduct = '0x0000',
      strings = [],
      functions = [],
      configs = []
    } = opts
    this.id = id
    this.udc = udc
    this.idVendor = idVendor
    this.idProduct = idProduct
    this.strings = this.loadStrings(strings)
    this.functions = this.loadFunctions(functions)
    this.configs = this.loadConfigs(configs)
  }

  loadStrings (strings) {
    return strings.map(({ id = '', serialnumber = '', manufacturer = '', product = '', ...extra }) => ({ id, serialnumber, manufacturer, product, ...extra }))
  }

  loadFunctions (functions) {
    return functions.map(({ type = '', id = '', ...other }) => {
      const ret = { type, id, ...other }
      if (type === 'hid') {
        ret.report = ret.report || ''
        if (typeof ret.report === 'string') {
          ret.report = Buffer.from(ret.report, 'hex')
        }
      }
      return ret
    })
  }

  loadConfigs (configs) {
    return configs.map(({ id = '', strings = [], functions = [] }) => ({
      id,
      functions,
      strings: strings.map(({ id = '', configuration = '' }) => ({ id, configuration }))
    }))
  }

  async create () {
    if (!this.id) throw new Error('ID must be set')
    const gadget = path.join(USB_GADGETS_PATH, this.id)
    await fs.mkdir(gadget)
    const origCwd = cwd()
    chdir(gadget)
    await fs.writeFile('idVendor', this.idVendor)
    await fs.writeFile('idProduct', this.idProduct)
    for (const { id, ...props } of this.strings) {
      const sbase = path.join(gadget, 'strings', id)
      await fs.mkdir(sbase)
      for (const [k, v] of Object.entries(props)) {
        if (k === 'id') continue
        await fs.writeFile(path.join(sbase, k), v)
      }
    }
    console.log(this)
    for (const { id, type, report } of this.functions) {
      const fbase = path.join(gadget, 'functions', id)
      await fs.mkdir(fbase)
      if (type === 'hid') {
        await fs.writeFile(path.join(fbase, 'report_desc'), report)
        await fs.writeFile(path.join(fbase, 'report_length'), report.length.toString())
      }
    }
    for (const { id, functions, strings } of this.configs) {
      const cbase = path.join(gadget, 'configs', id)
      await fs.mkdir(cbase)
      for (const func of functions) {
        await fs.symlink(path.join(gadget, 'functions', func), path.join(cbase, func))
      }
      for (const { id, configuration } of strings) {
        const sbase = path.join(cbase, 'strings', id)
        await fs.mkdir(sbase)
        await fs.writeFile(path.join(sbase, 'configuration'), configuration)
      }
    }
    chdir(origCwd)
  }

  async remove () {
    if (!this.id) throw new Error('ID must be set')
    return Gadget.remove(this.id)
  }

  async enable (udc = '') {
    if (!this.id) throw new Error('ID must be set')
    Gadget.enable(this.id, udc)
  }

  async disable () {
    if (!this.id) throw new Error('ID must be set')
    Gadget.disable(this.id)
  }

  static async enable (id, udc = '') {
    if (!id) throw new Error('ID must be set')
    const gadget = path.join(USB_GADGETS_PATH, id)
    if (!udc) {
      console.log('No UDC, assuming auto')
      ;[udc] = await fs.readdir('/sys/class/udc')
    }
    console.log('Using UDC', udc)
    await fs.writeFile(path.join(gadget, 'UDC'), udc)
  }

  static async disable (id) {
    if (!id) throw new Error('ID must be set')
    const gadget = path.join(USB_GADGETS_PATH, id)
    await fs.writeFile(path.join(gadget, 'UDC'), '\n')
  }

  static async create (gadget) {
    const g = new Gadget(gadget)
    await g.create()
    return g
  }

  static async remove (id) {
    if (!id) throw new Error('ID must be set')
    const gadget = path.join(USB_GADGETS_PATH, id)
    const fail = file => e => console.log(`Failed to remove ${file} ${e.message}`)
    await fs.writeFile(path.join(gadget, 'UDC'), '').catch(fail('UDC'))
    for (const dir of ['configs', 'functions', 'strings', '.']) {
      const statCache = {}
      const files = await glob(path.join(gadget, dir, '**/*'), { absolute: true, stat: true, statCache })
      files.reverse()
      for (const file of files) {
        console.log(file)
        try {
          await fs.rmdir(file)
        } catch (e) {
          await fs.unlink(file).catch(fail(file))
        }
      }
    }
    await fs.rmdir(gadget).catch(fail(gadget))
  }

  async getHIDStream (name) {
		if (this.str) return this.str
    let ind = name
    if (typeof name === 'string') {
      const devices = this.functions.filter(f => f.id.type === 'hid')
      ind = devices.findIndex(f => f.id.split('.')[1] === name)
    }
    ind = ind || 0
    const path = `/dev/hidg${ind}`

    // const fh = await fs.open(path, 'r+')
    // const str = new Socket({ fd: fh.df })
		// str.on('close', e => console.log('close', e))
		// str.on('error', e => console.log('error', e))
		// this.fh = fh
		// this.str = str
    // return str
    // return es.duplex(writestr,readstr)
    const readStr = createReadStream(path)
    const writeStr = createWriteStream(path)
    const str = new Duplex({
      write (chunk, encoding, cb) {
        writeStr.write(chunk, encoding, cb)
      },
      read (size) {
        readStr.read(size)
      }
    })
		this.str = str
		return str
  }
}

module.exports = { default: Gadget, Gadget }
