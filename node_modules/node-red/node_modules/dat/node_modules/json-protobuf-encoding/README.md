# json-protobuf-encoding

JSON encoding for protobuf

```
npm install json-protobuf-encoding
```

## Usage

Given a schema

```
message Test {
  required json misc;
}
```

``` js
var fs = require('fs')
var protobuf = require('protocol-buffers')
var json = require('json-protobuf-encoding')

var messages = protobuf(fs.readFileSync('schema.proto'), {
  encodings: {
    json: json()
  }
})

var data = messages.Test.encode({misc:{hello:'world'}})
```

## License

MIT