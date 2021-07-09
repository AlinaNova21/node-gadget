#!/usr/local/bin/node
const fs = require('fs/promises')
const parseArgs = require('minimist')
const { Gadget } = require('../lib/Gadget')

const opts = parseArgs(process.argv.slice(2))

const map = {
  help,
  create,
  remove,
  enable,
  disable
}
Object.keys(map).forEach(k => {
  map[k[0]] = map[k]
})

if (process.getuid()) {
  console.log('Root privileges needed, are you missing sudo?')
  if (opts.h || opts.help) help()
  process.exit()
}

let ran = false
for (const k in opts) {
  const func = map[k]
  if (func) func(opts[k], ...opts._).catch(console.error)
  ran |= !!func
}
if (!ran) help()

function help () {
  console.log(`
        Gadget Helper
        Usage: gadget <options> args

        libcomposite module MUST be loaded.
          sudo modprobe libcomposite

        Options:
            -h --help               this help 
            -c --create jsonfile    create gadget
            -r --remove id          remove gadget
            -e --enable id <udc>    enable gadget
            -d --disable id         disable gadget

        Types:
            jsonfile    file containing gadget config
            id          id of gadget
            udc         name of udc device (Automatic if omitted)
  `.replace(/^ {8}/gm, ''))
}

async function create (file) {
  const json = JSON.parse(await fs.readFile(file, 'utf8'))
  await Gadget.create(json)
  console.log('Created')
}

async function remove (id) {
  await Gadget.remove(id)
  console.log('Removed')
}

async function enable (id, udc) {
  await Gadget.enable(id, udc)
  console.log('Enabled')
}

async function disable (id) {
  await Gadget.disable(id)
  console.log('Disabled')
}
