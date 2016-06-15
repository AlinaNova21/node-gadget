# Node project for managing OTG USB gadgets

Developed with Node 6.2, should work on at least 5+

## Known working devices: 
CHIP (Requires building a kernel with USB gadgets set to use configfs)

## Should work with
	Pi Zero
	Any SoC with OTG and a recent kernel supporting configfs

## Installation
`npm install -g ags131/node-gadget`

## Usage
```
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
```