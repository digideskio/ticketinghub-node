extend = require('./util').extend
Promise = require('./index').Promise;
EventEmitter = require('events').EventEmitter

class Collection extends EventEmitter

  MAX_LIMIT = 25

  constructor: (@endpoint, @klass, params) ->
    super()

    @_params = extend {}, params || {}
    @_limit = @_params.limit || MAX_LIMIT
    @_offset = @_params.offset || 0


  each: (callback) ->
    index = 0

    dispatch = (cache) =>
      for value in cache
        loaded = @klass.load @endpoint, value
        return false if callback(loaded, index++, @_count) == false
      return true

    fetch = (offset) =>
      if offset == @_offset && @_cache then return if dispatch(@_cache) == false
      return if @_count && @_cache.length >= @_count
      @endpoint.get(@params(offset: offset)).then (response) =>
        @_count = parseInt response.headers['x-total-count']
        if dispatch(response.body) && response.status == 206 then fetch offset + MAX_LIMIT

    fetch @_offset
    return this

  first: (count = 1) ->
    new Promise (resolve, reject) =>
      values = []
      @limit(Math.min MAX_LIMIT, count).each (value, index) ->
        if index == count - 1
          resolve values
          return false

  all: ->    
    @reload().then =>
      new Promise (resolve, reject) =>
        values = []
        @each (value, index, count) ->
          values.push value
          resolve values if index == count - 1
        resolve values if @_count == 0

  scope: (path) ->
    new Collection @endpoint.join(path), @klass, @_params

  limit: (value) ->
    return @_limit unless value?
    new Collection @endpoint, @klass, @params(limit: parseInt(value))
  
  offset: (value) ->
    return @_offset unless value?
    new Collection @endpoint, @klass, @params(offset: parseInt(value))

  filter: (filters) ->
    new Collection @endpoint, @klass, @params(filters: filters)

  count: ->
    new Promise (resolve, reject) =>
      return resolve @_count if @_count
      @reload().then => resolve @_count

  for method in ['get', 'post', 'patch', 'delete'] then do (method) =>
    @::[method] = (args...) ->
      @endpoint[method](args...).then (response) -> response.body

  create: (attributes) ->
    @endpoint.post(attributes)
      .then (response) =>
        @klass.load(@endpoint, response.body)
      .catch (error) =>
        if (error instanceof TicketingHub.RequestError) || error.response.status == 422
          throw new TicketingHub.ValidationError @klass.load(@endpoint, error.response.body)
        else throw error

  reload: (params) ->
    @endpoint.get(@params(params)).then (response) =>
      @_cache = response.body
      @_count = if status == 206
        parseInt response.headers['x-total-count']
      else @_cache.length
      return this

  params: (params) ->
    extend extend({}, @_params), params || {}

module.exports = Collection