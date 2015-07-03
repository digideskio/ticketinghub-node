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
(function (__filename){
/*
 Yaku v0.2.7
 (c) 2015 Yad Smood. http://ysmood.org
 License MIT
*/
(function(root) {
  var Yaku;
  return Yaku = (function() {
    'use strict';

    /**
    	 * This class follows the [Promises/A+](https://promisesaplus.com) and
    	 * [ES6](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-promise-objects) spec
    	 * with some extra helpers.
    	 * @param  {Function} executor Function object with two arguments resolve and reject.
    	 * The first argument fulfills the promise, the second argument rejects it.
    	 * We can call these functions, once our operation is completed.
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * p = new Promise (resolve, reject) ->
    	 * 	setTimeout ->
    	 * 		if Math.random() > 0.5
    	 * 			resolve 'ok'
    	 * 		else
    	 * 			reject 'no'
    	 * ```
     */
    var $circularChain, $fromPrevious, $invalid_argument, $nil, $noop, $pending, $promiseTrace, $rejected, $resolved, $settlerTrace, $tryCatchFn, $tryErr, addHandler, assertIterable, callHanler, genScheduler, genSettler, genStackInfo, genTraceInfo, genTryCatcher, genTypeError, getThen, isFunction, isLongStackTrace, isObject, newEmptyYaku, release, scheduleHandler, scheduleUnhandledRejection, settlePromise, settleWithX, settleXthen, tryCatcher;

    function Yaku(executor) {
      var err;
      if (isLongStackTrace) {
        this[$promiseTrace] = genTraceInfo();
      }
      if (executor === $noop) {
        return;
      }
      err = genTryCatcher(executor)(genSettler(this, $resolved), genSettler(this, $rejected));
      if (err === $tryErr) {
        settlePromise(this, $rejected, err.e);
      }
    }


    /**
    	 * Appends fulfillment and rejection handlers to the promise,
    	 * and returns a new promise resolving to the return value of the called handler.
    	 * @param  {Function} onFulfilled Optional. Called when the Promise is resolved.
    	 * @param  {Function} onRejected  Optional. Called when the Promise is rejected.
    	 * @return {Yaku} It will return a new Yaku which will resolve or reject after
    	 * @example
    	 * the current Promise.
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * p = Promise.resolve 10
    	 *
    	 * p.then (v) ->
    	 * 	console.log v
    	 * ```
     */

    Yaku.prototype.then = function(onFulfilled, onRejected) {
      return addHandler(this, newEmptyYaku(), onFulfilled, onRejected);
    };


    /**
    	 * The `catch()` method returns a Promise and deals with rejected cases only.
    	 * It behaves the same as calling `Promise.prototype.then(undefined, onRejected)`.
    	 * @param  {Function} onRejected A Function called when the Promise is rejected.
    	 * This function has one argument, the rejection reason.
    	 * @return {Yaku} A Promise that deals with rejected cases only.
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * p = Promise.reject 10
    	 *
    	 * p.catch (v) ->
    	 * 	console.log v
    	 * ```
     */

    Yaku.prototype["catch"] = function(onRejected) {
      return this.then($nil, onRejected);
    };


    /**
    	 * The `Promise.resolve(value)` method returns a Promise object that is resolved with the given value.
    	 * If the value is a thenable (i.e. has a then method), the returned promise will "follow" that thenable,
    	 * adopting its eventual state; otherwise the returned promise will be fulfilled with the value.
    	 * @param  {Any} value Argument to be resolved by this Promise.
    	 * Can also be a Promise or a thenable to resolve.
    	 * @return {Yaku}
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * p = Promise.resolve 10
    	 * ```
     */

    Yaku.resolve = function(value) {
      if (value instanceof Yaku) {
        return value;
      }
      return settleWithX(newEmptyYaku(), value);
    };


    /**
    	 * The `Promise.reject(reason)` method returns a Promise object that is rejected with the given reason.
    	 * @param  {Any} reason Reason why this Promise rejected.
    	 * @return {Yaku}
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * p = Promise.reject 10
    	 * ```
     */

    Yaku.reject = function(reason) {
      return settlePromise(newEmptyYaku(), $rejected, reason);
    };


    /**
    	 * The `Promise.race(iterable)` method returns a promise that resolves or rejects
    	 * as soon as one of the promises in the iterable resolves or rejects,
    	 * with the value or reason from that promise.
    	 * @param  {iterable} iterable An iterable object, such as an Array.
    	 * @return {Yaku} The race function returns a Promise that is settled
    	 * the same way as the first passed promise to settle.
    	 * It resolves or rejects, whichever happens first.
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * Promise.race [
    	 * 	123
    	 * 	Promise.resolve 0
    	 * ]
    	 * .then (value) ->
    	 * 	console.log value # => 123
    	 * ```
     */

    Yaku.race = function(iterable) {
      var i, len, p;
      assertIterable(iterable);
      len = iterable.length;
      if (len === 0) {
        return Yaku.resolve([]);
      }
      p = newEmptyYaku();
      i = 0;
      while (i < len) {
        settleWithX(p, iterable[i++]);
        if (p._state !== $pending) {
          break;
        }
      }
      return p;
    };


    /**
    	 * The `Promise.all(iterable)` method returns a promise that resolves when
    	 * all of the promises in the iterable argument have resolved.
    	 *
    	 * The result is passed as an array of values from all the promises.
    	 * If something passed in the iterable array is not a promise,
    	 * it's converted to one by Promise.resolve. If any of the passed in promises rejects,
    	 * the all Promise immediately rejects with the value of the promise that rejected,
    	 * discarding all the other promises whether or not they have resolved.
    	 * @param  {iterable} iterable An iterable object, such as an Array.
    	 * @return {Yaku}
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * Promise.all [
    	 * 	123
    	 * 	Promise.resolve 0
    	 * ]
    	 * .then (values) ->
    	 * 	console.log values # => [123, 0]
    	 * ```
     */

    Yaku.all = function(iterable) {
      var convertor, countDown, i, iter, len, onRejected, p1, res;
      assertIterable(iterable);
      convertor = Yaku.resolve;
      len = countDown = iterable.length;
      if (len === 0) {
        return convertor([]);
      }
      p1 = newEmptyYaku();
      res = [];
      i = 0;
      onRejected = function(reason) {
        settlePromise(p1, $rejected, reason);
      };
      iter = function(i) {
        convertor(iterable[i]).then(function(value) {
          res[i] = value;
          if (!--countDown) {
            settlePromise(p1, $resolved, res);
          }
        }, onRejected);
      };
      while (i < len) {
        iter(i++);
      }
      return p1;
    };


    /**
    	 * Catch all possibly unhandled rejections. If you want to use specific
    	 * format to display the error stack, overwrite it.
    	 * If it is set, auto `console.error` unhandled rejection will be disabed.
    	 * @param {Any} reason The rejection reason.
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * Promise.onUnhandledRejection = (reason) ->
    	 * 	console.error reason
    	 *
    	 * # The console will log an unhandled rejection error message.
    	 * Promise.reject('my reason')
    	 *
    	 * # The below won't log the unhandled rejection error message.
    	 * Promise.reject('v').catch ->
    	 * ```
     */

    Yaku.onUnhandledRejection = function(reason, p) {
      var info;
      if (!isObject(console)) {
        return;
      }
      info = genStackInfo(reason, p);
      return console.error('Unhandled Rejection:', info[0], info[1]);
    };

    isLongStackTrace = false;


    /**
    	 * It is used to enable the long stack trace.
    	 * Once it is enabled, it can't be reverted.
    	 * @example
    	 * ```coffee
    	 * Promise = require 'yaku'
    	 * Promise.enableLongStackTrace()
    	 * ```
     */

    Yaku.enableLongStackTrace = function() {
      isLongStackTrace = true;
    };


    /*
    	 * All static variable name will begin with `$`. Such as `$rejected`.
    	 * @private
     */

    $tryCatchFn = null;

    $tryErr = {
      e: null
    };

    $noop = {};

    $nil = void 0;

    isObject = function(obj) {
      return typeof obj === 'object';
    };

    isFunction = function(obj) {
      return typeof obj === 'function';
    };


    /**
    	 * Release the specified key of an object.
    	 * @private
    	 * @param  {Object} obj
    	 * @param  {String | Number} key
     */

    release = function(obj, key) {
      obj[key] = $nil;
    };


    /**
    	 * Wrap a function into a try-catch.
    	 * @private
    	 * @return {Any | $tryErr}
     */

    tryCatcher = function() {
      var e;
      try {
        return $tryCatchFn.apply(this, arguments);
      } catch (_error) {
        e = _error;
        $tryErr.e = e;
        return $tryErr;
      }
    };


    /**
    	 * Generate a try-catch wrapped function.
    	 * @private
    	 * @param  {Function} fn
    	 * @return {Function}
     */

    genTryCatcher = function(fn) {
      $tryCatchFn = fn;
      return tryCatcher;
    };


    /**
    	 * Generate a scheduler.
    	 * @private
    	 * @param  {Integer}  initQueueSize
    	 * @param  {Function} fn `(Yaku, Value) ->` The schedule handler.
    	 * @return {Function} `(Yaku, Value) ->` The scheduler.
     */

    genScheduler = function(initQueueSize, fn) {

      /**
      		 * All async promise will be scheduled in
      		 * here, so that they can be execute on the next tick.
      		 * @private
       */
      var flush, fnQueue, fnQueueLen, scheduleFlush;
      fnQueue = Array(initQueueSize);
      fnQueueLen = 0;

      /**
      		 * Run all queued functions.
      		 * @private
       */
      flush = function() {
        var i, p, pIndex, v, vIndex;
        i = 0;
        while (i < fnQueueLen) {
          pIndex = i++;
          vIndex = i++;
          p = fnQueue[pIndex];
          v = fnQueue[vIndex];
          release(fnQueue, pIndex);
          release(fnQueue, vIndex);
          fn(p, v);
        }
        fnQueueLen = 0;
        fnQueue.length = initQueueSize;
      };

      /**
      		 * Schedule a flush task on the next tick.
      		 * @private
      		 * @param {Function} fn The flush task.
       */
      scheduleFlush = (function() {
        var content, doc, mutationObserver, nextTick, node, observer;
        doc = root.document;
        try {
          nextTick = root.process.nextTick;
          return function() {
            nextTick(flush);
          };
        } catch (_error) {}
        if (nextTick = root.setImmediate) {
          return function() {
            nextTick(flush);
          };
        } else if (mutationObserver = root.MutationObserver) {
          content = 1;
          node = doc.createTextNode('');
          observer = new mutationObserver(flush);
          observer.observe(node, {
            characterData: true
          });
          return function() {
            node.data = (content = -content);
          };
        } else {
          return function() {
            setTimeout(flush);
          };
        }
      })();
      return function(p, v) {
        fnQueue[fnQueueLen++] = p;
        fnQueue[fnQueueLen++] = v;
        if (fnQueueLen === 2) {
          scheduleFlush();
        }
      };
    };


    /**
    	 * Check if a variable is an iterable object.
    	 * @private
    	 * @param  {Any}  obj
    	 * @return {Boolean}
     */

    assertIterable = function(obj) {
      if (obj instanceof Array) {
        return;
      }
      throw genTypeError($invalid_argument);
    };


    /**
    	 * Generate type error object.
    	 * @private
    	 * @param  {String} msg
    	 * @return {TypeError}
     */

    genTypeError = function(msg) {
      return new TypeError(msg);
    };

    genTraceInfo = function(noTitle) {
      return (new Error).stack.replace('Error', (noTitle ? '' : $fromPrevious));
    };


    /**
    	 * These are some static symbolys.
    	 * @private
     */

    $rejected = 0;

    $resolved = 1;

    $pending = 2;

    $promiseTrace = '_pStack';

    $settlerTrace = '_sStack';

    $circularChain = 'promise_circular_chain';

    $invalid_argument = 'invalid_argument';

    $fromPrevious = 'From previous event:';

    Yaku.prototype._state = $pending;


    /**
    	 * The number of current promises that attach to this Yaku instance.
    	 * @private
     */

    Yaku.prototype._pCount = 0;

    Yaku.prototype._pre = null;


    /**
    	 * Create an empty promise.
    	 * @private
    	 * @return {Yaku}
     */

    newEmptyYaku = function() {
      return new Yaku($noop);
    };


    /**
    	 * It will produce a settlePromise function to user.
    	 * Such as the resolve and reject in this `new Yaku (resolve, reject) ->`.
    	 * @private
    	 * @param  {Yaku} self
    	 * @param  {Integer} state The value is one of `$pending`, `$resolved` or `$rejected`.
    	 * @return {Function} `(value) -> undefined` A resolve or reject function.
     */

    genSettler = function(self, state) {
      return function(value) {
        if (isLongStackTrace) {
          self[$settlerTrace] = genTraceInfo(true);
        }
        if (state === $resolved) {
          settleWithX(self, value);
        } else {
          settlePromise(self, state, value);
        }
      };
    };


    /**
    	 * Link the promise1 to the promise2.
    	 * @private
    	 * @param {Yaku} p1
    	 * @param {Yaku} p2
    	 * @param {Function} onFulfilled
    	 * @param {Function} onRejected
     */

    addHandler = function(p1, p2, onFulfilled, onRejected) {
      if (isFunction(onFulfilled)) {
        p2._onFulfilled = onFulfilled;
      }
      if (isFunction(onRejected)) {
        p2._onRejected = onRejected;
      }
      p2._pre = p1;
      p1[p1._pCount++] = p2;
      if (p1._state !== $pending) {
        scheduleHandler(p1, p2);
      }
      return p2;
    };


    /**
    	 * Resolve the value returned by onFulfilled or onRejected.
    	 * @private
    	 * @param {Yaku} p1
    	 * @param {Yaku} p2
     */

    scheduleHandler = genScheduler(1000, function(p1, p2) {
      var handler, x;
      handler = p1._state ? p2._onFulfilled : p2._onRejected;
      if (handler === $nil) {
        settlePromise(p2, p1._state, p1._value);
        return;
      }
      x = genTryCatcher(callHanler)(handler, p1._value);
      if (x === $tryErr) {
        settlePromise(p2, $rejected, x.e);
        return;
      }
      settleWithX(p2, x);
    });

    scheduleUnhandledRejection = genScheduler(100, function(p) {
      var iter;
      iter = function(node) {
        var i, len;
        i = 0;
        len = node._pCount;
        if (node._onRejected) {
          return;
        }
        while (i < len) {
          if (!iter(node[i++])) {
            return;
          }
        }
        return true;
      };
      if (iter(p)) {
        Yaku.onUnhandledRejection(p._value, p);
      }
    });

    genStackInfo = function(reason, p) {
      var clean, iter, push, stackInfo, stackStr, trim;
      stackInfo = [];
      trim = function(str) {
        return str.replace(/^\s+|\s+$/g, '');
      };
      if (isLongStackTrace && p[$promiseTrace]) {
        push = function(trace) {
          return stackInfo.push(trim(trace));
        };
        if (p[$settlerTrace]) {
          push(p[$settlerTrace]);
        }
        iter = function(node) {
          if (!node) {
            return;
          }
          iter(node._next);
          push(node[$promiseTrace]);
          return iter(node._pre);
        };
        iter(p);
      }
      stackStr = '\n' + stackInfo.join('\n');
      clean = function(stack, cleanPrev) {
        var i;
        if (cleanPrev && (i = stack.indexOf('\n' + $fromPrevious)) > 0) {
          stack = stack.slice(0, i);
        }
        if (typeof __filename === 'string') {
          return stack.replace(RegExp(".+" + __filename + ".+\\n?", "g"), '');
        }
      };
      return [(reason ? reason.stack ? clean(trim(reason.stack), true) : reason : reason), clean(stackStr)];
    };

    callHanler = function(handler, value) {
      return handler(value);
    };


    /**
    	 * Resolve or reject a promise.
    	 * @private
    	 * @param  {Yaku} p
    	 * @param  {Integer} state
    	 * @param  {Any} value
     */

    settlePromise = function(p, state, value) {
      var i, len, stack;
      if (p._state !== $pending) {
        return;
      }
      p._state = state;
      p._value = value;
      if (state === $rejected) {
        if (isLongStackTrace && value && value.stack) {
          stack = genStackInfo(value, p);
          value.stack = stack[0] + stack[1];
        }
        if (!p._pre || p._pre._state === $resolved) {
          scheduleUnhandledRejection(p);
        }
      }
      i = 0;
      len = p._pCount;
      while (i < len) {
        scheduleHandler(p, p[i++]);
      }
      return p;
    };


    /**
    	 * Resolve or reject primise with value x. The x can also be a thenable.
    	 * @private
    	 * @param {Yaku} p
    	 * @param {Any | Thenable} x A normal value or a thenable.
     */

    settleWithX = function(p, x) {
      var xthen;
      if (x === p && x) {
        settlePromise(p, $rejected, genTypeError($circularChain));
        return;
      }
      if (x !== null && (isFunction(x) || isObject(x))) {
        xthen = genTryCatcher(getThen)(x);
        if (xthen === $tryErr) {
          settlePromise(p, $rejected, xthen.e);
          return;
        }
        if (isFunction(xthen)) {
          if (isLongStackTrace && x instanceof Yaku) {
            p._next = x;
          }
          settleXthen(p, x, xthen);
        } else {
          settlePromise(p, $resolved, x);
        }
      } else {
        settlePromise(p, $resolved, x);
      }
      return p;
    };


    /**
    	 * Try to get a promise's then method.
    	 * @private
    	 * @param  {Thenable} x
    	 * @return {Function}
     */

    getThen = function(x) {
      return x.then;
    };


    /**
    	 * Resolve then with its promise.
    	 * @private
    	 * @param  {Yaku} p
    	 * @param  {Thenable} x
    	 * @param  {Function} xthen
     */

    settleXthen = function(p, x, xthen) {
      var err;
      err = genTryCatcher(xthen).call(x, function(y) {
        if (!x) {
          return;
        }
        x = null;
        settleWithX(p, y);
      }, function(r) {
        if (!x) {
          return;
        }
        x = null;
        settlePromise(p, $rejected, r);
      });
      if (err === $tryErr && x) {
        settlePromise(p, $rejected, err.e);
        x = null;
      }
    };

    try {
      module.exports = Yaku;
    } catch (_error) {
      try {
        define(function() {
          return Yaku;
        });
      } catch (_error) {
        root.Yaku = Yaku;
      }
    }

    return Yaku;

  })();
})(this || window);

}).call(this,"/node_modules/yaku/lib/yaku.js")
},{}],3:[function(require,module,exports){
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


},{"../resource":26,"./question":17}],4:[function(require,module,exports){
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

  Booking.collection('tiers', require('./tier'));

  Booking.collection('answers', require('./answer'));

  Booking.collection('purchases', require('./purchase'));

  return Booking;

})(require('../resource'));


},{"../resource":26,"./answer":3,"./booking/ticket":5,"./booking/voucher":6,"./purchase":16,"./tier":19}],5:[function(require,module,exports){
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

  TicketBooking.collection('tickets', require('../ticket'));

  return TicketBooking;

})(require('../booking'));


},{"../booking":4,"../ticket":18}],6:[function(require,module,exports){
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


},{"../booking":4,"../voucher":21}],7:[function(require,module,exports){
var Channel, TicketingHub,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

TicketingHub = require('../ticketinghub');

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


},{"../resource":26,"../ticketinghub":28,"./booking":4,"./coupon":8,"./extra":9,"./option":10,"./order":11,"./product":15,"./question":17,"./tier":19,"./variant":20,"./voucher":21}],8:[function(require,module,exports){
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


},{"../resource":26}],9:[function(require,module,exports){
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


},{"../resource":26}],10:[function(require,module,exports){
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


},{"../resource":26}],11:[function(require,module,exports){
var Order, TicketingHub,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

TicketingHub = require('../ticketinghub');

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
    })(this))["catch"]((function(_this) {
      return function(error) {
        if ((error instanceof TicketingHub.RequestError) || error.response.status === 422) {
          throw new TicketingHub.ValidationError(_this.constructor.load(_this._endpoint, error.response.body));
        } else {
          throw error;
        }
      };
    })(this));
  };

  return Order;

})(require('../resource'));


},{"../resource":26,"../ticketinghub":28,"./booking":4,"./payment":12}],12:[function(require,module,exports){
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


},{"../resource":26,"./payment/credit":13,"./payment/stripe":14}],13:[function(require,module,exports){
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


},{"../payment":12}],14:[function(require,module,exports){
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


},{"../payment":12}],15:[function(require,module,exports){
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


},{"../resource":26}],16:[function(require,module,exports){
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


},{"../resource":26,"./extra":9}],17:[function(require,module,exports){
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


},{"../resource":26}],18:[function(require,module,exports){
var Ticket,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Ticket = (function(superClass) {
  extend(Ticket, superClass);

  function Ticket() {
    return Ticket.__super__.constructor.apply(this, arguments);
  }

  module.exports = Ticket;

  Ticket.path = '/channel/tickets';

  return Ticket;

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
var Collection, EventEmitter, TicketingHub, extend,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

extend = require('./util').extend;

TicketingHub = require('./ticketinghub');

EventEmitter = require('events').EventEmitter;

Collection = (function(superClass) {
  var MAX_LIMIT, fn, i, len, method, ref;

  extend1(Collection, superClass);

  module.exports = Collection;

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
    return new TicketingHub.Promise((function(_this) {
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
        return new TicketingHub.Promise(function(resolve, reject) {
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
    return new TicketingHub.Promise((function(_this) {
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
    return this.endpoint.post(attributes).then((function(_this) {
      return function(response) {
        return _this.klass.load(_this.endpoint, response.body);
      };
    })(this))["catch"]((function(_this) {
      return function(error) {
        if ((error instanceof TicketingHub.RequestError) || error.response.status === 422) {
          throw new TicketingHub.ValidationError(_this.klass.load(_this.endpoint, error.response.body));
        } else {
          throw error;
        }
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


},{"./ticketinghub":28,"./util":29,"events":1}],23:[function(require,module,exports){
(function (global){
var Endpoint, Response, TicketingHub, extend, util;

extend = require('./util').extend;

Response = require('./response');

util = require('./util');

TicketingHub = require('./ticketinghub');

Endpoint = (function() {
  var RETRIES, TIMEOUT, fn, i, len, method, ref;

  module.exports = Endpoint;

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
    return new TicketingHub.Promise((function(_this) {
      return function(resolve, reject) {
        var agent, callback, handle, json_params, options, parts, query, req, script, sibling, timeout;
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
          callback = "_jsonp_" + (id.replace(/-/g, ''));
          script = document.createElement('script');
          script.type = 'text/javascript';
          script.async = true;
          script.src = "" + parts.href + query + "&_token=" + _this.auth + "&_callback=" + callback;
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
          sibling = document.getElementsByTagName('script')[0];
          return sibling.parentNode.insertBefore(script, sibling);
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


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./response":27,"./ticketinghub":28,"./util":29}],24:[function(require,module,exports){
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

exports.RequestError = (function(superClass) {
  extend(RequestError, superClass);

  function RequestError(response) {
    this.response = response;
    this.name = 'RequestError';
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, RequestError);
    }
  }

  return RequestError;

})(Error);

exports.ServerError = (function(superClass) {
  extend(ServerError, superClass);

  function ServerError(response) {
    this.response = response;
    this.name = 'ServerError';
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, ServerError);
    }
  }

  return ServerError;

})(Error);

exports.ConnectionError = (function(superClass) {
  extend(ConnectionError, superClass);

  function ConnectionError(message) {
    this.message = message;
    this.name = 'ConnectionError';
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, ConnectionError);
    }
  }

  return ConnectionError;

})(Error);

exports.ValidationError = (function(superClass) {
  extend(ValidationError, superClass);

  function ValidationError(resource) {
    this.resource = resource;
    this.name = 'ValidationError';
    this.message = 'Resource is invalid.';
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  return ValidationError;

})(Error);


},{}],25:[function(require,module,exports){
(function (global){
module.exports = require('./ticketinghub');

if (typeof global.window !== 'undefined') {
  global.window.TicketingHub = module.exports;
}


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ticketinghub":28}],26:[function(require,module,exports){
var Collection, EventEmitter, Resource, TicketingHub, extend, util,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

extend = require('./util').extend;

util = require('./util');

Collection = require('./collection');

EventEmitter = require('events').EventEmitter;

TicketingHub = require('./ticketinghub');

Resource = (function(superClass) {
  extend1(Resource, superClass);

  module.exports = Resource;

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
              return _this.reload().then(function() {
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

  Resource.prototype["delete"] = function(params) {
    return this._endpoint["delete"](params).then((function(_this) {
      return function(response) {
        return _this._setup(response.body);
      };
    })(this));
  };

  Resource.prototype.update = function(attributes) {
    return this._endpoint.patch(attributes).then((function(_this) {
      return function(response) {
        return _this._setup(response.body);
      };
    })(this))["catch"]((function(_this) {
      return function(error) {
        if ((error instanceof TicketingHub.RequestError) || error.response.status === 422) {
          throw new TicketingHub.ValidationError(_this.constructor.load(_this._endpoint, error.response.body));
        } else {
          throw error;
        }
      };
    })(this));
  };

  Resource.prototype.reload = function() {
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


},{"./collection":22,"./ticketinghub":28,"./util":29,"events":1}],27:[function(require,module,exports){
var Response;

Response = (function() {
  module.exports = Response;

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


},{}],28:[function(require,module,exports){
(function (global){
var ConnectionError, Endpoint, RequestError, ServerError, TicketingHub, ValidationError, ref;

ref = require('./errors'), RequestError = ref.RequestError, ServerError = ref.ServerError, ConnectionError = ref.ConnectionError, ValidationError = ref.ValidationError;

TicketingHub = (function() {
  function TicketingHub() {}

  module.exports = TicketingHub;

  TicketingHub.Channel = require('./channel/channel');

  TicketingHub.Promise = require('yaku');

  TicketingHub.JSON = global.JSON;

  TicketingHub.RequestError = RequestError;

  TicketingHub.ServerError = ServerError;

  TicketingHub.ConnectionError = ConnectionError;

  TicketingHub.ValidationError = ValidationError;

  TicketingHub.TicketingHub = TicketingHub;

  return TicketingHub;

})();

Endpoint = require('./endpoint');

TicketingHub.endpoint = new Endpoint('https://api.ticketinghub.com');

TicketingHub.JSON || (TicketingHub.JSON = {
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
});


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./channel/channel":7,"./endpoint":23,"./errors":24,"yaku":2}],29:[function(require,module,exports){
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
},{}]},{},[25]);
