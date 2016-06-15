# Node project for managing OTG USB gadgets

## Requirements
* Recent kernel with configfs support 4.0 or higher recommended
* libcomposite module loaded
* Node 5+
* A supported device with a OTG port
It MAY run on node 4.2+, but has not been tested.

## Supported devices:
### Tested 
* CHIP (Requires building a kernel with USB gadgets set to use configfs)
* Pi Zero

### Untested
* Any SoC with OTG and a recent kernel supporting configfs

## Installation
### CLI
`npm install -g ags131/node-gadget`

### Module
`npm install ags131/node-gadget`

## Usage
### CLI
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

### Module API
#### Gadget class
`const { Gadget } = require('node-gadget')`

##### Gadget(config)
config is a JSON object. See Examples for example jsons

#### Methods
##### create(cb)
Creates the gadget on the system
Does not enable the gadget

##### remove(cb)
Removes the gadget

##### enable(udc,cb)
enables the gadget with the provided udc
udc can be left undefined to automatically select the default udc

##### disable(cb)
Disables the gadget
This does not remove it from the system

#### Static Methods
##### create(config,cb)
Creates the gadget on the system from the config
Does not enable the gadget

##### remove(id,cb)
Removes the gadget

##### enable(id,udc,cb)
enables the gadget using the provided udc
udc can be left undefined to automatically select the default udc

##### disable(id,cb)
Disables the gadget
This does not remove it from the system

##### getHIDStream(name || index)
returns a Duplex stream for the HID Device.
NOTE: this assumes linux creates the /dev/hidg* devices in the right order, 
more than one HID device may screw with this.