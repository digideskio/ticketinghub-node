if ! global.JSON
  global.JSON =
    parse: (sJSON) ->
      eval '(' + sJSON + ')'
    stringify: do ->
      toString = Object::toString
      isArray = Array.isArray or (a) ->
        toString.call(a) == '[object Array]'
      escMap = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' }

      escFunc = (m) ->
        escMap[m] or '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1)

      escRE = /[\\"\u0000-\u001F\u2028\u2029]/g
      (value) ->
        if value == null || typeof value == 'undefined'
          return 'null'
        else if typeof value == 'number'
          return if isFinite(value) then value.toString() else 'null'
        else if typeof value == 'boolean'
          return value.toString()
        else if typeof value == 'object'
          if typeof value.toJSON == 'function'
            return JSON.stringify(value.toJSON())
          else if isArray(value)
            res = '['
            i = 0
            while i < value.length
              res += (if i then ', ' else '') + JSON.stringify(value[i])
              i++
            return res + ']'
          else if toString.call(value) == '[object Object]'
            tmp = []
            for k of value
              if value.hasOwnProperty(k)
                tmp.push JSON.stringify(k) + ': ' + JSON.stringify(value[k])
            return '{' + tmp.join(', ') + '}'
        '"' + value.toString().replace(escRE, escFunc) + '"'

unless typeof String.prototype.trim is 'function'
  String.prototype.trim = ->
    this.replace /^\s+|\s+$/g, ''