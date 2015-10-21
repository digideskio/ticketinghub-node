class exports.RequestError extends Error # 4xx
  constructor: (@response) ->
    @name = 'RequestError'
    @message = (@response.body?.error_description) || @response.body
    @errorCode = @response.body?.error
    if Error.captureStackTrace then Error.captureStackTrace(this, exports.RequestError) else @stack = (new Error).stack

class exports.ServerError extends Error # 5xx
  constructor: (@response) ->
    @name = 'ServerError'
    @message = (@response.body?.error_description) || @response.body
    @errorCode = @response.body?.error
    if Error.captureStackTrace then Error.captureStackTrace(this, exports.ServerError) else @stack = (new Error).stack

class exports.ConnectionError extends Error
  constructor: (@message) ->
    @name = 'ConnectionError'
    if Error.captureStackTrace then Error.captureStackTrace(this, exports.ConnectionError) else @stack = (new Error).stack

class exports.ValidationError extends exports.RequestError # 422
  constructor: (@resource) ->
    @name = 'ValidationError'
    @message = 'Resource is invalid.'
    if Error.captureStackTrace then Error.captureStackTrace(this, exports.ValidationError) else @stack = (new Error).stack