(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   2.1.1
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$toString = {}.toString;
    var lib$es6$promise$asap$$vertxNext;
    function lib$es6$promise$asap$$asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        lib$es6$promise$asap$$scheduleFlush();
      }
    }

    var lib$es6$promise$asap$$default = lib$es6$promise$asap$$asap;

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      var nextTick = process.nextTick;
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // setImmediate should be used instead instead
      var version = process.versions.node.match(/^(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)$/);
      if (Array.isArray(version) && version[1] === '0' && version[2] === '10') {
        nextTick = setImmediate;
      }
      return function() {
        nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertex() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertex();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFullfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$default(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = lib$es6$promise$$internal$$getThen(maybeThenable);

        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFullfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value);
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$default(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$default(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$default(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      var enumerator = this;

      enumerator._instanceConstructor = Constructor;
      enumerator.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (enumerator._validateInput(input)) {
        enumerator._input     = input;
        enumerator.length     = input.length;
        enumerator._remaining = input.length;

        enumerator._init();

        if (enumerator.length === 0) {
          lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
        } else {
          enumerator.length = enumerator.length || 0;
          enumerator._enumerate();
          if (enumerator._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(enumerator.promise, enumerator._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return lib$es6$promise$utils$$isArray(input);
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var enumerator = this;

      var length  = enumerator.length;
      var promise = enumerator.promise;
      var input   = enumerator._input;

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        enumerator._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var enumerator = this;
      var c = enumerator._instanceConstructor;

      if (lib$es6$promise$utils$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== lib$es6$promise$$internal$$PENDING) {
          entry._onerror = null;
          enumerator._settledAt(entry._state, i, entry._result);
        } else {
          enumerator._willSettleAt(c.resolve(entry), i);
        }
      } else {
        enumerator._remaining--;
        enumerator._result[i] = entry;
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var enumerator = this;
      var promise = enumerator.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        enumerator._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          enumerator._result[i] = value;
        }
      }

      if (enumerator._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, enumerator._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise’s eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        if (!lib$es6$promise$utils$$isFunction(resolver)) {
          lib$es6$promise$promise$$needsResolver();
        }

        if (!(this instanceof lib$es6$promise$promise$$Promise)) {
          lib$es6$promise$promise$$needsNew();
        }

        lib$es6$promise$$internal$$initializePromise(this, resolver);
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection) {
        var parent = this;
        var state = parent._state;

        if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
          return this;
        }

        var child = new this.constructor(lib$es6$promise$$internal$$noop);
        var result = parent._result;

        if (state) {
          var callback = arguments[state - 1];
          lib$es6$promise$asap$$default(function(){
            lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":2}],4:[function(require,module,exports){
var Answer,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Answer = (function(superClass) {
  extend(Answer, superClass);

  function Answer() {
    return Answer.__super__.constructor.apply(this, arguments);
  }

  module.exports = Answer;

  Answer.path = '/channel/answers';

  Answer.association('question', require('./question'));

  return Answer;

})(require('../resource'));


},{"../resource":26,"./question":18}],5:[function(require,module,exports){
var Booking,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Booking = (function(superClass) {
  extend(Booking, superClass);

  function Booking() {
    return Booking.__super__.constructor.apply(this, arguments);
  }

  module.exports = Booking;

  Booking.path = '/channel/bookings';

  Booking.types({
    ticket: require('./booking/ticket'),
    voucher: require('./booking/voucher')
  });

  Booking.collection('answers', require('./answer'));

  Booking.collection('purchases', require('./purchase'));

  return Booking;

})(require('../resource'));


},{"../resource":26,"./answer":4,"./booking/ticket":6,"./booking/voucher":7,"./purchase":17}],6:[function(require,module,exports){
var TicketBooking,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

TicketBooking = (function(superClass) {
  extend(TicketBooking, superClass);

  function TicketBooking() {
    return TicketBooking.__super__.constructor.apply(this, arguments);
  }

  module.exports = TicketBooking;

  TicketBooking.path = '/channel/bookings';

  TicketBooking.collection('tickets', require('./ticket'));

  return TicketBooking;

})(require('../booking'));


},{"../booking":5,"./ticket":6}],7:[function(require,module,exports){
var VoucherBooking,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

VoucherBooking = (function(superClass) {
  extend(VoucherBooking, superClass);

  function VoucherBooking() {
    return VoucherBooking.__super__.constructor.apply(this, arguments);
  }

  module.exports = VoucherBooking;

  VoucherBooking.path = '/channel/bookings';

  VoucherBooking.collection('vouchers', require('../voucher'));

  return VoucherBooking;

})(require('../booking'));


},{"../booking":5,"../voucher":21}],8:[function(require,module,exports){
var Channel,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Channel = (function(superClass) {
  extend(Channel, superClass);

  function Channel() {
    return Channel.__super__.constructor.apply(this, arguments);
  }

  module.exports = Channel;

  Channel.path = '/channel';

  Channel.singleton = true;

  Channel.collection('vouchers', require('./voucher'));

  Channel.collection('coupons', require('./coupon'));

  Channel.collection('tiers', require('./tier'));

  Channel.collection('variants', require('./variant'));

  Channel.collection('extras', require('./extra'));

  Channel.collection('questions', require('./question'));

  Channel.collection('bookings', require('./booking'));

  Channel.collection('orders', require('./order'));

  Channel.collection('options', require('./option'));

  Channel.association('product', require('./product'));

  Channel.login = function(token) {
    return TicketingHub.endpoint.base(this.path, token).get().then((function(_this) {
      return function(response) {
        return _this.load(TicketingHub.endpoint.join(_this.path, token), response.body);
      };
    })(this));
  };

  return Channel;

})(require('../resource'));


},{"../resource":26,"./booking":5,"./coupon":9,"./extra":10,"./option":11,"./order":12,"./product":16,"./question":18,"./tier":19,"./variant":20,"./voucher":21}],9:[function(require,module,exports){
var Coupon,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Coupon = (function(superClass) {
  extend(Coupon, superClass);

  function Coupon() {
    return Coupon.__super__.constructor.apply(this, arguments);
  }

  module.exports = Coupon;

  Coupon.path = '/channel/coupons';

  return Coupon;

})(require('../resource'));


},{"../resource":26}],10:[function(require,module,exports){
var Extra,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Extra = (function(superClass) {
  extend(Extra, superClass);

  function Extra() {
    return Extra.__super__.constructor.apply(this, arguments);
  }

  module.exports = Extra;

  Extra.path = '/channel/extras';

  return Extra;

})(require('../resource'));


},{"../resource":26}],11:[function(require,module,exports){
var Option,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Option = (function(superClass) {
  extend(Option, superClass);

  function Option() {
    return Option.__super__.constructor.apply(this, arguments);
  }

  module.exports = Option;

  Option.path = '/channel/options';

  return Option;

})(require('../resource'));


},{"../resource":26}],12:[function(require,module,exports){
var Endpoint, Order, Promise,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Promise = require('es6-promise').Promise;

Endpoint = require('../endpoint');

Order = (function(superClass) {
  extend(Order, superClass);

  function Order() {
    return Order.__super__.constructor.apply(this, arguments);
  }

  module.exports = Order;

  Order.path = '/channel/orders';

  Order.collection('payments', require('./payment'));

  Order.collection('bookings', require('./booking'));

  Order.prototype.confirm = function() {
    return this._endpoint.post('confirm').then((function(_this) {
      return function(response) {
        return _this._setup(response.body);
      };
    })(this))["catch"](TicketingHub.RequestError, (function(_this) {
      return function(error) {
        if (error.response.status === 422) {
          throw new TicketingHub.ValidationError(_this.klass.load(_this.endpoint, error.response.body));
        } else {
          throw error;
        }
      };
    })(this));
  };

  return Order;

})(require('../resource'));


},{"../endpoint":23,"../resource":26,"./booking":5,"./payment":13,"es6-promise":3}],13:[function(require,module,exports){
var Payment,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Payment = (function(superClass) {
  extend(Payment, superClass);

  function Payment() {
    return Payment.__super__.constructor.apply(this, arguments);
  }

  module.exports = Payment;

  Payment.path = '/channel/payments';

  Payment.types({
    credit: require('./payment/credit'),
    stripe: require('./payment/stripe')
  });

  return Payment;

})(require('../resource'));


},{"../resource":26,"./payment/credit":14,"./payment/stripe":15}],14:[function(require,module,exports){
var CreditPayment,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

CreditPayment = (function(superClass) {
  extend(CreditPayment, superClass);

  function CreditPayment() {
    return CreditPayment.__super__.constructor.apply(this, arguments);
  }

  module.exports = CreditPayment;

  CreditPayment.path = '/channel/payments';

  return CreditPayment;

})(require('../payment'));


},{"../payment":13}],15:[function(require,module,exports){
var StripePayment,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

StripePayment = (function(superClass) {
  extend(StripePayment, superClass);

  function StripePayment() {
    return StripePayment.__super__.constructor.apply(this, arguments);
  }

  module.exports = StripePayment;

  StripePayment.path = '/channel/payments';

  return StripePayment;

})(require('../payment'));


},{"../payment":13}],16:[function(require,module,exports){
var Product,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Product = (function(superClass) {
  extend(Product, superClass);

  function Product() {
    return Product.__super__.constructor.apply(this, arguments);
  }

  module.exports = Product;

  Product.path = '/channel/product';

  Product.singleton = true;

  return Product;

})(require('../resource'));


},{"../resource":26}],17:[function(require,module,exports){
var Purchase,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Purchase = (function(superClass) {
  extend(Purchase, superClass);

  function Purchase() {
    return Purchase.__super__.constructor.apply(this, arguments);
  }

  module.exports = Purchase;

  Purchase.path = '/channel/purchases';

  Purchase.association('extra', require('./extra'));

  return Purchase;

})(require('../resource'));


},{"../resource":26,"./extra":10}],18:[function(require,module,exports){
var Question,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Question = (function(superClass) {
  extend(Question, superClass);

  function Question() {
    return Question.__super__.constructor.apply(this, arguments);
  }

  module.exports = Question;

  Question.path = '/channel/questions';

  return Question;

})(require('../resource'));


},{"../resource":26}],19:[function(require,module,exports){
var Tier,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Tier = (function(superClass) {
  extend(Tier, superClass);

  function Tier() {
    return Tier.__super__.constructor.apply(this, arguments);
  }

  module.exports = Tier;

  Tier.path = '/channel/tiers';

  return Tier;

})(require('../resource'));


},{"../resource":26}],20:[function(require,module,exports){
var Variant,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Variant = (function(superClass) {
  extend(Variant, superClass);

  function Variant() {
    return Variant.__super__.constructor.apply(this, arguments);
  }

  module.exports = Variant;

  Variant.path = '/channel/variants';

  return Variant;

})(require('../resource'));


},{"../resource":26}],21:[function(require,module,exports){
var Voucher,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Voucher = (function(superClass) {
  extend(Voucher, superClass);

  function Voucher() {
    return Voucher.__super__.constructor.apply(this, arguments);
  }

  module.exports = Voucher;

  Voucher.path = '/channel/vouchers';

  return Voucher;

})(require('../resource'));


},{"../resource":26}],22:[function(require,module,exports){
var Collection, EventEmitter, Promise, extend,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

extend = require('./util').extend;

Promise = require('es6-promise').Promise;

EventEmitter = require('events').EventEmitter;

Collection = (function(superClass) {
  var MAX_LIMIT, fn, i, len, method, ref;

  extend1(Collection, superClass);

  MAX_LIMIT = 25;

  function Collection(endpoint, klass, params) {
    this.endpoint = endpoint;
    this.klass = klass;
    Collection.__super__.constructor.call(this);
    this._params = extend({}, params || {});
    this._limit = this._params.limit || MAX_LIMIT;
    this._offset = this._params.offset || 0;
  }

  Collection.prototype.each = function(callback) {
    var dispatch, fetch, index;
    index = 0;
    dispatch = (function(_this) {
      return function(cache) {
        var i, len, loaded, value;
        for (i = 0, len = cache.length; i < len; i++) {
          value = cache[i];
          loaded = _this.klass.load(_this.endpoint, value);
          if (callback(loaded, index++, _this._count) === false) {
            return false;
          }
        }
        return true;
      };
    })(this);
    fetch = (function(_this) {
      return function(offset) {
        if (offset === _this._offset && _this._cache) {
          if (dispatch(_this._cache) === false) {
            return;
          }
        }
        if (_this._count && _this._cache.length >= _this._count) {
          return;
        }
        return _this.endpoint.get(_this.params({
          offset: offset
        })).then(function(response) {
          _this._count = parseInt(response.headers['x-total-count']);
          if (dispatch(response.body) && response.status === 206) {
            return fetch(offset + MAX_LIMIT);
          }
        });
      };
    })(this);
    fetch(this._offset);
    return this;
  };

  Collection.prototype.first = function(count) {
    if (count == null) {
      count = 1;
    }
    return new Promise((function(_this) {
      return function(resolve, reject) {
        var values;
        values = [];
        return _this.limit(Math.min(MAX_LIMIT, count)).each(function(value, index) {
          if (index === count - 1) {
            resolve(values);
            return false;
          }
        });
      };
    })(this));
  };

  Collection.prototype.all = function() {
    return this.reload().then((function(_this) {
      return function() {
        return new Promise(function(resolve, reject) {
          var values;
          values = [];
          _this.each(function(value, index, count) {
            values.push(value);
            if (index === count - 1) {
              return resolve(values);
            }
          });
          if (_this._count === 0) {
            return resolve(values);
          }
        });
      };
    })(this));
  };

  Collection.prototype.scope = function(path) {
    return new Collection(this.endpoint.join(path), this.klass, this._params);
  };

  Collection.prototype.limit = function(value) {
    if (value == null) {
      return this._limit;
    }
    return new Collection(this.endpoint, this.klass, this.params({
      limit: parseInt(value)
    }));
  };

  Collection.prototype.offset = function(value) {
    if (value == null) {
      return this._offset;
    }
    return new Collection(this.endpoint, this.klass, this.params({
      offset: parseInt(value)
    }));
  };

  Collection.prototype.filter = function(filters) {
    return new Collection(this.endpoint, this.klass, this.params({
      filters: filters
    }));
  };

  Collection.prototype.count = function() {
    return new Promise((function(_this) {
      return function(resolve, reject) {
        if (_this._count) {
          return resolve(_this._count);
        }
        return _this.reload().then(function() {
          return resolve(_this._count);
        });
      };
    })(this));
  };

  ref = ['get', 'post', 'patch', 'delete'];
  fn = function(method) {
    return Collection.prototype[method] = function() {
      var args, ref1;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return (ref1 = this.endpoint)[method].apply(ref1, args).then(function(response) {
        return response.body;
      });
    };
  };
  for (i = 0, len = ref.length; i < len; i++) {
    method = ref[i];
    fn(method);
  }

  Collection.prototype.create = function(attributes) {
    return new Promise((function(_this) {
      return function(resolve, reject) {
        return _this.endpoint.post(attributes).then(function(response) {
          return resolve(_this.klass.load(_this.endpoint, response.body));
        })["catch"](TicketingHub.RequestError, function(error) {
          return reject(error.response.status === 422 ? new TicketingHub.ValidationError(_this.klass.load(_this.endpoint, error.response.body)) : error);
        });
      };
    })(this));
  };

  Collection.prototype.reload = function(params) {
    return this.endpoint.get(this.params(params)).then((function(_this) {
      return function(response) {
        _this._cache = response.body;
        _this._count = status === 206 ? parseInt(response.headers['x-total-count']) : _this._cache.length;
        return _this;
      };
    })(this));
  };

  Collection.prototype.params = function(params) {
    return extend(extend({}, this._params), params || {});
  };

  return Collection;

})(EventEmitter);

module.exports = Collection;


},{"./util":28,"es6-promise":3,"events":1}],23:[function(require,module,exports){
(function (global){
var Endpoint, Promise, Response, extend, util;

extend = require('./util').extend;

Promise = require('es6-promise').Promise;

Response = require('./response');

util = require('./util');

Endpoint = (function() {
  var RETRIES, TIMEOUT, fn, i, len, method, ref;

  TIMEOUT = 30 * 1000;

  RETRIES = 3;

  function Endpoint(origin, path1, auth1) {
    this.origin = origin;
    this.path = path1 != null ? path1 : '';
    this.auth = auth1 != null ? auth1 : '';
    this.url = "" + this.origin + this.path;
  }

  Endpoint.prototype.base = function(path, auth) {
    if (auth == null) {
      auth = this.auth;
    }
    return new Endpoint(this.origin, path, auth);
  };

  Endpoint.prototype.join = function(path, auth) {
    if (auth == null) {
      auth = this.auth;
    }
    return new Endpoint(this.origin, this.path + "/" + path, auth);
  };

  ref = ['get', 'post', 'patch', 'delete'];
  fn = function(method) {
    return Endpoint.prototype[method] = function(path, params) {
      var ref1;
      if (typeof path !== 'string') {
        ref1 = [params, path], path = ref1[0], params = ref1[1];
      }
      return this.request(method, path, params);
    };
  };
  for (i = 0, len = ref.length; i < len; i++) {
    method = ref[i];
    fn(method);
  }

  Endpoint.prototype.request = function(method, path, params) {
    var id;
    if (path == null) {
      path = '';
    }
    id = util.generateUUID();
    return new Promise((function(_this) {
      return function(resolve, reject) {
        var agent, callback, handle, json_params, options, parts, query, req, script, target, timeout, xhr;
        parts = util.parseURL(path[0] === '/' ? _this.origin + "/" + path : _this.url + "/" + path);
        json_params = encodeURIComponent(JSON.stringify(params || {}));
        query = "?_id=" + id + "&_json=" + json_params + "&_method=" + (method.toLowerCase());
        handle = function(response) {
          var ref1, ref2;
          if ((400 <= (ref1 = response.status) && ref1 < 500)) {
            return reject(new TicketingHub.RequestError(response));
          } else if ((500 <= (ref2 = response.status) && ref2 < 600)) {
            return reject(new TicketingHub.ServerError(response));
          } else {
            return resolve(response);
          }
        };
        if ('XMLHttpRequest' in global) {
          xhr = new XMLHttpRequest;
          if ('withCredentials' in xhr && 'timeout' in xhr) {
            xhr.timeout = TIMEOUT;
            xhr.withCredentials = true;
            xhr.open('GET', "" + parts.href + query, true);
            xhr.setRequestHeader('Authorization', "Basic " + (btoa(_this.auth + ":")));
            xhr.onload = function() {
              var body, headers;
              body = xhr.responseText;
              headers = util.parseResponseHeaders(xhr.getAllResponseHeaders());
              return handle(new Response(xhr.status, body, headers));
            };
            xhr.onerror = function() {
              return reject(new TicketingHub.ConnectionError('Request network error.'));
            };
            xhr.ontimeout = function() {
              return reject(new TicketingHub.ConnectionError('Request timed out.'));
            };
            return xhr.send();
          } else {
            global._th_jsonp_counter || (global._th_jsonp_counter = 0);
            callback = "_th_jsonp_callback" + (id = global._th_jsonp_counter++);
            script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = "" + parts.href + query + "&_token=" + _this.auth + "&_callback=" + callback + "&_=" + (Number(new Date) + ("." + id));
            timeout = setTimeout(function() {
              script.parentNode.removeChild(script);
              global[callback] = function() {};
              return reject(new TicketingHub.ConnectionError('Request timed out.'));
            }, TIMEOUT);
            global[callback] = function(body, status, headers) {
              clearTimeout(timeout);
              global[callback] = function() {};
              script.parentNode.removeChild(script);
              return handle(new Response(status, body, headers));
            };
            target = document.getElementsByTagName('script')[0] || document.head;
            return target.parentNode.insertBefore(script, target);
          }
        } else {
          options = {
            method: 'GET',
            scheme: parts.protocol.slice(0, -1),
            host: parts.hostname,
            port: parts.port,
            auth: _this.auth + ":",
            path: "" + parts.path + query
          };
          agent = require(parts.protocol.slice(0, -1));
          req = agent.request(options, function(res) {
            var data;
            data = '';
            res.on('data', function(chunk) {
              return data += chunk;
            });
            return res.on('end', function() {
              if (res.statusCode === 0) {
                return;
              }
              return handle(new Response(res.statusCode, data, res.headers));
            });
          });
          req.setTimeout(TIMEOUT, function() {
            return reject(new TicketingHub.ConnectionError('Request timed out.'));
          });
          req.on('error', function(error) {
            return reject(new TicketingHub.ConnectionError(error.message));
          });
          return req.end();
        }
      };
    })(this));
  };

  return Endpoint;

})();

module.exports = Endpoint;


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./response":27,"./util":28,"es6-promise":3}],24:[function(require,module,exports){
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

exports.RequestError = (function(superClass) {
  extend(RequestError, superClass);

  function RequestError(response) {
    this.response = response;
    this.name = 'RequestError';
    Error.captureStackTrace(this, RequestError);
  }

  return RequestError;

})(Error);

exports.ServerError = (function(superClass) {
  extend(ServerError, superClass);

  function ServerError(response) {
    this.response = response;
    this.name = 'ServerError';
    Error.captureStackTrace(this, ServerError);
  }

  return ServerError;

})(Error);

exports.ConnectionError = (function(superClass) {
  extend(ConnectionError, superClass);

  function ConnectionError(message) {
    this.message = message;
    this.name = 'ConnectionError';
    Error.captureStackTrace(this, ConnectionError);
  }

  return ConnectionError;

})(Error);

exports.ValidationError = (function(superClass) {
  extend(ValidationError, superClass);

  function ValidationError(resource) {
    this.resource = resource;
    this.name = 'ValidationError';
    this.message = 'Resource is invalid.';
    Error.captureStackTrace(this, ValidationError);
  }

  return ValidationError;

})(Error);


},{}],25:[function(require,module,exports){
(function (global){
if (!global.JSON) {
  global.JSON = {
    parse: function(sJSON) {
      return eval('(' + sJSON + ')');
    },
    stringify: (function() {
      var escFunc, escMap, escRE, isArray, toString;
      toString = Object.prototype.toString;
      isArray = Array.isArray || function(a) {
        return toString.call(a) === '[object Array]';
      };
      escMap = {
        '"': '\\"',
        '\\': '\\\\',
        '\b': '\\b',
        '\f': '\\f',
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t'
      };
      escFunc = function(m) {
        return escMap[m] || '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1);
      };
      escRE = /[\\"\u0000-\u001F\u2028\u2029]/g;
      return function(value) {
        var i, k, res, tmp;
        if (value === null || typeof value === 'undefined') {
          return 'null';
        } else if (typeof value === 'number') {
          if (isFinite(value)) {
            return value.toString();
          } else {
            return 'null';
          }
        } else if (typeof value === 'boolean') {
          return value.toString();
        } else if (typeof value === 'object') {
          if (typeof value.toJSON === 'function') {
            return JSON.stringify(value.toJSON());
          } else if (isArray(value)) {
            res = '[';
            i = 0;
            while (i < value.length) {
              res += (i ? ', ' : '') + JSON.stringify(value[i]);
              i++;
            }
            return res + ']';
          } else if (toString.call(value) === '[object Object]') {
            tmp = [];
            for (k in value) {
              if (value.hasOwnProperty(k)) {
                tmp.push(JSON.stringify(k) + ': ' + JSON.stringify(value[k]));
              }
            }
            return '{' + tmp.join(', ') + '}';
          }
        }
        return '"' + value.toString().replace(escRE, escFunc) + '"';
      };
    })()
  };
}

if (typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],26:[function(require,module,exports){
var Collection, EventEmitter, Resource, extend, util,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

extend = require('./util').extend;

util = require('./util');

Collection = require('./collection');

EventEmitter = require('events').EventEmitter;

Resource = (function(superClass) {
  extend1(Resource, superClass);

  Resource.collection = function(key, klass) {
    return this.prototype[key] = function() {
      var args, ref;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (typeof args[0] === 'string') {
        return (ref = this._endpoint).get.apply(ref, [klass.path + "/" + args[0]].concat(slice.call(args.slice(1)))).then((function(_this) {
          return function(response) {
            return klass.load(_this._endpoint, response.body);
          };
        })(this));
      } else {
        return new Collection(this._endpoint.join(key), klass, args[0]);
      }
    };
  };

  Resource.association = function(key, klass) {
    return this.prototype[key + "="] = function(attributes) {
      return this[key] = klass.load(this._endpoint, attributes);
    };
  };

  Resource.types = function(hash) {
    return this._types = hash;
  };

  Resource.load = function(endpoint, attributes) {
    var callback, path, ref, ref1, type;
    if (typeof attributes === 'function') {
      ref = [attributes, callback], callback = ref[0], attributes = ref[1];
    }
    type = ((ref1 = this._types) != null ? ref1[attributes.type] : void 0) || this;
    path = this.singleton ? type.path : type.path + "/" + attributes.id;
    endpoint = endpoint.base(path);
    return new type(endpoint, attributes);
  };

  function Resource(_endpoint, attributes) {
    var listening;
    this._endpoint = _endpoint;
    Resource.__super__.constructor.call(this);
    this._setup(attributes);
    listening = false;
    if (this.updated_at) {
      this.on('removeListener', (function(_this) {
        return function(event) {
          if (EventEmitter.listenerCount(_this, 'change') === 0) {
            return listening = false;
          }
        };
      })(this));
      this.on('newListener', (function(_this) {
        return function(event) {
          var retry, updated_at;
          if (listening) {
            return;
          }
          if (event === 'change') {
            listening = true;
            updated_at = _this.updated_at;
            retry = function() {
              if (!listening) {
                return;
              }
              return _this._reload().then(function() {
                if (updated_at !== _this.updated_at) {
                  updated_at = _this.updated_at;
                  _this.emit('change', _this);
                }
                return setTimeout(retry, util.timeDecay(util.parseISO8601DateTime(_this.updated_at)));
              });
            };
            return setTimeout(retry, util.timeDecay(util.parseISO8601DateTime(_this.updated_at)));
          }
        };
      })(this));
    }
  }

  Resource.prototype["delete"] = function() {
    return this.endpoint["delete"](attributes).then((function(_this) {
      return function(response) {
        return _this._setup(response.body);
      };
    })(this));
  };

  Resource.prototype.update = function(attributes) {
    return new Promise((function(_this) {
      return function(resolve, reject) {
        return _this.endpoint.patch(attributes).then(function(response) {
          return resolve(_this._setup(response.body));
        })["catch"](TicketingHub.RequestError, function(error) {
          return reject(error.response.status === 422 ? new TicketingHub.ValidationError(_this.constructor.load(_this.endpoint, error.response.body)) : error);
        });
      };
    })(this));
  };

  Resource.prototype._reload = function() {
    return this._endpoint.get().then((function(_this) {
      return function(response) {
        return _this._setup(response.body);
      };
    })(this));
  };

  Resource.prototype._setup = function(params) {
    var key, value;
    for (key in params) {
      value = params[key];
      if ((key + "=") in this) {
        this[key + "="](value);
      } else {
        this[key] = value;
      }
    }
    return this;
  };

  return Resource;

})(EventEmitter);

module.exports = Resource;


},{"./collection":22,"./util":28,"events":1}],27:[function(require,module,exports){
var Response;

Response = (function() {
  function Response(status, body, headers) {
    var key, value;
    this.status = status;
    if (body == null) {
      body = '';
    }
    if (headers == null) {
      headers = {};
    }
    this.headers = {};
    for (key in headers) {
      value = headers[key];
      this.headers[key.toLowerCase()] = value;
    }
    if (/json/.test(this.headers['content-type'])) {
      body = JSON.parse(body);
    }
    this.body = body;
  }

  return Response;

})();

module.exports = Response;


},{}],28:[function(require,module,exports){
(function (global){
exports.parseISO8601DateTime = function(s) {
  var a, d, i, ms, offset, re;
  re = /(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(Z|([+-])(\d\d):(\d\d))/;
  d = s.match(re);
  if (!d) {
    throw 'Couldn\'t parse ISO 8601 date string \'' + s + '\'';
  }
  a = [1, 2, 3, 4, 5, 6, 10, 11];
  for (i in a) {
    d[a[i]] = parseInt(d[a[i]], 10);
  }
  d[7] = parseFloat(d[7]);
  ms = Date.UTC(d[1], d[2] - 1, d[3], d[4], d[5], d[6]);
  if (d[7] > 0) {
    ms += Math.round(d[7] * 1000);
  }
  if (d[8] !== 'Z' && d[10]) {
    offset = d[10] * 60 * 60 * 1000;
    if (d[11]) {
      offset += d[11] * 60 * 1000;
    }
    if (d[9] === '+') {
      ms -= offset;
    } else {
      ms += offset;
    }
  }
  return new Date(ms);
};

exports.parseURL = function(str) {
  var a, url;
  if (global.window) {
    a = document.createElement('a');
    a.href = str;
    return {
      protocol: a.protocol,
      hostname: a.hostname,
      port: a.port,
      pathname: a.pathname,
      href: a.href
    };
  } else {
    url = 'url';
    return require(url).parse(str);
  }
};

exports.extend = function(a, b) {
  var key, value;
  for (key in b) {
    value = b[key];
    a[key] = value;
  }
  return a;
};

exports.parseResponseHeaders = function(headerStr) {
  var headerPair, headerPairs, headers, i, index, key, val;
  headers = {};
  if (!headerStr) {
    return headers;
  }
  headerPairs = headerStr.split('\u000d\u000a');
  i = 0;
  while (i < headerPairs.length) {
    headerPair = headerPairs[i];
    index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      key = headerPair.substring(0, index);
      val = headerPair.substring(index + 2);
      headers[key] = val;
    }
    i++;
  }
  return headers;
};

exports.generateUUID = function() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function(a) {
    return (a ^ Math.random() * 16 >> a / 4).toString(16);
  });
};

exports.timeDecay = (function(_this) {
  return function(date) {
    var seconds;
    seconds = (Number(new Date) - Number(date)) / 1000;
    return Math.log(1 + seconds, Math.E) * 1000;
  };
})(this);


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],29:[function(require,module,exports){
(function (global){
var ConnectionError, Endpoint, RequestError, ServerError, TicketingHub, ValidationError, ref;

require('./polyfill');

Endpoint = require('./endpoint');

ref = require('./errors'), RequestError = ref.RequestError, ServerError = ref.ServerError, ConnectionError = ref.ConnectionError, ValidationError = ref.ValidationError;

TicketingHub = (function() {
  function TicketingHub() {}

  TicketingHub.endpoint = new Endpoint('http://localhost:5000');

  TicketingHub.Channel = require('./channel/channel');

  TicketingHub.RequestError = RequestError;

  TicketingHub.ServerError = ServerError;

  TicketingHub.ConnectionError = ConnectionError;

  TicketingHub.ValidationError = ValidationError;

  return TicketingHub;

})();

if (typeof global.window !== 'undefined') {
  global.window.TicketingHub = TicketingHub;
} else {
  module.exports = {
    TicketingHub: TicketingHub
  };
}


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./channel/channel":8,"./endpoint":23,"./errors":24,"./polyfill":25}]},{},[29]);
