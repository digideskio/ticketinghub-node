class exports.RequestError extends Error # 4xx
  constructor: (@response) ->
    @name = 'RequestError'
    Error.captureStackTrace?(this, exports.RequestError)

class exports.ServerError extends Error # 5xx
  constructor: (@response) ->
    @name = 'ServerError'
    Error.captureStackTrace?(this, exports.ServerError)

class exports.ConnectionError extends Error
  constructor: (@message) ->
    @name = 'ConnectionError'
    Error.captureStackTrace?(this, exports.ConnectionError)

class exports.ValidationError extends exports.RequestError # 422
  constructor: (@resource) ->
    @name = 'ValidationError'
    @message = 'Resource is invalid.'
    Error.captureStackTrace?(this, exports.ValidationError)