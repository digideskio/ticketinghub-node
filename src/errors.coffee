class exports.RequestError extends Error # 4xx
  constructor: (@response) ->
    @name = 'RequestError'
    Error.captureStackTrace?(this, RequestError)

class exports.ServerError extends Error # 5xx
  constructor: (@response) ->
    @name = 'ServerError'
    Error.captureStackTrace?(this, ServerError)

class exports.ConnectionError extends Error
  constructor: (@message) ->
    @name = 'ConnectionError'
    Error.captureStackTrace?(this, ConnectionError)

class exports.ValidationError extends Error
  constructor: (@resource) ->
    @name = 'ValidationError'
    @message = 'Resource is invalid.'
    Error.captureStackTrace?(this, ValidationError)