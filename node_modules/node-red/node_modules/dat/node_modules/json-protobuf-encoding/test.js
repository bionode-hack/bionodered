var encoding = require('./')

var e = encoding()

console.log(e.decode(e.encode({hello:'world'})))