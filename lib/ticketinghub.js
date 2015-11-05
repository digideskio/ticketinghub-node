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
(function (global){
/*! JSON v3.3.2 | http://bestiejs.github.io/json3 | Copyright 2012-2014, Kit Cambridge | http://kit.mit-license.org */
;(function () {
  // Detect the `define` function exposed by asynchronous module loaders. The
  // strict `define` check is necessary for compatibility with `r.js`.
  var isLoader = typeof define === "function" && define.amd;

  // A set of types used to distinguish objects from primitives.
  var objectTypes = {
    "function": true,
    "object": true
  };

  // Detect the `exports` object exposed by CommonJS implementations.
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  // Use the `global` object exposed by Node (including Browserify via
  // `insert-module-globals`), Narwhal, and Ringo as the default context,
  // and the `window` object in browsers. Rhino exports a `global` function
  // instead.
  var root = objectTypes[typeof window] && window || this,
      freeGlobal = freeExports && objectTypes[typeof module] && module && !module.nodeType && typeof global == "object" && global;

  if (freeGlobal && (freeGlobal["global"] === freeGlobal || freeGlobal["window"] === freeGlobal || freeGlobal["self"] === freeGlobal)) {
    root = freeGlobal;
  }

  // Public: Initializes JSON 3 using the given `context` object, attaching the
  // `stringify` and `parse` functions to the specified `exports` object.
  function runInContext(context, exports) {
    context || (context = root["Object"]());
    exports || (exports = root["Object"]());

    // Native constructor aliases.
    var Number = context["Number"] || root["Number"],
        String = context["String"] || root["String"],
        Object = context["Object"] || root["Object"],
        Date = context["Date"] || root["Date"],
        SyntaxError = context["SyntaxError"] || root["SyntaxError"],
        TypeError = context["TypeError"] || root["TypeError"],
        Math = context["Math"] || root["Math"],
        nativeJSON = context["JSON"] || root["JSON"];

    // Delegate to the native `stringify` and `parse` implementations.
    if (typeof nativeJSON == "object" && nativeJSON) {
      exports.stringify = nativeJSON.stringify;
      exports.parse = nativeJSON.parse;
    }

    // Convenience aliases.
    var objectProto = Object.prototype,
        getClass = objectProto.toString,
        isProperty, forEach, undef;

    // Test the `Date#getUTC*` methods. Based on work by @Yaffle.
    var isExtended = new Date(-3509827334573292);
    try {
      // The `getUTCFullYear`, `Month`, and `Date` methods return nonsensical
      // results for certain dates in Opera >= 10.53.
      isExtended = isExtended.getUTCFullYear() == -109252 && isExtended.getUTCMonth() === 0 && isExtended.getUTCDate() === 1 &&
        // Safari < 2.0.2 stores the internal millisecond time value correctly,
        // but clips the values returned by the date methods to the range of
        // signed 32-bit integers ([-2 ** 31, 2 ** 31 - 1]).
        isExtended.getUTCHours() == 10 && isExtended.getUTCMinutes() == 37 && isExtended.getUTCSeconds() == 6 && isExtended.getUTCMilliseconds() == 708;
    } catch (exception) {}

    // Internal: Determines whether the native `JSON.stringify` and `parse`
    // implementations are spec-compliant. Based on work by Ken Snyder.
    function has(name) {
      if (has[name] !== undef) {
        // Return cached feature test result.
        return has[name];
      }
      var isSupported;
      if (name == "bug-string-char-index") {
        // IE <= 7 doesn't support accessing string characters using square
        // bracket notation. IE 8 only supports this for primitives.
        isSupported = "a"[0] != "a";
      } else if (name == "json") {
        // Indicates whether both `JSON.stringify` and `JSON.parse` are
        // supported.
        isSupported = has("json-stringify") && has("json-parse");
      } else {
        var value, serialized = '{"a":[1,true,false,null,"\\u0000\\b\\n\\f\\r\\t"]}';
        // Test `JSON.stringify`.
        if (name == "json-stringify") {
          var stringify = exports.stringify, stringifySupported = typeof stringify == "function" && isExtended;
          if (stringifySupported) {
            // A test function object with a custom `toJSON` method.
            (value = function () {
              return 1;
            }).toJSON = value;
            try {
              stringifySupported =
                // Firefox 3.1b1 and b2 serialize string, number, and boolean
                // primitives as object literals.
                stringify(0) === "0" &&
                // FF 3.1b1, b2, and JSON 2 serialize wrapped primitives as object
                // literals.
                stringify(new Number()) === "0" &&
                stringify(new String()) == '""' &&
                // FF 3.1b1, 2 throw an error if the value is `null`, `undefined`, or
                // does not define a canonical JSON representation (this applies to
                // objects with `toJSON` properties as well, *unless* they are nested
                // within an object or array).
                stringify(getClass) === undef &&
                // IE 8 serializes `undefined` as `"undefined"`. Safari <= 5.1.7 and
                // FF 3.1b3 pass this test.
                stringify(undef) === undef &&
                // Safari <= 5.1.7 and FF 3.1b3 throw `Error`s and `TypeError`s,
                // respectively, if the value is omitted entirely.
                stringify() === undef &&
                // FF 3.1b1, 2 throw an error if the given value is not a number,
                // string, array, object, Boolean, or `null` literal. This applies to
                // objects with custom `toJSON` methods as well, unless they are nested
                // inside object or array literals. YUI 3.0.0b1 ignores custom `toJSON`
                // methods entirely.
                stringify(value) === "1" &&
                stringify([value]) == "[1]" &&
                // Prototype <= 1.6.1 serializes `[undefined]` as `"[]"` instead of
                // `"[null]"`.
                stringify([undef]) == "[null]" &&
                // YUI 3.0.0b1 fails to serialize `null` literals.
                stringify(null) == "null" &&
                // FF 3.1b1, 2 halts serialization if an array contains a function:
                // `[1, true, getClass, 1]` serializes as "[1,true,],". FF 3.1b3
                // elides non-JSON values from objects and arrays, unless they
                // define custom `toJSON` methods.
                stringify([undef, getClass, null]) == "[null,null,null]" &&
                // Simple serialization test. FF 3.1b1 uses Unicode escape sequences
                // where character escape codes are expected (e.g., `\b` => `\u0008`).
                stringify({ "a": [value, true, false, null, "\x00\b\n\f\r\t"] }) == serialized &&
                // FF 3.1b1 and b2 ignore the `filter` and `width` arguments.
                stringify(null, value) === "1" &&
                stringify([1, 2], null, 1) == "[\n 1,\n 2\n]" &&
                // JSON 2, Prototype <= 1.7, and older WebKit builds incorrectly
                // serialize extended years.
                stringify(new Date(-8.64e15)) == '"-271821-04-20T00:00:00.000Z"' &&
                // The milliseconds are optional in ES 5, but required in 5.1.
                stringify(new Date(8.64e15)) == '"+275760-09-13T00:00:00.000Z"' &&
                // Firefox <= 11.0 incorrectly serializes years prior to 0 as negative
                // four-digit years instead of six-digit years. Credits: @Yaffle.
                stringify(new Date(-621987552e5)) == '"-000001-01-01T00:00:00.000Z"' &&
                // Safari <= 5.1.5 and Opera >= 10.53 incorrectly serialize millisecond
                // values less than 1000. Credits: @Yaffle.
                stringify(new Date(-1)) == '"1969-12-31T23:59:59.999Z"';
            } catch (exception) {
              stringifySupported = false;
            }
          }
          isSupported = stringifySupported;
        }
        // Test `JSON.parse`.
        if (name == "json-parse") {
          var parse = exports.parse;
          if (typeof parse == "function") {
            try {
              // FF 3.1b1, b2 will throw an exception if a bare literal is provided.
              // Conforming implementations should also coerce the initial argument to
              // a string prior to parsing.
              if (parse("0") === 0 && !parse(false)) {
                // Simple parsing test.
                value = parse(serialized);
                var parseSupported = value["a"].length == 5 && value["a"][0] === 1;
                if (parseSupported) {
                  try {
                    // Safari <= 5.1.2 and FF 3.1b1 allow unescaped tabs in strings.
                    parseSupported = !parse('"\t"');
                  } catch (exception) {}
                  if (parseSupported) {
                    try {
                      // FF 4.0 and 4.0.1 allow leading `+` signs and leading
                      // decimal points. FF 4.0, 4.0.1, and IE 9-10 also allow
                      // certain octal literals.
                      parseSupported = parse("01") !== 1;
                    } catch (exception) {}
                  }
                  if (parseSupported) {
                    try {
                      // FF 4.0, 4.0.1, and Rhino 1.7R3-R4 allow trailing decimal
                      // points. These environments, along with FF 3.1b1 and 2,
                      // also allow trailing commas in JSON objects and arrays.
                      parseSupported = parse("1.") !== 1;
                    } catch (exception) {}
                  }
                }
              }
            } catch (exception) {
              parseSupported = false;
            }
          }
          isSupported = parseSupported;
        }
      }
      return has[name] = !!isSupported;
    }

    if (!has("json")) {
      // Common `[[Class]]` name aliases.
      var functionClass = "[object Function]",
          dateClass = "[object Date]",
          numberClass = "[object Number]",
          stringClass = "[object String]",
          arrayClass = "[object Array]",
          booleanClass = "[object Boolean]";

      // Detect incomplete support for accessing string characters by index.
      var charIndexBuggy = has("bug-string-char-index");

      // Define additional utility methods if the `Date` methods are buggy.
      if (!isExtended) {
        var floor = Math.floor;
        // A mapping between the months of the year and the number of days between
        // January 1st and the first of the respective month.
        var Months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        // Internal: Calculates the number of days between the Unix epoch and the
        // first day of the given month.
        var getDay = function (year, month) {
          return Months[month] + 365 * (year - 1970) + floor((year - 1969 + (month = +(month > 1))) / 4) - floor((year - 1901 + month) / 100) + floor((year - 1601 + month) / 400);
        };
      }

      // Internal: Determines if a property is a direct property of the given
      // object. Delegates to the native `Object#hasOwnProperty` method.
      if (!(isProperty = objectProto.hasOwnProperty)) {
        isProperty = function (property) {
          var members = {}, constructor;
          if ((members.__proto__ = null, members.__proto__ = {
            // The *proto* property cannot be set multiple times in recent
            // versions of Firefox and SeaMonkey.
            "toString": 1
          }, members).toString != getClass) {
            // Safari <= 2.0.3 doesn't implement `Object#hasOwnProperty`, but
            // supports the mutable *proto* property.
            isProperty = function (property) {
              // Capture and break the object's prototype chain (see section 8.6.2
              // of the ES 5.1 spec). The parenthesized expression prevents an
              // unsafe transformation by the Closure Compiler.
              var original = this.__proto__, result = property in (this.__proto__ = null, this);
              // Restore the original prototype chain.
              this.__proto__ = original;
              return result;
            };
          } else {
            // Capture a reference to the top-level `Object` constructor.
            constructor = members.constructor;
            // Use the `constructor` property to simulate `Object#hasOwnProperty` in
            // other environments.
            isProperty = function (property) {
              var parent = (this.constructor || constructor).prototype;
              return property in this && !(property in parent && this[property] === parent[property]);
            };
          }
          members = null;
          return isProperty.call(this, property);
        };
      }

      // Internal: Normalizes the `for...in` iteration algorithm across
      // environments. Each enumerated key is yielded to a `callback` function.
      forEach = function (object, callback) {
        var size = 0, Properties, members, property;

        // Tests for bugs in the current environment's `for...in` algorithm. The
        // `valueOf` property inherits the non-enumerable flag from
        // `Object.prototype` in older versions of IE, Netscape, and Mozilla.
        (Properties = function () {
          this.valueOf = 0;
        }).prototype.valueOf = 0;

        // Iterate over a new instance of the `Properties` class.
        members = new Properties();
        for (property in members) {
          // Ignore all properties inherited from `Object.prototype`.
          if (isProperty.call(members, property)) {
            size++;
          }
        }
        Properties = members = null;

        // Normalize the iteration algorithm.
        if (!size) {
          // A list of non-enumerable properties inherited from `Object.prototype`.
          members = ["valueOf", "toString", "toLocaleString", "propertyIsEnumerable", "isPrototypeOf", "hasOwnProperty", "constructor"];
          // IE <= 8, Mozilla 1.0, and Netscape 6.2 ignore shadowed non-enumerable
          // properties.
          forEach = function (object, callback) {
            var isFunction = getClass.call(object) == functionClass, property, length;
            var hasProperty = !isFunction && typeof object.constructor != "function" && objectTypes[typeof object.hasOwnProperty] && object.hasOwnProperty || isProperty;
            for (property in object) {
              // Gecko <= 1.0 enumerates the `prototype` property of functions under
              // certain conditions; IE does not.
              if (!(isFunction && property == "prototype") && hasProperty.call(object, property)) {
                callback(property);
              }
            }
            // Manually invoke the callback for each non-enumerable property.
            for (length = members.length; property = members[--length]; hasProperty.call(object, property) && callback(property));
          };
        } else if (size == 2) {
          // Safari <= 2.0.4 enumerates shadowed properties twice.
          forEach = function (object, callback) {
            // Create a set of iterated properties.
            var members = {}, isFunction = getClass.call(object) == functionClass, property;
            for (property in object) {
              // Store each property name to prevent double enumeration. The
              // `prototype` property of functions is not enumerated due to cross-
              // environment inconsistencies.
              if (!(isFunction && property == "prototype") && !isProperty.call(members, property) && (members[property] = 1) && isProperty.call(object, property)) {
                callback(property);
              }
            }
          };
        } else {
          // No bugs detected; use the standard `for...in` algorithm.
          forEach = function (object, callback) {
            var isFunction = getClass.call(object) == functionClass, property, isConstructor;
            for (property in object) {
              if (!(isFunction && property == "prototype") && isProperty.call(object, property) && !(isConstructor = property === "constructor")) {
                callback(property);
              }
            }
            // Manually invoke the callback for the `constructor` property due to
            // cross-environment inconsistencies.
            if (isConstructor || isProperty.call(object, (property = "constructor"))) {
              callback(property);
            }
          };
        }
        return forEach(object, callback);
      };

      // Public: Serializes a JavaScript `value` as a JSON string. The optional
      // `filter` argument may specify either a function that alters how object and
      // array members are serialized, or an array of strings and numbers that
      // indicates which properties should be serialized. The optional `width`
      // argument may be either a string or number that specifies the indentation
      // level of the output.
      if (!has("json-stringify")) {
        // Internal: A map of control characters and their escaped equivalents.
        var Escapes = {
          92: "\\\\",
          34: '\\"',
          8: "\\b",
          12: "\\f",
          10: "\\n",
          13: "\\r",
          9: "\\t"
        };

        // Internal: Converts `value` into a zero-padded string such that its
        // length is at least equal to `width`. The `width` must be <= 6.
        var leadingZeroes = "000000";
        var toPaddedString = function (width, value) {
          // The `|| 0` expression is necessary to work around a bug in
          // Opera <= 7.54u2 where `0 == -0`, but `String(-0) !== "0"`.
          return (leadingZeroes + (value || 0)).slice(-width);
        };

        // Internal: Double-quotes a string `value`, replacing all ASCII control
        // characters (characters with code unit values between 0 and 31) with
        // their escaped equivalents. This is an implementation of the
        // `Quote(value)` operation defined in ES 5.1 section 15.12.3.
        var unicodePrefix = "\\u00";
        var quote = function (value) {
          var result = '"', index = 0, length = value.length, useCharIndex = !charIndexBuggy || length > 10;
          var symbols = useCharIndex && (charIndexBuggy ? value.split("") : value);
          for (; index < length; index++) {
            var charCode = value.charCodeAt(index);
            // If the character is a control character, append its Unicode or
            // shorthand escape sequence; otherwise, append the character as-is.
            switch (charCode) {
              case 8: case 9: case 10: case 12: case 13: case 34: case 92:
                result += Escapes[charCode];
                break;
              default:
                if (charCode < 32) {
                  result += unicodePrefix + toPaddedString(2, charCode.toString(16));
                  break;
                }
                result += useCharIndex ? symbols[index] : value.charAt(index);
            }
          }
          return result + '"';
        };

        // Internal: Recursively serializes an object. Implements the
        // `Str(key, holder)`, `JO(value)`, and `JA(value)` operations.
        var serialize = function (property, object, callback, properties, whitespace, indentation, stack) {
          var value, className, year, month, date, time, hours, minutes, seconds, milliseconds, results, element, index, length, prefix, result;
          try {
            // Necessary for host object support.
            value = object[property];
          } catch (exception) {}
          if (typeof value == "object" && value) {
            className = getClass.call(value);
            if (className == dateClass && !isProperty.call(value, "toJSON")) {
              if (value > -1 / 0 && value < 1 / 0) {
                // Dates are serialized according to the `Date#toJSON` method
                // specified in ES 5.1 section 15.9.5.44. See section 15.9.1.15
                // for the ISO 8601 date time string format.
                if (getDay) {
                  // Manually compute the year, month, date, hours, minutes,
                  // seconds, and milliseconds if the `getUTC*` methods are
                  // buggy. Adapted from @Yaffle's `date-shim` project.
                  date = floor(value / 864e5);
                  for (year = floor(date / 365.2425) + 1970 - 1; getDay(year + 1, 0) <= date; year++);
                  for (month = floor((date - getDay(year, 0)) / 30.42); getDay(year, month + 1) <= date; month++);
                  date = 1 + date - getDay(year, month);
                  // The `time` value specifies the time within the day (see ES
                  // 5.1 section 15.9.1.2). The formula `(A % B + B) % B` is used
                  // to compute `A modulo B`, as the `%` operator does not
                  // correspond to the `modulo` operation for negative numbers.
                  time = (value % 864e5 + 864e5) % 864e5;
                  // The hours, minutes, seconds, and milliseconds are obtained by
                  // decomposing the time within the day. See section 15.9.1.10.
                  hours = floor(time / 36e5) % 24;
                  minutes = floor(time / 6e4) % 60;
                  seconds = floor(time / 1e3) % 60;
                  milliseconds = time % 1e3;
                } else {
                  year = value.getUTCFullYear();
                  month = value.getUTCMonth();
                  date = value.getUTCDate();
                  hours = value.getUTCHours();
                  minutes = value.getUTCMinutes();
                  seconds = value.getUTCSeconds();
                  milliseconds = value.getUTCMilliseconds();
                }
                // Serialize extended years correctly.
                value = (year <= 0 || year >= 1e4 ? (year < 0 ? "-" : "+") + toPaddedString(6, year < 0 ? -year : year) : toPaddedString(4, year)) +
                  "-" + toPaddedString(2, month + 1) + "-" + toPaddedString(2, date) +
                  // Months, dates, hours, minutes, and seconds should have two
                  // digits; milliseconds should have three.
                  "T" + toPaddedString(2, hours) + ":" + toPaddedString(2, minutes) + ":" + toPaddedString(2, seconds) +
                  // Milliseconds are optional in ES 5.0, but required in 5.1.
                  "." + toPaddedString(3, milliseconds) + "Z";
              } else {
                value = null;
              }
            } else if (typeof value.toJSON == "function" && ((className != numberClass && className != stringClass && className != arrayClass) || isProperty.call(value, "toJSON"))) {
              // Prototype <= 1.6.1 adds non-standard `toJSON` methods to the
              // `Number`, `String`, `Date`, and `Array` prototypes. JSON 3
              // ignores all `toJSON` methods on these objects unless they are
              // defined directly on an instance.
              value = value.toJSON(property);
            }
          }
          if (callback) {
            // If a replacement function was provided, call it to obtain the value
            // for serialization.
            value = callback.call(object, property, value);
          }
          if (value === null) {
            return "null";
          }
          className = getClass.call(value);
          if (className == booleanClass) {
            // Booleans are represented literally.
            return "" + value;
          } else if (className == numberClass) {
            // JSON numbers must be finite. `Infinity` and `NaN` are serialized as
            // `"null"`.
            return value > -1 / 0 && value < 1 / 0 ? "" + value : "null";
          } else if (className == stringClass) {
            // Strings are double-quoted and escaped.
            return quote("" + value);
          }
          // Recursively serialize objects and arrays.
          if (typeof value == "object") {
            // Check for cyclic structures. This is a linear search; performance
            // is inversely proportional to the number of unique nested objects.
            for (length = stack.length; length--;) {
              if (stack[length] === value) {
                // Cyclic structures cannot be serialized by `JSON.stringify`.
                throw TypeError();
              }
            }
            // Add the object to the stack of traversed objects.
            stack.push(value);
            results = [];
            // Save the current indentation level and indent one additional level.
            prefix = indentation;
            indentation += whitespace;
            if (className == arrayClass) {
              // Recursively serialize array elements.
              for (index = 0, length = value.length; index < length; index++) {
                element = serialize(index, value, callback, properties, whitespace, indentation, stack);
                results.push(element === undef ? "null" : element);
              }
              result = results.length ? (whitespace ? "[\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "]" : ("[" + results.join(",") + "]")) : "[]";
            } else {
              // Recursively serialize object members. Members are selected from
              // either a user-specified list of property names, or the object
              // itself.
              forEach(properties || value, function (property) {
                var element = serialize(property, value, callback, properties, whitespace, indentation, stack);
                if (element !== undef) {
                  // According to ES 5.1 section 15.12.3: "If `gap` {whitespace}
                  // is not the empty string, let `member` {quote(property) + ":"}
                  // be the concatenation of `member` and the `space` character."
                  // The "`space` character" refers to the literal space
                  // character, not the `space` {width} argument provided to
                  // `JSON.stringify`.
                  results.push(quote(property) + ":" + (whitespace ? " " : "") + element);
                }
              });
              result = results.length ? (whitespace ? "{\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "}" : ("{" + results.join(",") + "}")) : "{}";
            }
            // Remove the object from the traversed object stack.
            stack.pop();
            return result;
          }
        };

        // Public: `JSON.stringify`. See ES 5.1 section 15.12.3.
        exports.stringify = function (source, filter, width) {
          var whitespace, callback, properties, className;
          if (objectTypes[typeof filter] && filter) {
            if ((className = getClass.call(filter)) == functionClass) {
              callback = filter;
            } else if (className == arrayClass) {
              // Convert the property names array into a makeshift set.
              properties = {};
              for (var index = 0, length = filter.length, value; index < length; value = filter[index++], ((className = getClass.call(value)), className == stringClass || className == numberClass) && (properties[value] = 1));
            }
          }
          if (width) {
            if ((className = getClass.call(width)) == numberClass) {
              // Convert the `width` to an integer and create a string containing
              // `width` number of space characters.
              if ((width -= width % 1) > 0) {
                for (whitespace = "", width > 10 && (width = 10); whitespace.length < width; whitespace += " ");
              }
            } else if (className == stringClass) {
              whitespace = width.length <= 10 ? width : width.slice(0, 10);
            }
          }
          // Opera <= 7.54u2 discards the values associated with empty string keys
          // (`""`) only if they are used directly within an object member list
          // (e.g., `!("" in { "": 1})`).
          return serialize("", (value = {}, value[""] = source, value), callback, properties, whitespace, "", []);
        };
      }

      // Public: Parses a JSON source string.
      if (!has("json-parse")) {
        var fromCharCode = String.fromCharCode;

        // Internal: A map of escaped control characters and their unescaped
        // equivalents.
        var Unescapes = {
          92: "\\",
          34: '"',
          47: "/",
          98: "\b",
          116: "\t",
          110: "\n",
          102: "\f",
          114: "\r"
        };

        // Internal: Stores the parser state.
        var Index, Source;

        // Internal: Resets the parser state and throws a `SyntaxError`.
        var abort = function () {
          Index = Source = null;
          throw SyntaxError();
        };

        // Internal: Returns the next token, or `"$"` if the parser has reached
        // the end of the source string. A token may be a string, number, `null`
        // literal, or Boolean literal.
        var lex = function () {
          var source = Source, length = source.length, value, begin, position, isSigned, charCode;
          while (Index < length) {
            charCode = source.charCodeAt(Index);
            switch (charCode) {
              case 9: case 10: case 13: case 32:
                // Skip whitespace tokens, including tabs, carriage returns, line
                // feeds, and space characters.
                Index++;
                break;
              case 123: case 125: case 91: case 93: case 58: case 44:
                // Parse a punctuator token (`{`, `}`, `[`, `]`, `:`, or `,`) at
                // the current position.
                value = charIndexBuggy ? source.charAt(Index) : source[Index];
                Index++;
                return value;
              case 34:
                // `"` delimits a JSON string; advance to the next character and
                // begin parsing the string. String tokens are prefixed with the
                // sentinel `@` character to distinguish them from punctuators and
                // end-of-string tokens.
                for (value = "@", Index++; Index < length;) {
                  charCode = source.charCodeAt(Index);
                  if (charCode < 32) {
                    // Unescaped ASCII control characters (those with a code unit
                    // less than the space character) are not permitted.
                    abort();
                  } else if (charCode == 92) {
                    // A reverse solidus (`\`) marks the beginning of an escaped
                    // control character (including `"`, `\`, and `/`) or Unicode
                    // escape sequence.
                    charCode = source.charCodeAt(++Index);
                    switch (charCode) {
                      case 92: case 34: case 47: case 98: case 116: case 110: case 102: case 114:
                        // Revive escaped control characters.
                        value += Unescapes[charCode];
                        Index++;
                        break;
                      case 117:
                        // `\u` marks the beginning of a Unicode escape sequence.
                        // Advance to the first character and validate the
                        // four-digit code point.
                        begin = ++Index;
                        for (position = Index + 4; Index < position; Index++) {
                          charCode = source.charCodeAt(Index);
                          // A valid sequence comprises four hexdigits (case-
                          // insensitive) that form a single hexadecimal value.
                          if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
                            // Invalid Unicode escape sequence.
                            abort();
                          }
                        }
                        // Revive the escaped character.
                        value += fromCharCode("0x" + source.slice(begin, Index));
                        break;
                      default:
                        // Invalid escape sequence.
                        abort();
                    }
                  } else {
                    if (charCode == 34) {
                      // An unescaped double-quote character marks the end of the
                      // string.
                      break;
                    }
                    charCode = source.charCodeAt(Index);
                    begin = Index;
                    // Optimize for the common case where a string is valid.
                    while (charCode >= 32 && charCode != 92 && charCode != 34) {
                      charCode = source.charCodeAt(++Index);
                    }
                    // Append the string as-is.
                    value += source.slice(begin, Index);
                  }
                }
                if (source.charCodeAt(Index) == 34) {
                  // Advance to the next character and return the revived string.
                  Index++;
                  return value;
                }
                // Unterminated string.
                abort();
              default:
                // Parse numbers and literals.
                begin = Index;
                // Advance past the negative sign, if one is specified.
                if (charCode == 45) {
                  isSigned = true;
                  charCode = source.charCodeAt(++Index);
                }
                // Parse an integer or floating-point value.
                if (charCode >= 48 && charCode <= 57) {
                  // Leading zeroes are interpreted as octal literals.
                  if (charCode == 48 && ((charCode = source.charCodeAt(Index + 1)), charCode >= 48 && charCode <= 57)) {
                    // Illegal octal literal.
                    abort();
                  }
                  isSigned = false;
                  // Parse the integer component.
                  for (; Index < length && ((charCode = source.charCodeAt(Index)), charCode >= 48 && charCode <= 57); Index++);
                  // Floats cannot contain a leading decimal point; however, this
                  // case is already accounted for by the parser.
                  if (source.charCodeAt(Index) == 46) {
                    position = ++Index;
                    // Parse the decimal component.
                    for (; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                    if (position == Index) {
                      // Illegal trailing decimal.
                      abort();
                    }
                    Index = position;
                  }
                  // Parse exponents. The `e` denoting the exponent is
                  // case-insensitive.
                  charCode = source.charCodeAt(Index);
                  if (charCode == 101 || charCode == 69) {
                    charCode = source.charCodeAt(++Index);
                    // Skip past the sign following the exponent, if one is
                    // specified.
                    if (charCode == 43 || charCode == 45) {
                      Index++;
                    }
                    // Parse the exponential component.
                    for (position = Index; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                    if (position == Index) {
                      // Illegal empty exponent.
                      abort();
                    }
                    Index = position;
                  }
                  // Coerce the parsed value to a JavaScript number.
                  return +source.slice(begin, Index);
                }
                // A negative sign may only precede numbers.
                if (isSigned) {
                  abort();
                }
                // `true`, `false`, and `null` literals.
                if (source.slice(Index, Index + 4) == "true") {
                  Index += 4;
                  return true;
                } else if (source.slice(Index, Index + 5) == "false") {
                  Index += 5;
                  return false;
                } else if (source.slice(Index, Index + 4) == "null") {
                  Index += 4;
                  return null;
                }
                // Unrecognized token.
                abort();
            }
          }
          // Return the sentinel `$` character if the parser has reached the end
          // of the source string.
          return "$";
        };

        // Internal: Parses a JSON `value` token.
        var get = function (value) {
          var results, hasMembers;
          if (value == "$") {
            // Unexpected end of input.
            abort();
          }
          if (typeof value == "string") {
            if ((charIndexBuggy ? value.charAt(0) : value[0]) == "@") {
              // Remove the sentinel `@` character.
              return value.slice(1);
            }
            // Parse object and array literals.
            if (value == "[") {
              // Parses a JSON array, returning a new JavaScript array.
              results = [];
              for (;; hasMembers || (hasMembers = true)) {
                value = lex();
                // A closing square bracket marks the end of the array literal.
                if (value == "]") {
                  break;
                }
                // If the array literal contains elements, the current token
                // should be a comma separating the previous element from the
                // next.
                if (hasMembers) {
                  if (value == ",") {
                    value = lex();
                    if (value == "]") {
                      // Unexpected trailing `,` in array literal.
                      abort();
                    }
                  } else {
                    // A `,` must separate each array element.
                    abort();
                  }
                }
                // Elisions and leading commas are not permitted.
                if (value == ",") {
                  abort();
                }
                results.push(get(value));
              }
              return results;
            } else if (value == "{") {
              // Parses a JSON object, returning a new JavaScript object.
              results = {};
              for (;; hasMembers || (hasMembers = true)) {
                value = lex();
                // A closing curly brace marks the end of the object literal.
                if (value == "}") {
                  break;
                }
                // If the object literal contains members, the current token
                // should be a comma separator.
                if (hasMembers) {
                  if (value == ",") {
                    value = lex();
                    if (value == "}") {
                      // Unexpected trailing `,` in object literal.
                      abort();
                    }
                  } else {
                    // A `,` must separate each object member.
                    abort();
                  }
                }
                // Leading commas are not permitted, object property names must be
                // double-quoted strings, and a `:` must separate each property
                // name and value.
                if (value == "," || typeof value != "string" || (charIndexBuggy ? value.charAt(0) : value[0]) != "@" || lex() != ":") {
                  abort();
                }
                results[value.slice(1)] = get(lex());
              }
              return results;
            }
            // Unexpected token encountered.
            abort();
          }
          return value;
        };

        // Internal: Updates a traversed object member.
        var update = function (source, property, callback) {
          var element = walk(source, property, callback);
          if (element === undef) {
            delete source[property];
          } else {
            source[property] = element;
          }
        };

        // Internal: Recursively traverses a parsed JSON object, invoking the
        // `callback` function for each value. This is an implementation of the
        // `Walk(holder, name)` operation defined in ES 5.1 section 15.12.2.
        var walk = function (source, property, callback) {
          var value = source[property], length;
          if (typeof value == "object" && value) {
            // `forEach` can't be used to traverse an array in Opera <= 8.54
            // because its `Object#hasOwnProperty` implementation returns `false`
            // for array indices (e.g., `![1, 2, 3].hasOwnProperty("0")`).
            if (getClass.call(value) == arrayClass) {
              for (length = value.length; length--;) {
                update(value, length, callback);
              }
            } else {
              forEach(value, function (property) {
                update(value, property, callback);
              });
            }
          }
          return callback.call(source, property, value);
        };

        // Public: `JSON.parse`. See ES 5.1 section 15.12.2.
        exports.parse = function (source, callback) {
          var result, value;
          Index = 0;
          Source = "" + source;
          result = get(lex());
          // If a JSON string contains multiple tokens, it is invalid.
          if (lex() != "$") {
            abort();
          }
          // Reset the parser state.
          Index = Source = null;
          return callback && getClass.call(callback) == functionClass ? walk((value = {}, value[""] = result, value), "", callback) : result;
        };
      }
    }

    exports["runInContext"] = runInContext;
    return exports;
  }

  if (freeExports && !isLoader) {
    // Export for CommonJS environments.
    runInContext(root, freeExports);
  } else {
    // Export for web browsers and JavaScript engines.
    var nativeJSON = root.JSON,
        previousJSON = root["JSON3"],
        isRestored = false;

    var JSON3 = runInContext(root, (root["JSON3"] = {
      // Public: Restores the original value of the global `JSON` object and
      // returns a reference to the `JSON3` object.
      "noConflict": function () {
        if (!isRestored) {
          isRestored = true;
          root.JSON = nativeJSON;
          root["JSON3"] = previousJSON;
          nativeJSON = previousJSON = null;
        }
        return JSON3;
      }
    }));

    root.JSON = {
      "parse": JSON3.parse,
      "stringify": JSON3.stringify
    };
  }

  // Export for asynchronous module loaders.
  if (isLoader) {
    define(function () {
      return JSON3;
    });
  }
}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
(function (global,__filename){
/*
 Yaku v0.7.4
 (c) 2015 Yad Smood. http://ysmood.org
 License MIT
*/
(function () {
    "use strict";

    var $nil
    , root = typeof global === "object" ? global : window
    , isLongStackTrace = false

    , $rejected = 0
    , $resolved = 1
    , $pending = 2

    , $promiseTrace = "_pt"
    , $settlerTrace = "_st"

    , $fromPrevious = "From previous event:",

    /**
     * This class follows the [Promises/A+](https://promisesaplus.com) and
     * [ES6](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-promise-objects) spec
     * with some extra helpers.
     * @param  {Function} executor Function object with three arguments resolve, reject and
     * the promise itself.
     * The first argument fulfills the promise, the second argument rejects it.
     * We can call these functions, once our operation is completed.
     * The `this` context of the executor is the promise itself, it can be used to add custom handlers,
     * such as `abort` or `progress` helpers.
     * @example
     * Here's an abort example.
     * ```js
     * var Promise = require('yaku');
     * var p = new Promise((resolve, reject) => {
     *     var tmr = setTimeout(resolve, 3000);
     *     this.abort = (reason) => {
     *         clearTimeout(tmr);
     *         reject(reason);
     *     };
     * });
     *
     * p.abort(new Error('abort'));
     * ```
     * @example
     * Here's a progress example.
     * ```js
     * var Promise = require('yaku');
     * var p = new Promise((resolve, reject) => {
     *     var self = this;
     *     var count = 0;
     *     var all = 100;
     *     var tmr = setInterval(() => {
     *         try {
     *             self.progress && self.progress(count, all);
     *         } catch (err) {
     *             reject(err);
     *         }
     *
     *         if (count < all)
     *             count++;
     *         else {
     *             resolve();
     *             clearInterval(tmr);
     *         }
     *     }, 1000);
     * });
     *
     * p.progress = (curr, all) => {
     *     console.log(curr, '/', all);
     * };
     * ```
     */
    Yaku = function (executor) {
        var self = this,
            err;

        if (isLongStackTrace) self[$promiseTrace] = genTraceInfo();

        if (executor !== $noop) {
            err = genTryCatcher(executor, self)(
                genSettler(self, $resolved),
                genSettler(self, $rejected)
            );

            if (err === $tryErr)
                settlePromise(self, $rejected, err.e);
        }
    };

    Yaku.prototype = {
        /**
         * Appends fulfillment and rejection handlers to the promise,
         * and returns a new promise resolving to the return value of the called handler.
         * @param  {Function} onFulfilled Optional. Called when the Promise is resolved.
         * @param  {Function} onRejected  Optional. Called when the Promise is rejected.
         * @return {Yaku} It will return a new Yaku which will resolve or reject after
         * @example
         * the current Promise.
         * ```js
         * var Promise = require('yaku');
         * var p = Promise.resolve(10);
         *
         * p.then((v) => {
         *     console.log(v);
         * });
         * ```
         */
        then: function (onFulfilled, onRejected) {
            return addHandler(this, newEmptyYaku(), onFulfilled, onRejected);
        },

        /**
         * The `catch()` method returns a Promise and deals with rejected cases only.
         * It behaves the same as calling `Promise.prototype.then(undefined, onRejected)`.
         * @param  {Function} onRejected A Function called when the Promise is rejected.
         * This function has one argument, the rejection reason.
         * @return {Yaku} A Promise that deals with rejected cases only.
         * @example
         * ```js
         * var Promise = require('yaku');
         * var p = Promise.reject(10);
         *
         * p['catch']((v) => {
         *     console.log(v);
         * });
         * ```
         */
        "catch": function (onRejected) {
            return this.then($nil, onRejected);
        },

        // Default state
        _state: $pending,

        // The number of current promises that attach to this Yaku instance.
        _pCount: 0,

        // The parent Yaku.
        _pre: null
    };

    /**
     * The `Promise.resolve(value)` method returns a Promise object that is resolved with the given value.
     * If the value is a thenable (i.e. has a then method), the returned promise will "follow" that thenable,
     * adopting its eventual state; otherwise the returned promise will be fulfilled with the value.
     * @param  {Any} value Argument to be resolved by this Promise.
     * Can also be a Promise or a thenable to resolve.
     * @return {Yaku}
     * @example
     * ```js
     * var Promise = require('yaku');
     * var p = Promise.resolve(10);
     * ```
     */
    Yaku.resolve = function (val) {
        if (val instanceof Yaku)
            return val;
        else
            return settleWithX(newEmptyYaku(), val);
    };

    /**
     * The `Promise.reject(reason)` method returns a Promise object that is rejected with the given reason.
     * @param  {Any} reason Reason why this Promise rejected.
     * @return {Yaku}
     * @example
     * ```js
     * var Promise = require('yaku');
     * var p = Promise.reject(10);
     * ```
     */
    Yaku.reject = function (reason) {
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
     * ```js
     * var Promise = require('yaku');
     * Promise.race([
     *     123,
     *     Promise.resolve(0)
     * ])
     * .then((value) => {
     *     console.log(value); // => 123
     * });
     * ```
     */
    Yaku.race = function (iterable) {
        assertIterable(iterable);

        var len = iterable.length;

        if (len === 0) return Yaku.resolve([]);

        var p = newEmptyYaku()
            , i = 0;
        while (i < len) {
            settleWithX(p, iterable[i++]);
            if (p._state !== $pending) break;
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
     * ```js
     * var Promise = require('yaku');
     * Promise.all([
     *     123,
     *     Promise.resolve(0)
     * ])
     * .then((values) => {
     *     console.log(values); // => [123, 0]
     * });
     * ```
     */
    Yaku.all = function (iterable) {
        assertIterable(iterable);

        var convertor = Yaku.resolve
            , countDown
            , len = countDown = iterable.length;

        if (len === 0) return convertor([]);

        var p1 = newEmptyYaku()
        , res = []
        , i = 0

        , onRejected = function (reason) {
            settlePromise(p1, $rejected, reason);
        }

        , iter = function (j) {
            convertor(iterable[j]).then(function (value) {
                res[j] = value;
                if (!--countDown) settlePromise(p1, $resolved, res);
            }, onRejected);
        };

        while (i < len) iter(i++);

        return p1;
    };

    /**
     * Catch all possibly unhandled rejections. If you want to use specific
     * format to display the error stack, overwrite it.
     * If it is set, auto `console.error` unhandled rejection will be disabed.
     * @param {Any} reason The rejection reason.
     * @param {Yaku} p The promise that was rejected.
     * @example
     * ```js
     * var Promise = require('yaku');
     * Promise.onUnhandledRejection = (reason) => {
     *     console.error(reason);
     * };
     *
     * # The console will log an unhandled rejection error message.
     * Promise.reject('my reason');
     *
     * # The below won't log the unhandled rejection error message.
     * Promise.reject('v').catch(() => {});
     * ```
     */
    Yaku.onUnhandledRejection = function (reason, p) {
        if (root.console) {
            var info = genStackInfo(reason, p);
            console.error("Unhandled Rejection:", info[0], info[1] || "");
        }
    };

    /**
     * It is used to enable the long stack trace.
     * Once it is enabled, it can't be reverted.
     * While it is very helpful in development and testing environments,
     * it is not recommended to use it in production. It will slow down your
     * application and waste your memory.
     * @example
     * ```js
     * var Promise = require('yaku');
     * Promise.enableLongStackTrace();
     * ```
     */
    Yaku.enableLongStackTrace = function () {
        isLongStackTrace = true;
    };

    /**
     * Only Node has `process.nextTick` function. For browser there are
     * so many ways to polyfill it. Yaku won't do it for you, instead you
     * can choose what you prefer. For example, this project
     * [setImmediate](https://github.com/YuzuJS/setImmediate).
     * By default, Yaku will use `process.nextTick` on Node, `setTimeout` on browser.
     * @type {Function}
     * @example
     * ```js
     * var Promise = require('yaku');
     * Promise.nextTick = fn => window.setImmediate(fn);
     * ```
     * @example
     * You can even use sync resolution if you really know what you are doing.
     * ```js
     * var Promise = require('yaku');
     * Promise.nextTick = fn => fn();
     * ```
     */
    Yaku.nextTick = root.process ?
        root.process.nextTick :
        function (fn) { setTimeout(fn); };


// ********************** Private **********************

    /**
     * All static variable name will begin with `$`. Such as `$rejected`.
     * @private
     */

    // ******************************* Utils ********************************

    var $tryCatchFn
    , $tryCatchThis
    , $tryErr = { e: null }
    , $noop = {};

    function isObject (obj) {
        return typeof obj === "object";
    }

    function isFunction (obj) {
        return typeof obj === "function";
    }

    /**
     * Wrap a function into a try-catch.
     * @private
     * @return {Any | $tryErr}
     */
    function tryCatcher () {
        try {
            return $tryCatchFn.apply($tryCatchThis, arguments);
        } catch (e) {
            $tryErr.e = e;
            return $tryErr;
        }
    }

    /**
     * Generate a try-catch wrapped function.
     * @private
     * @param  {Function} fn
     * @return {Function}
     */
    function genTryCatcher (fn, self) {
        $tryCatchFn = fn;
        $tryCatchThis = self;
        return tryCatcher;
    }

    /**
     * Generate a scheduler.
     * @private
     * @param  {Integer}  initQueueSize
     * @param  {Function} fn `(Yaku, Value) ->` The schedule handler.
     * @return {Function} `(Yaku, Value) ->` The scheduler.
     */
    function genScheduler (initQueueSize, fn) {
        /**
         * All async promise will be scheduled in
         * here, so that they can be execute on the next tick.
         * @private
         */
        var fnQueue = Array(initQueueSize)
        , fnQueueLen = 0;

        /**
         * Run all queued functions.
         * @private
         */
        function flush () {
            var i = 0;
            while (i < fnQueueLen) {
                fn(fnQueue[i], fnQueue[i + 1]);
                fnQueue[i++] = $nil;
                fnQueue[i++] = $nil;
            }

            fnQueueLen = 0;
            if (fnQueue.length > initQueueSize) fnQueue.length = initQueueSize;
        }

        return function (v, arg) {
            fnQueue[fnQueueLen++] = v;
            fnQueue[fnQueueLen++] = arg;

            if (fnQueueLen === 2) Yaku.nextTick(flush);
        };
    }

    /**
     * Check if a variable is an iterable object.
     * @private
     * @param  {Any}  obj
     * @return {Boolean}
     */
    function assertIterable (obj) {
        if (!obj instanceof Array) throw genTypeError("invalid_argument");
    }

    /**
     * Generate type error object.
     * @private
     * @param  {String} msg
     * @return {TypeError}
     */
    function genTypeError (msg) {
        return new TypeError(msg);
    }

    function genTraceInfo (noTitle) {
        return (new Error()).stack.replace(
            "Error",
            noTitle ? "" : $fromPrevious
        );
    }


    // *************************** Promise Hepers ****************************

    /**
     * Resolve the value returned by onFulfilled or onRejected.
     * @private
     * @param {Yaku} p1
     * @param {Yaku} p2
     */
    var scheduleHandler = genScheduler(999, function (p1, p2) {
        var x
        , p2
        , handler;

        // 2.2.2
        // 2.2.3
        handler = p1._state ? p2._onFulfilled : p2._onRejected;

        // 2.2.7.3
        // 2.2.7.4
        if (handler === $nil) {
            settlePromise(p2, p1._state, p1._value);
            return;
        }

        // 2.2.7.1
        x = genTryCatcher(callHanler)(handler, p1._value);
        if (x === $tryErr) {
            // 2.2.7.2
            settlePromise(p2, $rejected, x.e);
            return;
        }

        settleWithX(p2, x);
    })

    // Why are there two "genScheduler"s?
    // Well, to support the babel's es7 async-await polyfill, I have to hack it.
    , scheduleUnhandledRejection = genScheduler(
        9,
        genScheduler(9, function (p) {
            if (!hashOnRejected(p))
                Yaku.onUnhandledRejection(p._value, p);
        })
    );

    /**
     * Create an empty promise.
     * @private
     * @return {Yaku}
     */
    function newEmptyYaku () { return new Yaku($noop); }

    /**
     * It will produce a settlePromise function to user.
     * Such as the resolve and reject in this `new Yaku (resolve, reject) ->`.
     * @private
     * @param  {Yaku} self
     * @param  {Integer} state The value is one of `$pending`, `$resolved` or `$rejected`.
     * @return {Function} `(value) -> undefined` A resolve or reject function.
     */
    function genSettler (self, state) { return function (value) {
        if (isLongStackTrace)
            self[$settlerTrace] = genTraceInfo(true);

        if (state === $resolved)
            settleWithX(self, value);
        else
            settlePromise(self, state, value);
    }; }

    /**
     * Link the promise1 to the promise2.
     * @private
     * @param {Yaku} p1
     * @param {Yaku} p2
     * @param {Function} onFulfilled
     * @param {Function} onRejected
     */
    function addHandler (p1, p2, onFulfilled, onRejected) {
        // 2.2.1
        if (isFunction(onFulfilled))
            p2._onFulfilled = onFulfilled;
        if (isFunction(onRejected))
            p2._onRejected = onRejected;

        if (isLongStackTrace) p2._pre = p1;
        p1[p1._pCount++] = p2;

        // 2.2.6
        if (p1._state !== $pending)
            scheduleHandler(p1, p2);

        // 2.2.7
        return p2;
    }

    // iter tree
    function hashOnRejected (node) {
        // A node shouldn't be checked twice.
        if (node._umark)
            return true;
        else
            node._umark = true;

        var i = 0
        , len = node._pCount
        , child;

        while (i < len) {
            child = node[i++];
            if (child._onRejected || hashOnRejected(child)) return true;
        }
    }

    function genStackInfo (reason, p) {
        var stackInfo = []
        , stackStr
        , i
        , filename;

        function trim (str) { return str.replace(/^\s+|\s+$/g, ""); }

        function push (trace) {
            return stackInfo.push(trim(trace));
        }

        if (isLongStackTrace && p[$promiseTrace]) {
            if (p[$settlerTrace])
                push(p[$settlerTrace]);

            // Hope you guys could understand how the back trace works.
            // We only have to iter through the tree from the bottom to root.
            (function iter (node) {
                if (node) {
                    iter(node._next);
                    push(node[$promiseTrace]);
                    iter(node._pre);
                }
            })(p);
        }

        stackStr = "\n" + stackInfo.join("\n");

        function clean (stack, cleanPrev) {
            if (cleanPrev && (i = stack.indexOf("\n" + $fromPrevious)) > 0)
                stack = stack.slice(0, i);

            return typeof __filename === "string" ?
                (
                    filename = __filename,
                    stack.replace(RegExp(".+" + filename + ".+\\n?", "g"), "")
                ) : stack;
        }

        return [(
            reason ?
                reason.stack ?
                    clean(trim(reason.stack), true)
                :
                    reason
            :
                reason
        ), clean(stackStr)];
    }

    function callHanler (handler, value) {
        // 2.2.5
        return handler(value);
    }

    /**
     * Resolve or reject a promise.
     * @private
     * @param  {Yaku} p
     * @param  {Integer} state
     * @param  {Any} value
     */
    function settlePromise (p, state, value) {
        var i = 0
        , len = p._pCount
        , p2
        , stack;

        // 2.1.2
        // 2.1.3
        if (p._state === $pending) {
            // 2.1.1.1
            p._state = state;
            p._value = value;

            if (state === $rejected) {
                if (isLongStackTrace && value && value.stack) {
                    stack = genStackInfo(value, p);
                    value.stack = stack[0] + stack[1];
                }

                scheduleUnhandledRejection(p);
            }

            // 2.2.4
            while (i < len) {
                p2 = p[i++];

                if (p2._state !== $pending) continue;

                scheduleHandler(p, p2);
            }
        }

        return p;
    }

    /**
     * Resolve or reject primise with value x. The x can also be a thenable.
     * @private
     * @param {Yaku} p
     * @param {Any | Thenable} x A normal value or a thenable.
     */
    function settleWithX (p, x) {
        // 2.3.1
        if (x === p && x) {
            settlePromise(p, $rejected, genTypeError("promise_circular_chain"));
            return p;
        }

        // 2.3.2
        // 2.3.3
        if (x != null && (isFunction(x) || isObject(x))) {
            // 2.3.2.1
            var xthen = genTryCatcher(getThen)(x);

            if (xthen === $tryErr) {
                // 2.3.3.2
                settlePromise(p, $rejected, xthen.e);
                return p;
            }

            if (isFunction(xthen)) {
                if (isLongStackTrace && x instanceof Yaku)
                    p._next = x;

                settleXthen(p, x, xthen);
            }
            else
                // 2.3.3.4
                settlePromise(p, $resolved, x);
        } else
            // 2.3.4
            settlePromise(p, $resolved, x);

        return p;
    }

    /**
     * Try to get a promise's then method.
     * @private
     * @param  {Thenable} x
     * @return {Function}
     */
    function getThen (x) { return x.then; }

    /**
     * Resolve then with its promise.
     * @private
     * @param  {Yaku} p
     * @param  {Thenable} x
     * @param  {Function} xthen
     */
    function settleXthen (p, x, xthen) {
        // 2.3.3.3
        var err = genTryCatcher(xthen, x)(function (y) {
            // 2.3.3.3.3
            if (x) {
                x = null;

                // 2.3.3.3.1
                settleWithX(p, y);
            }
        }, function (r) {
            // 2.3.3.3.3
            if (x) {
                x = null;

                // 2.3.3.3.2
                settlePromise(p, $rejected, r);
            }
        });

        // 2.3.3.3.4.1
        if (err === $tryErr && x) {
            // 2.3.3.3.4.2
            settlePromise(p, $rejected, err.e);
            x = null;
        }
    }

    // CMD & AMD Support
    try {
        module.exports = Yaku;
    } catch (e) {
        try {
            define(function () { return Yaku; }); // eslint-disable-line
        } catch (ee) {
            root.Yaku = Yaku;
        }
    }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},"/node_modules/yaku/lib/yaku.js")
},{}],4:[function(require,module,exports){
var API, Endpoint, Resource;

Endpoint = require('./endpoint');

Resource = require('./resource');

API = (function() {
  module.exports = API;

  API.load = function(url, auth) {
    return new Endpoint(url).get().then(function(response) {
      return new API(response.body, {
        ip: response.headers['x-client-ip'],
        country: response.headers['x-client-country'],
        currency: response.headers['x-client-currency'],
        language: response.headers['x-client-language']
      }, auth);
    });
  };

  function API(manifest, client, auth1) {
    var key, ref, schema;
    this.manifest = manifest;
    this.client = client;
    this.auth = auth1;
    ref = this.manifest.schema;
    for (key in ref) {
      schema = ref[key];
      if (schema.singleton) {
        (function(_this) {
          return (function(key, schema) {
            return _this[key] = function(params) {
              var endpoint;
              return (endpoint = new Endpoint(this.manifest.origin, schema.path, this.auth)).get().then((function(_this) {
                return function(arg) {
                  var body;
                  body = arg.body;
                  return Resource.load(_this, schema, endpoint, body);
                };
              })(this));
            };
          });
        })(this)(key, schema);
      }
    }
  }

  return API;

})();


},{"./endpoint":6,"./resource":9}],5:[function(require,module,exports){
var Collection, EventEmitter, TicketingHub, extend, merge, ref,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

ref = require('./util'), merge = ref.merge, extend = ref.extend;

TicketingHub = require('./ticketinghub');

EventEmitter = require('events').EventEmitter;

Collection = (function(superClass) {
  var Resource, fn, i, len, method, ref1;

  extend1(Collection, superClass);

  module.exports = Collection;

  Resource = require('./resource');

  function Collection(api, schema, endpoint, params) {
    this.api = api;
    this.schema = schema;
    this.endpoint = endpoint;
    this._params = extend({}, params || {});
    Collection.__super__.constructor.call(this);
  }

  Collection.prototype.each = function(params, callback) {
    var dispatch, fetch, index, ref1;
    if (typeof params === 'function') {
      ref1 = [callback, params], params = ref1[0], callback = ref1[1];
    }
    params = this.params(params);
    index = (params.offset || (params.offset = 0));
    dispatch = (function(_this) {
      return function(results) {
        var i, len, resource, result;
        for (i = 0, len = results.length; i < len; i++) {
          result = results[i];
          resource = Resource.load(_this.api, _this.schema, _this.endpoint, result);
          if (callback(resource, index++, _this._count) === false) {
            return false;
          }
        }
        return true;
      };
    })(this);
    fetch = (function(_this) {
      return function() {
        return _this.endpoint.get(params).then(function(response) {
          _this._count = parseInt(response.headers['x-total-count']);
          if (dispatch(response.body) && index < _this._count - 1) {
            return fetch(params.offset = index);
          }
        });
      };
    })(this);
    fetch();
    return this;
  };

  Collection.prototype.slice = function(start, end) {
    return this.count().then((function(_this) {
      return function(count) {
        start = start < 0 ? count + start : start;
        end = Math.min(count, (end ? (end < 0 ? count + end : end) : count));
        if (start >= count) {
          return [];
        }
        return new TicketingHub.Promise(function(resolve, reject) {
          var resources;
          resources = [];
          return _this.each({
            offset: start,
            limit: end - start
          }, function(resource, index, count) {
            end = Math.min(count, (end ? (end < 0 ? count + end : end) : count));
            resources.push(resource);
            if (end === (index + 1)) {
              resolve(resources);
              return false;
            }
          });
        });
      };
    })(this));
  };

  Collection.prototype.all = function() {
    return this.slice(0);
  };

  Collection.prototype.scope = function(path, params) {
    if (params == null) {
      params = {};
    }
    return new Collection(this.api, this.schema, this.endpoint.join(path), this.params(params));
  };

  Collection.prototype.filter = function(filters) {
    return new Collection(this.api, this.schema, this.endpoint, this.params({
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

  ref1 = ['get', 'post', 'patch', 'delete'];
  fn = function(method) {
    return Collection.prototype[method] = function() {
      var args, ref2;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return (ref2 = this.endpoint)[method].apply(ref2, args);
    };
  };
  for (i = 0, len = ref1.length; i < len; i++) {
    method = ref1[i];
    fn(method);
  }

  Collection.prototype.create = function(attributes) {
    return this.endpoint.post(attributes).then((function(_this) {
      return function(response) {
        return Resource.load(_this.api, _this.schema, _this.endpoint, response.body);
      };
    })(this))["catch"]((function(_this) {
      return function(error) {
        if ((error instanceof TicketingHub.RequestError) && error.response.status === 422) {
          throw new TicketingHub.ValidationError(Resource.load(_this.api, _this.schema, _this.endpoint, error.response.body));
        } else {
          throw error;
        }
      };
    })(this));
  };

  Collection.prototype.reload = function(params) {
    return this.endpoint.head(this.params(params)).then((function(_this) {
      return function(response) {
        if ('x-total-count' in response.headers) {
          _this._count = parseInt(response.headers['x-total-count']);
        }
        return _this;
      };
    })(this));
  };

  Collection.prototype.params = function(params) {
    return merge(this._params, params || {});
  };

  return Collection;

})(EventEmitter);


},{"./resource":9,"./ticketinghub":11,"./util":12,"events":1}],6:[function(require,module,exports){
(function (global){
var Endpoint, Response, TicketingHub, extend, join, util,
  slice = [].slice;

extend = require('./util').extend;

Response = require('./response');

util = require('./util');

TicketingHub = require('./ticketinghub');

join = function() {
  var args;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  return args.join('/').replace(/[\/]+/g, '/').replace(/\/\?/g, '?').replace(/\/\#/g, '#').replace(/\:\//g, '://').replace(/\/$/g, '');
};

Endpoint = (function() {
  var RETRIES, TIMEOUT, fn, i, len, method, ref;

  module.exports = Endpoint;

  TIMEOUT = 10 * 1000;

  RETRIES = 6;

  function Endpoint(origin, path1, auth1) {
    this.origin = origin;
    this.path = path1 != null ? path1 : '';
    this.auth = auth1 != null ? auth1 : '';
    this.url = join(this.origin, this.path);
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
    return new Endpoint(this.origin, join(this.path, path), auth);
  };

  ref = ['head', 'get', 'post', 'patch', 'delete'];
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
    var href, id;
    if (path == null) {
      path = '';
    }
    id = util.generateUUID();
    href = path[0] === '/' ? join(this.origin, path) : path ? join(this.url, path) : this.url;
    return new TicketingHub.Promise((function(_this) {
      return function(resolve, reject) {
        var agent, callback, handle, interval, json_params, options, parts, query, req, request, scripts, url;
        json_params = encodeURIComponent(TicketingHub.JSON.stringify(params || {}));
        query = "?_id=" + id + "&_json=" + json_params + "&_method=" + (method.toLowerCase());
        if (!href.match(/\.json$/)) {
          href = href + ".json";
        }
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
          scripts = [];
          request = function() {
            var script, sibling;
            scripts.push(script = document.createElement('script'));
            script.defer = script.async = true;
            script.src = "" + href + query + "&_token=" + _this.auth + "&_callback=" + callback + "&_=" + scripts.length;
            sibling = document.getElementsByTagName('script')[0];
            return sibling.parentNode.insertBefore(script, sibling);
          };
          interval = setInterval(function() {
            var j, len1, script;
            if (scripts.length < RETRIES) {
              return request();
            } else {
              for (j = 0, len1 = scripts.length; j < len1; j++) {
                script = scripts[j];
                try {
                  script.parentNode.removeChild(script);
                } catch (undefined) {}
              }
              global[callback] = function() {};
              return reject(new TicketingHub.ConnectionError('Request timed out.'));
            }
          }, TIMEOUT);
          global[callback] = function(body, status, headers) {
            var j, len1, script;
            clearInterval(interval);
            global[callback] = function() {};
            for (j = 0, len1 = scripts.length; j < len1; j++) {
              script = scripts[j];
              try {
                script.parentNode.removeChild(script);
              } catch (undefined) {}
            }
            return handle(new Response(status, body, headers));
          };
          return request();
        } else {
          url = 'url';
          parts = require(url).parse(href);
          options = {
            method: 'GET',
            scheme: parts.protocol.slice(0, -1),
            host: parts.hostname,
            port: parts.port,
            auth: _this.auth + ":",
            path: "" + parts.path + query,
            headers: {
              accept: 'application/json'
            }
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
},{"./response":10,"./ticketinghub":11,"./util":12}],7:[function(require,module,exports){
var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

exports.RequestError = (function(superClass) {
  extend(RequestError, superClass);

  function RequestError(response) {
    var ref, ref1;
    this.response = response;
    this.name = 'RequestError';
    this.message = ((ref = this.response.body) != null ? ref.error_description : void 0) || this.response.body;
    this.errorCode = (ref1 = this.response.body) != null ? ref1.error : void 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, exports.RequestError);
    } else {
      this.stack = (new Error).stack;
    }
  }

  return RequestError;

})(Error);

exports.ServerError = (function(superClass) {
  extend(ServerError, superClass);

  function ServerError(response) {
    var ref, ref1;
    this.response = response;
    this.name = 'ServerError';
    this.message = ((ref = this.response.body) != null ? ref.error_description : void 0) || this.response.body;
    this.errorCode = (ref1 = this.response.body) != null ? ref1.error : void 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, exports.ServerError);
    } else {
      this.stack = (new Error).stack;
    }
  }

  return ServerError;

})(Error);

exports.ConnectionError = (function(superClass) {
  extend(ConnectionError, superClass);

  function ConnectionError(message) {
    this.message = message;
    this.name = 'ConnectionError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, exports.ConnectionError);
    } else {
      this.stack = (new Error).stack;
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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, exports.ValidationError);
    } else {
      this.stack = (new Error).stack;
    }
  }

  return ValidationError;

})(exports.RequestError);


},{}],8:[function(require,module,exports){
(function (global){
module.exports = require('./ticketinghub');

if (typeof global.window !== 'undefined') {
  global.window.TicketingHub = module.exports;
}


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ticketinghub":11}],9:[function(require,module,exports){
var EventEmitter, Resource, TicketingHub, extend, merge, ref, util,
  extend1 = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

ref = require('./util'), merge = ref.merge, extend = ref.extend;

util = require('./util');

EventEmitter = require('events').EventEmitter;

TicketingHub = require('./ticketinghub');

Resource = (function(superClass) {
  var Collection;

  extend1(Resource, superClass);

  module.exports = Resource;

  Collection = require('./collection');

  Resource.load = function(api, arg, endpoint, body) {
    var associations, collections, endpoints, fields, id, path, singleton, type, types;
    id = arg.id, path = arg.path, singleton = arg.singleton, fields = arg.fields, associations = arg.associations, collections = arg.collections, endpoints = arg.endpoints, types = arg.types;
    if (type = types != null ? types[body.type] : void 0) {
      if (type.path) {
        path = type.path;
      }
      associations = associations.concat(type.associations || []);
      collections = merge(collections, type.collections || {});
      fields = merge(fields, type.fields || {});
    }
    path = singleton ? path : path + "/" + body[id || 'id'];
    return new Resource(api, {
      id: id,
      fields: fields,
      associations: associations,
      endpoints: endpoints,
      collections: collections
    }, endpoint.base(path), body);
  };

  function Resource(_api, _schema, _endpoint, attributes) {
    var association, associations, collections, endpoints, fields, fn, fn1, fn2, i, key, len, listening, method, ref1, ref2, ref3, ref4, resource;
    this._api = _api;
    this._schema = _schema;
    this._endpoint = _endpoint;
    Resource.__super__.constructor.call(this);
    ref1 = this._schema, fields = ref1.fields, associations = ref1.associations, collections = ref1.collections, endpoints = ref1.endpoints;
    ref2 = associations || [];
    fn = (function(_this) {
      return function(association) {
        return _this[association + "="] = function(attributes) {
          return this[association] = attributes && Resource.load(this._api, this._api.manifest.schema[association], this._endpoint, attributes);
        };
      };
    })(this);
    for (i = 0, len = ref2.length; i < len; i++) {
      association = ref2[i];
      fn(association);
    }
    ref3 = collections || {};
    fn1 = (function(_this) {
      return function(key, resource) {
        return _this[key] = function() {
          var args, ref4, schema;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          schema = this._api.manifest.schema[resource];
          if (typeof args[0] === 'string') {
            return (ref4 = this._endpoint).get.apply(ref4, [schema.path + "/" + args[0]].concat(slice.call(args.slice(1)))).then((function(_this) {
              return function(response) {
                return Resource.load(_this._api, schema, _this._endpoint, response.body);
              };
            })(this));
          } else {
            return new Collection(this._api, schema, this._endpoint.join(key), args[0]);
          }
        };
      };
    })(this);
    for (key in ref3) {
      resource = ref3[key];
      fn1(key, resource);
    }
    ref4 = endpoints || {};
    fn2 = (function(_this) {
      return function(key, method) {
        return _this[key] = function() {
          var args, ref5;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          return (ref5 = this._endpoint)[method].apply(ref5, [key].concat(slice.call(args)));
        };
      };
    })(this);
    for (key in ref4) {
      method = ref4[key];
      fn2(key, method);
    }
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
                return setTimeout(retry, util.timeDecay(_this.updated_at));
              });
            };
            return setTimeout(retry, util.timeDecay(_this.updated_at));
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
        if ((error instanceof TicketingHub.RequestError) && error.response.status === 422) {
          throw new TicketingHub.ValidationError(_this._setup(error.response.body));
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

  Resource.prototype.toString = function() {
    return this[this._schema.id];
  };

  return Resource;

})(EventEmitter);


},{"./collection":5,"./ticketinghub":11,"./util":12,"events":1}],10:[function(require,module,exports){
var Response, TicketingHub;

TicketingHub = require('./ticketinghub');

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
    if (/json/.test(this.headers['content-type']) && body.length >= 2) {
      body = TicketingHub.JSON.parse(body);
    }
    this.body = body;
  }

  return Response;

})();


},{"./ticketinghub":11}],11:[function(require,module,exports){
var ConnectionError, Endpoint, RequestError, ServerError, TicketingHub, ValidationError, ref;

ref = require('./errors'), RequestError = ref.RequestError, ServerError = ref.ServerError, ConnectionError = ref.ConnectionError, ValidationError = ref.ValidationError;

TicketingHub = (function() {
  function TicketingHub() {}

  module.exports = TicketingHub;

  TicketingHub.API = require('./api');

  TicketingHub.Promise = require('yaku');

  TicketingHub.JSON = require('json3');

  TicketingHub.RequestError = RequestError;

  TicketingHub.ServerError = ServerError;

  TicketingHub.ConnectionError = ConnectionError;

  TicketingHub.ValidationError = ValidationError;

  TicketingHub.TicketingHub = TicketingHub;

  return TicketingHub;

})();

Endpoint = require('./endpoint');

TicketingHub.endpoint = new Endpoint('https://api.ticketinghub.com');


},{"./api":4,"./endpoint":6,"./errors":7,"json3":2,"yaku":3}],12:[function(require,module,exports){
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

exports.extend = function(a, b) {
  var key, value;
  for (key in b) {
    value = b[key];
    a[key] = value;
  }
  return a;
};

exports.merge = function(a, b) {
  var value;
  value = exports.extend({}, a);
  exports.extend(value, b);
  return value;
};

exports.generateUUID = function() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function(a) {
    return (a ^ Math.random() * 16 >> a / 4).toString(16);
  });
};

exports.timeDecay = (function(_this) {
  return function(date) {
    var seconds;
    if (typeof date === 'string') {
      date = exports.parseISO8601DateTime(date);
    }
    seconds = (Number(new Date) - Number(date)) / 1000;
    return Math.log(1 + seconds, Math.E) * 1000;
  };
})(this);


},{}]},{},[8]);
