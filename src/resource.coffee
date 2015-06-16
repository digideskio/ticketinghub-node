extend = require('./util').extend
util = require('./util')
Collection = require './collection'
EventEmitter = require('events').EventEmitter

class Resource extends EventEmitter

  @collection: (key, klass) ->
    @::[key] = (args...) ->
      if typeof args[0] is 'string'
        @_endpoint.get("#{klass.path}/#{args[0]}", args.slice(1)...).then (response) =>
          klass.load @_endpoint, response.body
      else
        new Collection @_endpoint.join(key), klass, args[0]

  @association: (key, klass) ->
    @::["#{key}="] = (attributes) ->
      @[key] = klass.load @_endpoint, attributes

  @types: (hash) ->
    @_types = hash

  @load: (endpoint, attributes) ->
    [callback, attributes] = [attributes, callback] if typeof attributes is 'function'
    type = @_types?[attributes.type] || this

    path = if @singleton then type.path else "#{type.path}/#{attributes.id}"
    endpoint = endpoint.base path
    return new type(endpoint, attributes)

  constructor: (@_endpoint, attributes) ->
    super()

    @_setup attributes
    listening = false

    if @updated_at

      @on 'removeListener', (event) =>
        listening = false if EventEmitter.listenerCount(this, 'change') == 0

      @on 'newListener', (event) =>
        return if listening
        if event == 'change'
          listening = true
          updated_at = @updated_at

          retry = =>
            return unless listening
            @reload().then =>
              if updated_at != @updated_at
                updated_at = @updated_at
                @emit 'change', this
              setTimeout retry, util.timeDecay(util.parseISO8601DateTime(@updated_at))
          setTimeout retry, util.timeDecay(util.parseISO8601DateTime(@updated_at))

  delete: (params) ->
    @_endpoint.delete(params)
      .then (response) => @_setup(response.body)

  update: (attributes) ->
    @_endpoint.patch(attributes)
      .then (response) => @_setup(response.body)
      .catch (error) =>
        if (error instanceof TicketingHub.RequestError) || error.response.status == 422
          throw new TicketingHub.ValidationError @constructor.load(@_endpoint, error.response.body)
        else throw error

  reload: ->
    @_endpoint.get().then (response) =>
      @_setup response.body

  _setup: (params) ->
    for key, value of params
      if "#{key}=" of this
        @["#{key}="] value
      else @[key] = value
    return this

module.exports = Resource