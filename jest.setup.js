const { TextDecoder: NodeTextDecoder, TextEncoder: NodeTextEncoder } = require('util')

global.TextDecoder = NodeTextDecoder
global.TextEncoder = NodeTextEncoder
