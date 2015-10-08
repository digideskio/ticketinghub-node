{ merge, extend } = require('./util');
TicketingHub = require('./ticketinghub');
EventEmitter = require('events').EventEmitter

class Collection extends EventEmitter
  module.exports = this

  Resource = require './resource'

  constructor: (@api, @schema, @endpoint, params) ->
    @_params = extend {}, params || {}
    super()

  each: (params, callback) ->
    if typeof params is 'function'
      [ params, callback ] = [ callback, params ]

    params = @params params
    index = (params.offset ||= 0)

    dispatch = (results) =>
      for result in results
        resource = Resource.load @api, @schema, @endpoint, result
        return false if callback(resource, index++, @_count) == false
      return true

    fetch = =>
      @endpoint.get(params).then (response) =>
        @_count = parseInt response.headers['x-total-count']
        if dispatch(response.body) && index < @_count - 1
          fetch (params.offset = index + 1)

    fetch()
    return this

  slice: (start, end) ->
    @count().then (count) =>
      start = if start < 0 then count + start else start
      end = if end then (if end < 0 then count + end else end) else count

      return [] if start >= count

      new TicketingHub.Promise (resolve, reject) =>
        resources = []
        @each offset: start, limit: (end - start), (resource, index, count) ->
          end = if end then (if end < 0 then count + end else end) else count
          resources.push resource
          if end == (index + 1)
            resolve resources
            return false

  all: -> @slice(0)

  scope: (path, params = {}) ->
    new Collection @api, @schema, @endpoint.join(path), @params(params)

  filter: (filters) ->
    new Collection @api, @schema, @endpoint, @params(filters: filters)

  count: ->
    new TicketingHub.Promise (resolve, reject) =>
      return resolve @_count if @_count
      @reload().then => resolve @_count

  for method in ['get', 'post', 'patch', 'delete'] then do (method) =>
    @::[method] = (args...) -> @endpoint[method] args...

  create: (attributes) ->
    @endpoint.post(attributes)
      .then (response) =>
        Resource.load @api, @schema, @endpoint, response.body
      .catch (error) =>
        if (error instanceof TicketingHub.RequestError) && error.response.status == 422
          throw new TicketingHub.ValidationError Resource.load(@api, @schema, @endpoint, error.response.body)
        else throw error

  reload: (params) ->
    @endpoint.head(@params(params)).then (response) =>
      if 'x-total-count' of response.headers
        @_count = parseInt response.headers['x-total-count']
      return this

  params: (params) ->
    merge @_params, params || {}