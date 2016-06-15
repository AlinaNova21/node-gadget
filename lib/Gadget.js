const fs = require('fs')
const path = require('path')
const async = require('async')
const rimraf = require('rimraf')

const base = '/sys/kernel/config'
const usb_gadgets = `${base}/usb_gadget`

class Gadget {
	constructor(opts){
		opts = opts || {}
		this.opts = opts
		this.id = opts.id || ''
		this.udc = opts.udc || ''
		this.idVendor = opts.idVendor || '0x0000'
		this.idProduct = opts.idProduct || '0x0000'
		this.strings = this.loadStrings(opts.strings)
		this.functions = this.loadFunctions(opts.functions)
		this.configs = this.loadConfigs(opts.configs)
	}

	loadStrings(strings){
		return strings.map(s=>{
			s.id = s.id || ''
			s.serialnumber = s.serialnumber || ''
			s.manufacturer = s.manufacturer || ''
			s.product = s.product || ''
			return s
		})
	}

	loadFunctions(functions){
		return functions.map(f=>{
			f.type = f.type || ''
			f.name = f.name || ''
			if(f.type == 'hid')
			{
				f.report = f.report || ''
				if(typeof f.report == 'string')
					f.report = new Buffer(f.report,'hex')
			}
			return f
		})
	}

	loadConfigs(configs){
		return configs.map(c=>{
			c.id = c.id || ''
			c.strings = c.strings.map(s=>{
				s.id = s.id || ''
				s.configuration = s.configuration || ''
				return s
			})
			c.functions = c.functions || []
			return c
		})
	}

	create(cb){
		if(!this.id) return cb('ID must be set')
		const gadget = path.join(usb_gadgets,this.id)
		var batch = new FSBatch()
		batch.mkdir(gadget)
		batch.setBase(gadget)
		batch.writeFile('idVendor',this.idVendor)
		batch.writeFile('idProduct',this.idProduct)
		this.strings.forEach(s=>{
			var sbase = path.join(gadget,'strings',s.id)
			batch.mkdir(sbase)
			batch.setBase(sbase)
			for(var k in s){
				if(k == 'id') continue
				batch.writeFile(k,s[k])
			}
		})
		batch.setBase(gadget)
		this.functions.forEach(f=>{
			var fbase = path.join(gadget,'functions',f.id)
			batch.mkdir(fbase)
			batch.setBase(fbase)
			if(f.type == 'hid')
			{
				batch.writeFile('report_desc',f.report)
				batch.writeFile('report_length',f.report.length)
			}
		})
		this.configs.forEach(c=>{
			var cbase = path.join(gadget,'configs',c.id)
			batch.mkdir(cbase)
			batch.setBase(cbase)
			c.functions.forEach(f=>{
				batch.symlink(path.join(gadget,'functions',f),path.join(cbase,f))
			})
			c.strings.forEach(s=>{
				var sbase = path.join(cbase,'strings',s.id)
				batch.mkdir(sbase)
				batch.setBase(sbase)
				for(var k in s){
					if(k == 'id') continue
					batch.writeFile(k,s[k])
				}
			})
			
		})
		batch.setBase(gadget)
		// batch.writeFile('UDC',this.udc)
		batch.apply(cb)
	}

	remove(cb){
		if(!this.id) return cb('ID must be set')
		Gadget.remove(this.id,cb)
	}

	enable(udc,cb){
		if(!this.id) return cb('ID must be set')
		if(typeof udc == 'function' && typeof cb == 'undefined') {
			cb = udc
			udc = this.udc || ''
		}
		Gadget.enable(this.id,udc,cb)
	}

	disable(cb){
		if(!this.id) return cb('ID must be set')
		Gadget.disable(this.id,cb)
	}

	static enable(id,udc,cb){
		if(!id) return cb('ID must be set')
		const gadget = path.join(usb_gadgets,id)
		if(!udc) {
			console.log('No UDC, assuming auto')
			return fs.readdir('/sys/class/udc',(err,files)=>Gadget.enable(id,files[0],cb))
		}
		console.log('Using UDC',udc)
		fs.writeFile(path.join(gadget,'UDC'),udc,(err)=>cb(err))
	}

	static disable(id,cb){
		if(!id) return cb('ID must be set')
		const gadget = path.join(usb_gadgets,id)
		fs.writeFile(path.join(gadget,'UDC'),"\n",(err)=>cb(err))
	}

	static create(gadget,cb){
		var g = new Gadget(gadget)
		g.create(cb)
	}

	static remove(id,cb){
		if(!id) return cb('ID must be set')
		const gadget = path.join(usb_gadgets,id)
		var batch = new FSBatch('gadget')
		batch.setBase(gadget)
		batch.writeFile('UDC','')
		batch.readdir('configs',(configs,cb)=>{
			let batch = new FSBatch('configs')
			configs.forEach(c=>{
				c = path.join(gadget,'configs',c)
				batch.setBase(c)
				batch.readdir('strings',(strings,cb)=>{
					let batch = new FSBatch('config/strings')
					batch.setBase(path.join(c,'strings'))
					strings.forEach(s=>batch.rmdir(s))
					batch.apply(cb)
				})
				batch.readdir(c,(files,cb)=>{
					let batch = new FSBatch('config')
					batch.setBase(path.join(c))
					files.filter(f=>f != 'MaxPower' && f != 'bmAttributes' && f != 'strings')
						.forEach(f=>batch.unlink(f))
					batch.apply(cb)
				})
				batch.rmdir(c)
			})
			batch.apply(cb)
		})
		batch.readdir('functions',(functions,cb)=>{
			let batch = new FSBatch('functions')
			batch.setBase(path.join(gadget,'functions'))
			functions.forEach(s=>batch.rmdir(s))
			batch.apply(cb)
		})
		batch.readdir('strings',(strings,cb)=>{
			let batch = new FSBatch('strings')
			batch.setBase(path.join(gadget,'strings'))
			strings.forEach(s=>batch.rmdir(s))
			batch.apply(cb)
		})
		batch.rmdir(gadget)
		batch.apply(cb)
	}
	
	getHIDStream(name){
		let ind = name;
		if(typeof name == 'string'){
			let devices = this.functions.filter(f=>f.id.type == 'hid')
			ind = devices.findIndex(f=>f.id.split('.')[1] == name)
		}
		ind = ind || 0
		let path = `/dev/hidg${ind}`
		let readstr  = fs.createReadStream(path)
   		let writestr = fs.createWriteStream(path)
		return es.duplex(writestr,readstr)
	}
}

module.exports = Gadget

class FSBatch {
	constructor(opts){
		if(typeof opts == 'string'){
			this.name = opts;
			opts = {}
		}
		this.opts = opts || {}
		this.base = this.opts.base || ''
		this.queue = []
	}

	setBase(base){
		console.log('setBase',base)
		this.base = base
	}

	mkdir(file){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('mkdir',file)
			fs.mkdir(file,(err)=>cb())
		})
	}

	rmdir(file){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('rmdir',file)
			fs.rmdir(file,(err)=>cb())
		})
	}

	link(tgt,file,data){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('link',tgt,file)
			fs.link(tgt,file,(err)=>cb())
		})
	}

	symlink(tgt,file,data){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('symlink',tgt,file)
			fs.symlink(tgt,file,(err)=>cb())
		})
	}

	unlink(file,data){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('unlink',file)
			fs.unlink(file,(err)=>cb())
		})
	}

	writeFile(file,data){
		if(this.base && file[0] != '/') file = path.join(this.base,file)
		this.queue.push((cb)=>{
			console.log('writeFile',file)
			fs.writeFile(file,data,(err)=>cb())
		})
	}

	readdir(dir,ucb){
		if(this.base && dir[0] != '/') dir = path.join(this.base,dir)
		this.queue.push((cb)=>{
			console.log('readdir',dir)
			fs.readdir(dir,(err,files)=>err?cb(err):ucb(files,cb))
		})
	}

	apply(cb){
		console.log('apply',this.name || '')
		async.series(this.queue,(...args)=>{
			console.log('complete',this.name || '')
			cb(...args)
		})
	}
}

/*
#!/bin/bash
cd /sys/kernel/config/usb_gadget
mkdir g1
cd g1
echo "0x0E6F" > idVendor
echo "0x0241" > idProduct

mkdir strings/0x409
echo "P.D.P.000000" > strings/0x409/serialnumber
echo "PDP LIMITED. " > strings/0x409/manufacturer
echo "LEGO READER V2.10" > strings/0x409/product

mkdir functions/hid.g0
echo 32 > functions/hid.g0/report_length
echo -ne "\x06\x00\xFF\x09\x01\xA1\x01\x19\x01\x29\x20\x15\x00\x26\xFF\x00\x75\x08\x95\x20\x81\x00\x19\x01\x29\x20\x91\x00\xC0" > functions/hid.g0/report_desc
#mkdir functions/acm.g1
#mkdir functions/ecm.g2

mkdir configs/c.1
mkdir configs/c.1/strings/0x409
echo "LEGO READER V2.10" > configs/c.1/strings/0x409/configuration 
ln -s functions/hid.g0/ configs/c.1/
#ln -s functions/acm.g1/ configs/c.1/
#ln -s functions/ecm.g2/ configs/c.1/
UDC=$(ls /sys/class/udc)
rmmod libcomposite g_ether u_ether usb_f_rndis
sleep 3;
echo "$UDC" > UDC
*/