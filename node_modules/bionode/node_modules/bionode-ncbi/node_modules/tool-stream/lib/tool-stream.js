// # tool-stream
// > Node.js module for working with Streams of objects.
// >
// > doi: [?](http://doi.org/)
// > author: [Bruno Vieira](http://bmpvieira.com)
// > email: <mail@bmpvieira.com>
// > license: [MIT](https://raw.githubusercontent.com/bmpvieira/tool-stream/master/LICENSE)
//
// ---
//
// ## Usage
// These methods are Streams that work with Streams of objects/strings.
// If you are using Streams that output Buffers from JSON data, you can easily convert to
// objects with JSONStream.
// Example:
//
//     npm install tool-stream JSONStream request
//
//     var tool = require('tool-stream')
//     var JSONStream = require('JSONStream')
//     var request = require('request')
//
//     var query = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=asthma&retmode=json'
//
//     request({uri: query, json: true})
//     .pipe(JSONStream.parse())
//     .pipe(tool.extractProperty('esearchresult.idlist'))
//     .pipe(tool.arraySplit())
//     .pipe(JSONStream.stringify())
//     .pipe(process.stdout)
//
//     => [ "24908147",
//          "24907978",
//          [...],
//          "24903131" ]
//
// For more examples of real use cases, checkout the module
// [bionode-ncbi](http://github.com/bionode/bionode-ncbi), which depends on many
// methods from this module.

var through = require('through2')
var async = require('async')
var bops = require('bops')
var uniq = require('unique-stream')
var flat = require('flat')
var util = require('util')
var nestedProperty = require('nested-property')
var xml2jsParser = require('xml2js').Parser
var xml2js = new xml2jsParser({mergeAttrs: true, explicitArray: false, explicitRoot: false}).parseString
var xml2jsArray = new xml2jsParser({mergeAttrs: true, explicitArray: true, explicitRoot: false}).parseString

module.exports = exports = tool = new ToolStream()

function ToolStream() {
  return this
}


// If input is an array or an object as associative array, output each value.
ToolStream.prototype.arraySplit = function() {
  return through.obj(transform)
  function transform(obj, enc, next) {
    var self = this
    Object.keys(obj).forEach(pushValue)
    function pushValue(key) { self.push(obj[key]) }
    next()
  }
}


// Attach to a value from another object (e.g., from a key store)
ToolStream.prototype.attachStoredValue = function(outsideObj, streamObjSrcProp, streamObjDestProp) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var outsideValue = outsideObj[obj[streamObjSrcProp]]
    obj[streamObjDestProp] = outsideValue
    this.push(obj)
    next()
  }
}


// Copy external object and attach input values to specified property, outputs new object.
ToolStream.prototype.attachToObject = function(object, property) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var extend = util._extend
    var copy = extend(object)
    copy[property] = obj
    this.push(copy)
    next()
  }
}


// Only outputs objects with property value equal to match
ToolStream.prototype.collectMatch = function(property, match) {
  return through.obj(transform)
  function transform(obj, enc, next) {
    var self = this
    if (match === tool.getValue(obj, property)) { self.push(obj) }
    next()
  }
}


// Outputs a triple object using specified properties for subject/object, and string for predicate.
ToolStream.prototype.createTriple = function(subjectKey, predicate, objectKey) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var subject = tool.getValue(obj, subjectKey)
    var object = tool.getValue(obj, objectKey)
    var triple = { subject: subject, predicate: predicate, object: object }
    this.push(triple)
    next()
  }
}


// Deletes specified property
ToolStream.prototype.deleteProperty = function(property) {
  return through.obj(transform)
  function transform(obj, enc, next) {
    delete obj[property]
    this.push(obj)
    next()
  }
}


// If specified property isn't an array, make it an array
ToolStream.prototype.ensureIsArray = function(property) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var value = nestedProperty.get(obj, property)
    if (!Array.isArray(value)) { nestedProperty.set(obj, property, [value]) }
    this.push(obj)
    next()
  }
}


// Only pass value from a specified key in object
ToolStream.prototype.extractProperty = function(property, unique) {
  var uniqStream = uniq()
  var extractStream = through.obj(extract)
  var extractUniqueStream = through.obj(extractUnique)

  var attached = false

  var stream = unique ? extractUniqueStream : extractStream
  return stream

  function extractUnique(obj, enc, next) {
    var self = this
    extractStream.write(obj)
    if (!attached) {
      extractStream.pipe(uniqStream)
      uniqStream.on('data', function(data) {
        self.push(data)
      })
      attached = true
    }
    next()
  }
  function extract(obj, enc, next) {
    var value = tool.getValue(obj, property)
    this.push(value)
    next()
  }
}


// Filters objects with property value equal to match
ToolStream.prototype.filterMatch = function(property, match) {
  return through.obj(transform)
  function transform(obj, enc, next) {
    var self = this
    if (match !== tool.getValue(obj, property)) { self.push(obj) }
    next()
  }
}


// Removes nested objects with property value equal to match from input object array.
ToolStream.prototype.filterObjectsArray = function(property, match, path) {
  return through.obj(transform)
  function transform(obj, enc, next) {
    var self = this
    var objectsArray = path ? nestedProperty.get(obj, path) : obj
    objectsArray.forEach(filterMatch)
    function filterMatch(arrayObj, i) {
      if (arrayObj[property] === match) { objectsArray.splice(i, 1) }
    }
    if (path) { nestedProperty.set(obj, path, objectsArray) }
    self.push(obj)
    next()
  }
}


// Flats the object and looks for values matching regex, attaching them to specified property.
ToolStream.prototype.grepObject = function(regex, propertyToSave, data) {
  var stream = through.obj(cb)
  if (data) { stream.write(data) }
  return stream
  function cb(obj, enc, next) {
    var flatObj = flat.flatten(obj)
    var relevantData = []
    Object.keys(flatObj).forEach(checkRelevant)
    function checkRelevant(key) {
      var value = flatObj[key].toString()
      if (value.match(regex)) {
        relevantData.push(value)
      }
    }
    uniqueRelevantData = relevantData.filter(function(elem, pos, self) {
      return self.indexOf(elem) == pos;
    })
    obj[propertyToSave] = uniqueRelevantData
    this.push(obj)
    next()
  }
}


// Converts JSON to Buffer
ToolStream.prototype.JSONToBuffer = function() {
  return through.obj(cb)
  function cb(obj, enc, next) {
  this.push(bops.from(JSON.stringify(obj) + '\n'))
  next()
  }
}


// Stores in another object. Can do interpolation of values from stream for keys.
// If the destination property isn't empty or is an array, it will push the object
ToolStream.prototype.storeToObject = function(storeObject, storeProperty, streamObjectValue) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var store = storeObject
    var previous
    var regexMatchDotsOutsideDoubleBrackets = /\.(?=(?:[^\}\}]|\{\{[^\}\}]*\}\})*$)/
    var storePropertyArgs = storeProperty.split(regexMatchDotsOutsideDoubleBrackets)

    storePropertyArgs.forEach(setProperty)
    function setProperty(storeProperty) {
      if (previous) { store = store[previous] }
      // Check if store property needs interpolation of value from object from stream
      if (tool.startsWith(storeProperty, '{{') && tool.endsWith(storeProperty, '}}')) {
        var storeKey = obj
        var streamObjectProperty = storeProperty.slice(2, -2).split('.')
        streamObjectProperty.forEach(moveDeeper)
        function moveDeeper(streamObjectKey) {
          storeKey = storeKey[streamObjectKey]
        }
      }
      // Otherwise, no interpolation needed
      else {
        storeKey = storeProperty
      }
      if (typeof store[storeKey] === 'undefined') {
        store[storeKey] = {}
      }
      previous = storeKey
    }

    var dataToStore = streamObjectValue ? obj[streamObjectValue] : obj

    if (Array.isArray(store[previous])) {
      store[previous].push(dataToStore)
    }
    else if (store[previous] === '' || typeof store[previous] === 'object' && Object.keys(store[previous]).length === 0) {
      store[previous] = dataToStore
    }
    else {
      var previousData = store[previous]
      store[previous] = []
      store[previous].push(previousData)
      store[previous].push(dataToStore)
    }

    this.push(obj)
    next()
  }
}


// Outputs the same object multiple times for each value in specified array from property.
// Copies of the object will only differ by those values.
ToolStream.prototype.splitObjectByArrayProperty = function(propertyToSplit, splitedPropertyName) {
  return through.obj(cb)
  function cb(obj, enc, next) {
    var self = this
    var values = tool.getValue(obj, propertyToSplit)
    values.forEach(pushSplit)
    function pushSplit(value) {
      obj[splitedPropertyName] = value
      self.push(obj)
    }
    next()
  }
}

// Unflats an object that has properties in JSON (like when coming from Dat)
ToolStream.prototype.unflatTabularObject = function() {
  return through.obj(transform)
  function transform(obj, enc, next) {
    Object.keys(obj).forEach(parse)
    function parse(key) {
      var parsed
      try { parsed = JSON.parse(obj[key]) }
      catch(e) {}
      if (parsed) { obj[key] = parsed }
    }
    this.push(obj)
    next()
  }
}

// Converts XML input to JS, takes a Boolean to set explicitArray option of parser.
ToolStream.prototype.XMLToJS = function(explicitArray) {
  return through.obj(transform)
  function transform(obj, enc, next) {
    var self = this
    var parser = explicitArray ? xml2jsArray : xml2js
    parser(obj, gotStringParsed)
    function gotStringParsed(err, data) {
      if (err) { return self.emit('error', err) }
      self.push(data)
      next()
    }
  }
}


// ## Parse XML properties to JS
// Takes and array of strings representing properties of objects being passed and
// returns objects with those properties parsed from XML to JSON:
//
//     var ncbi = require('bionode-ncbi')
//     var tool = require('tool-stream')
//     var searchStream = ncbi.search('sra', 'solenopsis invicta')
//     var parseStream = tool.XMLToJSProperties(['expxml', 'runs'])
//     searchStream.pipe(parseStream).on('data', console.log)
//     => { uid: '225471',
//          expxml:
//           { root:
//              { Summary: [Object],
//                Submitter: [Object],
//                Experiment: [Object],
//                Study: [Object],
//                Organism: [Object],
//                Sample: [Object],
//                Instrument: [Object],
//                Library_descriptor: [Object],
//                Biosample: [Object],
//                Bioproject: [Object] } },
//          runs: { root: { Run: [Object] } },
//          extlinks: '    ',
//          createdate: '2013/03/28',
//          updatedate: '2013/09/23' }
//        [...]

ToolStream.prototype.XMLToJSProperties = function(properties) {
  return through.obj(parser)
  function parser(obj, enc, next) {
    var self = this
    async.forEach(properties, parseXMLProperty, gotAllParsed)
    function gotAllParsed(err) {
      if (err) { return self.emit('error', err) }
      self.push(obj)
      next()
    }
    function parseXMLProperty(property, callback) {
      parseXMLString(obj[property], gotPropertyParsed)
      function gotPropertyParsed(js){
        obj[property] = js
        callback()
      }
    }
  }
  function parseXMLString(xmlString, callback) {
    var xml = '<root>'
      + xmlString
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      + '</root>'
    xml2js(xml, gotStringParsed)
    function gotStringParsed(err, js) {
      if (err) { return self.emit('error', err) }
      callback(js)
    }
  }
}


// Util to check if str starts with prefix
ToolStream.prototype.startsWith = function(str, prefix) {
  return str.indexOf(prefix) === 0
}


// Util to check if str ends with suffix
ToolStream.prototype.endsWith = function(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1
}


// Get nested property. Can also go inside JSON strings (and thus differ from nestedProperty).
ToolStream.prototype.getValue = function(obj, path) {
  var value = obj
  path.split('.').forEach(moveDeeper)
  function moveDeeper(key) {
    if (typeof value === 'string') { value = JSON.parse(value) }
    value = value[key]
  }
  return value
}


// Set nested property. Can also go inside JSON strings (and thus differ from nestedProperty).
ToolStream.prototype.setValue = function(obj, path, value) {
  var value = obj
  var parent
  path.split('.').forEach(moveDeeper)
  function moveDeeper(key) {
    if (typeof value === 'string') { value = JSON.parse(value) }
    parent
    value = value[key]
  }
  return value
}
