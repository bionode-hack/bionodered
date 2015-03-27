# detect-json-style
Windows | Mac/Linux
------- | ---------
[![Windows Build status](http://img.shields.io/appveyor/ci/finnp/detect-json-style.svg)](https://ci.appveyor.com/project/finnp/detect-json-style/branch/master) | [![Build Status](https://travis-ci.org/finnp/detect-json-style.svg?branch=master)](https://travis-ci.org/finnp/detect-json-style)


Detect JSON type from a first peek chunk of a string. 

It detects the following styles
* *object* Array top-level nested in an object like `{"rows": [{"a": 1}, ..]`
* *array*  Array of objects `[{"a": 1}...]`
* *multiline* JSON objects after each other `{"a: 1"}{"a": 2}` (can be ndjson)


## usage

```js
var detectJSON = require('detect-json-style')
var json = detectJSON('{"rows": [{"a": 1}, {"a": 2}, {"a":')
// json -> {style: 'object', selector: 'rows.*'}
```


Works well together with `peek-stream` and `JSONStream`. The selector 
attribute is compatible with the first argument of `JSONStream.parse()`.

```js
var peek = require('peek-stream')
var JSONStream = require('JSONStream')
var detectJSON = require('detect-json-style')

peek(function (data, swap) {
  var json = detectJSON(swap)
  if(json) swap(null, JSONStream.parse(json.selector))
    
  swap(new Error('Could not determine format'))
})


```
