
module.exports = function detect(chunk) {
  chunk = chunk + ''
  chunk = chunk.trim()
  var format
  if(chunk[0] === '[') { // style: array
    return checkArrayLike(chunk)
  } else if(chunk[0] === '{') { // style: object / multiline
    return checkObjectLike(chunk)
  }
  return null
}

// chunk beginning with '['
function checkArrayLike(chunk) {
  var format = {style: 'array', selector: '*'}
  
  // maybe we already have the full array?
  if(lastChar(chunk) === ']' && JSONcheck(chunk)) return format
  // else still could be valid, e.g. [{"a": 1, b:[1,2,3]
  
  var afterArray = chunk.slice(1).trim()
  if(afterArray[0] ==='{') {
    var splittedArray = splitArray(afterArray)
    if(!splittedArray.error) {
      splittedArray.pop() // ignore last element?
      var validElements = splittedArray.every(function (elem) {
        return JSONcheck(elem)
      })
      if(validElements) return format
    }
  }
  
  return null
}

function checkObjectLike(chunk) {
  
  var endFirstObj = objectEnding(chunk)
  if(endFirstObj === chunk.length - 1) {
    // complete object '{...}'
    // single ndjson object or
    // probably type '{"rows": [{"a": 1, "b": 2}]}'
    return checkCompleteObject(chunk)

    
  } if(endFirstObj === chunk.length) {
    // one cutoff object '{...'
    // expecting '{"rows": [{"a": 1, "b": ...
    // could alterantively be a very long row of ndjson
    
  
    return checkCutoffObject(chunk)
    
  } else {
    // first object ends before end of the string
    // so if anything we have multiple objects after each other
    // e.g ndjson
    return checkMultiline(chunk)
  }
  
  return null
}


// full '{ }' checks
function checkCompleteObject(chunk) {
  // check if it's a single 'ndjson' object
  if(JSONcheck(chunk)) {
    // '{"whatever": 1}' 
    // '{"rows": [{"a": 1, "b": 2}]}'
    var obj = JSON.parse(chunk)
    for(key in obj) {
      if(obj[key].length && typeof obj[key][0] === 'object')
        return {style: 'object', selector: key + '.*'}
    }
    return {style: 'multiline', selector: null}
  }
  
  // not json parseable
  return null
}

// one cut off { object
function checkCutoffObject(chunk) {
  var format = {style: 'object'}
  
  var arrayPos = findArrayPos(chunk)
  var arrayPart = chunk.slice(arrayPos)
  var arrayKey = findKey(chunk.slice(0, arrayPos))
  
  format.selector = arrayKey + '.*'
  
  return format
}

// multiple objects that aren't array
// checkinf for {}{}..
function checkMultiline(chunk) {
  // probably '{"a":1, "b": 2}{"a": 2, "b": 1}' (or pretty printed somehow)
  format = {style: 'multiline', selector: null} // could be ndjson, but doesn't have to
  if(lastChar(chunk) === '}' && JSONcheck(chunk)) return format // only one element
  var splittedObjects = splitObjects(chunk)
  if(!splittedObjects || splittedObjects.length === 0) return null
  if(isCutOffObj(splittedObjects[splittedObjects.length - 1])) splittedObjects.pop()
  var validObjElements = splittedObjects.every(function (elem) {
    return JSONcheck(elem)
  })
  if(validObjElements) return format
  return null
}


// '{"what": 1, "rows":' -> rows
function findKey(str) {
  var i = str.length - 1
  var result = ''
  var stringEnd
  while(str.length) {
    if(str[i] === '"') {
      if(stringEnd) {
        return str.slice(i + 1, stringEnd)
      } else {
        stringEnd = i
      }
    }
    i--
  }
  return false
}

function findArrayPos(str) {
  // '{"rows": [{"a": 1, "b": ...
  var ignoreString = false
  for(var i = 0; i < str.length; i++) {
    if(str[i] === '"') ignoreString = !ignoreString
    if(!ignoreString && str[i] === '[')
      return i
  }
  return false // ?
}

function isCutOffObj(str) {
  var count = 0
  var ignoreString = false
  for(var i = 0; i < str.length; i++) {
      if(str[i] === '"') ignoreString = !ignoreString
      if(!ignoreString) {
        if(str[i] === '{') count++
        else if(str[i] === '}') count--
      }
  }
  return count > 0
}

function splitObjects(str) {
  var count = 0
  var lastPos = 0
  var parts = []
  var ignoreString = false
  for(var i = 0; i < str.length; i++) {
    if(str[i] === '"') ignoreString = !ignoreString
    if(!ignoreString) {
      if(str[i] === '{') count++
      else {
        if(str[i] === '}') {
          count--
          if(count === 0) {
            parts.push(str.slice(lastPos, i + 1).trim())
            lastPos = i + 1
          } else if(count < 0) return false
        }
      }
    }

  }
  return parts
}

// [  {"a": 1}   ,   {"b":1,"c":2},{"a": [1,2,3]}..]
// array of objects!
// first character needs to be '{'
function splitArray(str) {
  var count = 0
  var lastPos = 0
  var parts = []
  var searchComma = false
  for(var i = 0; i < str.length; i++) {
    if(str[i] === '{') 
      if(searchComma) return {error: true}
      else count++
    else if(str[i] === '}') {
      count--
      if(count === 0) {
        parts.push(str.slice(lastPos, i).trim())
        lastPos = i
        searchComma = true
      }
    }
    else if(str[i] === ',') searchComma = false
  }
  return parts
}


function objectEnding(str) {
  // e.g. '{"a": {"a": 1}},{"a":' would find the comma
  var ignoreString = false
  var count = 0
  for(var i = 0; i < str.length; i++) {
    if(str[i] === '"') ignoreString = !ignoreString
    else if(!ignoreString) {
      if(str[i] === '{') count++
      else if(str[i] === '}') {
        count--
        if(count === 0) return i
      }
    }
  }
  return i
}

function lastChar(str) {
  return str[str.length - 1]
}

function JSONcheck(str) {
  try {
    JSON.parse(str)
  } catch(e) {
    return false
  }
  return true
}