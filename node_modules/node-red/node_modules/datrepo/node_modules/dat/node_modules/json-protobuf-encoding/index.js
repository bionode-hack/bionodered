var varint = require('varint')

module.exports = function(cacheSize) {
  var values = []
  var strings = []
  var ptr = 0

  for (var i = 0; i < (cacheSize || 64); i++) {
    values.push(null)
    strings.push('')
  }

  var stringify = function(obj) {
    var i = values.indexOf(obj, ptr)
    if (i > -1) return strings[i]

    var str = JSON.stringify(obj)
    values[ptr] = obj
    strings[ptr] = str

    if (ptr === values.length-1) ptr = 0
    else ptr++

    return str
  }

  var encodingLength = function(obj) {
    var len = Buffer.byteLength(stringify(obj))
    return varint.encodingLength(len)+len
  }

  var encode = function(obj, buf, offset) {
    if (!buf) buf = new Buffer(encodingLength(obj))
    if (!offset) offset = 0

    var oldOffset = offset

    var str = stringify(obj)
    var len = Buffer.byteLength(str)

    varint.encode(len, buf, offset)
    offset += varint.encode.bytes

    buf.write(str, offset)
    offset += len

    encode.bytes = offset - oldOffset
    return buf
  }

  var decode = function(buf, offset) {
    if (!offset) offset = 0

    var oldOffset = offset

    var len = varint.decode(buf, offset)
    offset += varint.decode.bytes

    var str = buf.toString('utf-8', offset, offset+len)
    offset += len

    decode.bytes = offset - oldOffset
    return JSON.parse(str)
  }

  encode.bytes = decode.bytes = 0

  return {
    type: 2,
    encode: encode,
    decode: decode,
    encodingLength: encodingLength
  }
}