{ RequestError, ServerError, ConnectionError, ValidationError } = require './errors'

_old = global.Promise
Promise = require('es6-promise').Promise
global.Promise = _old

class TicketingHub
  module.exports = this

  @Channel: require('./channel/channel')
  @Promise: Promise
  @JSON: global.JSON

  @RequestError: RequestError
  @ServerError: ServerError
  @ConnectionError: ConnectionError
  @ValidationError: ValidationError
  @TicketingHub: TicketingHub

Endpoint = require('./endpoint')
TicketingHub.endpoint = new Endpoint 'https://api.ticketinghub.com'

TicketingHub.JSON ||=
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