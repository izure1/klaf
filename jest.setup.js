const { TextDecoder: NodeTextDecoder, TextEncoder: NodeTextEncoder } = require('util')
const _structuredClone = require('core-js/actual/structured-clone')

global.TextDecoder = NodeTextDecoder
global.TextEncoder = NodeTextEncoder
global.structuredClone = _structuredClone
