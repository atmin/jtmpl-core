!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jtmpl=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = function(opts) {
  return new ElementClass(opts)
}

function ElementClass(opts) {
  if (!(this instanceof ElementClass)) return new ElementClass(opts)
  var self = this
  if (!opts) opts = {}

  // similar doing instanceof HTMLElement but works in IE8
  if (opts.nodeType) opts = {el: opts}

  this.opts = opts
  this.el = opts.el || document.body
  if (typeof this.el !== 'object') this.el = document.querySelector(this.el)
}

ElementClass.prototype.add = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return el.className = className
  var classes = el.className.split(' ')
  if (classes.indexOf(className) > -1) return classes
  classes.push(className)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.remove = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return
  var classes = el.className.split(' ')
  var idx = classes.indexOf(className)
  if (idx > -1) classes.splice(idx, 1)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.has = function(className) {
  var el = this.el
  if (!el) return
  var classes = el.className.split(' ')
  return classes.indexOf(className) > -1
}

},{}],2:[function(_dereq_,module,exports){
'use strict';

function freak(obj, root, parent, prop) {

  var listeners = {
    'change': {},
    'update': {},
    'insert': {},
    'delete': {}
  };
  var _dependentProps = {};
  var _dependentContexts = {};
  var cache = {};
  var children = {};

  // Assert condition
  function assert(cond, msg) {
    if (!cond) {
      throw msg || 'assertion failed';
    }
  }

  // Mix properties into target
  function mixin(target, properties) {
    for (var i = 0, props = Object.getOwnPropertyNames(properties), len = props.length;
        i < len; i++) {
      target[props[i]] = properties[props[i]];
    }
  }

  function deepEqual(x, y) {
    if (typeof x === "object" && x !== null &&
        typeof y === "object" && y !== null) {

      if (Object.keys(x).length !== Object.keys(y).length) {
        return false;
      }

      for (var prop in x) {
        if (y.hasOwnProperty(prop)) {
          if (!deepEqual(x[prop], y[prop])) {
            return false;
          }
        }
        else {
          return false;
        }
      }

      return true;
    }
    else if (x !== y) {
      return false;
    }

    return true;
  }

  // Event functions
  function on() {
    var event = arguments[0];
    var prop = ['string', 'number'].indexOf(typeof arguments[1]) > -1 ?
      arguments[1] : null;
    var callback =
      typeof arguments[1] === 'function' ?
        arguments[1] :
        typeof arguments[2] === 'function' ?
          arguments[2] : null;

    // Args check
    assert(['change', 'update', 'insert', 'delete'].indexOf(event) > -1);
    assert(
      (['change'].indexOf(event) > -1 && prop !== null) ||
      (['insert', 'delete', 'update'].indexOf(event) > -1 && prop === null)
    );

    // Init listeners for prop
    if (!listeners[event][prop]) {
      listeners[event][prop] = [];
    }
    // Already registered?
    if (listeners[event][prop].indexOf(callback) === -1) {
      listeners[event][prop].push(callback);
    }
  }

  // Remove all or specified listeners given event and property
  function off() {
    var event = arguments[0];
    var prop = typeof arguments[1] === 'string' ? arguments[1] : null;
    var callback =
      typeof arguments[1] === 'function' ?
        arguments[1] :
        typeof arguments[2] === 'function' ?
          arguments[2] : null;
    var i;

    if (!listeners[event][prop]) return;

    // Remove all property watchers?
    if (!callback) {
      listeners[event][prop] = [];
    }
    else {
      // Remove specific callback
      i = listeners[event][prop].indexOf(callback);
      if (i > -1) {
        listeners[event][prop].splice(i, 1);
      }
    }

  }

  // trigger('change', prop)
  // trigger('update', prop)
  // trigger('insert' or 'delete', index, count)
  function trigger(event, a, b) {
    (listeners[event][['change'].indexOf(event) > -1 ? a : null] || [])
      .map(function(listener) {
        listener.call(instance, a, b);
      });
  }

  // Export model to JSON string
  // NOT exported:
  // - properties starting with _ (Python private properties convention)
  // - computed properties (derived from normal properties)
  function toJSON() {
    function filter(obj) {
      var key, filtered = Array.isArray(obj) ? [] : {};
      for (key in obj) {
        if (typeof obj[key] === 'object') {
          filtered[key] = filter(obj[key]);
        }
        else if (typeof obj[key] !== 'function' && key[0] !== '_') {
          filtered[key] = obj[key];
        }
      }
      return filtered;
    }
    return JSON.stringify(filter(obj));
  }

  // Load model from JSON string or object
  function fromJSON(data) {
    var key;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    for (key in data) {
      obj[key] = data[key];
    }
  }

  // Update handler: recalculate dependent properties,
  // trigger change if necessary
  function update(prop, innerProp) {
    // TODO: mark currently updating properties to avoid
    // stack overflow for circular dependencies and
    // unnecessary recalculations for computed setters

    if (!deepEqual(cache[prop], get(prop))) {
      trigger('change', prop);
    }

    // Notify dependents
    for (var i = 0, dep = _dependentProps[prop] || [], len = dep.length;
        i < len; i++) {
      delete children[dep[i]];
      _dependentContexts[prop][i].trigger('update', dep[i]);
    }

    if (instance.parent) {
      // Notify computed properties, depending on parent object
      instance.parent.trigger('update', instance.prop, prop);
    }
  }

  // Proxy the accessor function to record
  // all accessed properties
  function getDependencyTracker(prop) {
    function tracker(context) {
      return function(_prop, _arg) {
        if (!context._dependentProps[_prop]) {
          context._dependentProps[_prop] = [];
          context._dependentContexts[_prop] = [];
        }
        if (context._dependentProps[_prop].indexOf(prop) === -1) {
          context._dependentProps[_prop].push(prop);
          context._dependentContexts[_prop].push(instance);
        }
        return context(_prop, _arg);
      }
    }
    var result = tracker(instance);
    construct(result);
    if (parent) {
      result.parent = tracker(parent);
    }
    result.root = tracker(root || instance);
    return result;
  }

  // Getter for prop, if callback is given
  // can return async value
  function get(prop, callback) {
    var val = obj[prop];

    return cache[prop] = (typeof val === 'function') ?
      // Computed property
      val.call(getDependencyTracker(prop), callback) :
      // Static property (leaf node in the dependency graph)
      val;
  }

  function getter(prop, callback) {
    var result = get(prop, callback);

    return result && typeof result === 'object' ?
      // Wrap object
      children[prop] ?
        children[prop] :
        children[prop] = freak(result, root || instance, instance, prop) :
      // Simple value
      result;
  }

  // Set prop to val
  function setter(prop, val) {
    var oldVal = get(prop);

    if (typeof obj[prop] === 'function') {
      // Computed property setter
      obj[prop].call(getDependencyTracker(prop), val);
    }
    else {
      // Simple property
      obj[prop] = val;
      if (val && typeof val === 'object') {
        delete cache[prop];
      }
    }

    if (oldVal !== val) {
      trigger('update', prop);
    }
  }

  // Functional accessor, unify getter and setter
  function accessor(prop, arg) {
    return (
      (arg === undefined || typeof arg === 'function') ?
        getter : setter
    )(prop, arg);
  }

  // Attach instance members
  function construct(target) {
    mixin(target, {
      values: obj,
      parent: parent || null,
      root: root || target,
      prop: prop === undefined ? null : prop,
      // .on(event[, prop], callback)
      on: on,
      // .off(event[, prop][, callback])
      off: off,
      // .trigger(event[, prop])
      trigger: trigger,
      toJSON: toJSON,
      fromJSON: fromJSON,
      // Internal: dependency tracking
      _dependentProps: _dependentProps,
      _dependentContexts: _dependentContexts
    });

    // Wrap mutating array method to update
    // state and notify listeners
    function wrapArrayMethod(method, func) {
      return function() {
        var result = [][method].apply(obj, arguments);
        this.len = this.values.length;
        func.apply(this, arguments);
        target.parent.trigger('update', target.prop);
        return result;
      };
    }

    if (Array.isArray(obj)) {
      mixin(target, {
        // Function prototype already contains length
        // `len` specifies array length
        len: obj.length,

        pop: wrapArrayMethod('pop', function() {
          trigger('delete', this.len, 1);
        }),

        push: wrapArrayMethod('push', function() {
          trigger('insert', this.len - 1, 1);
        }),

        reverse: wrapArrayMethod('reverse', function() {
          cache = {};
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        shift: wrapArrayMethod('shift', function() {
          cache = {};
          trigger('delete', 0, 1);
        }),

        unshift: wrapArrayMethod('unshift', function() {
          cache = {};
          trigger('insert', 0, 1);
        }),

        sort: wrapArrayMethod('sort', function() {
          cache = {};
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        splice: wrapArrayMethod('splice', function() {
          cache = {};
          if (arguments[1]) {
            trigger('delete', arguments[0], arguments[1]);
          }
          if (arguments.length > 2) {
            trigger('insert', arguments[0], arguments.length - 2);
          }
        })

      });
    }
  }

  on('update', update);

  // Create freak instance
  var instance = function() {
    return accessor.apply(null, arguments);
  };

  // Attach instance members
  construct(instance);

  return instance;
}

// CommonJS export
if (typeof module === 'object') module.exports = freak;

},{}],3:[function(_dereq_,module,exports){
/*

## Compiler

*/


/*

### compile(template, model[, options])

Return documentFragment

*/

    module.exports = function compile(template, model, options) {

      var consts = _dereq_('./consts');

      // Utility functions

      function escapeRE(s) {
        return  (s + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
      }


      function tokenizer(options, flags) {
        return RegExp(
          escapeRE(options.delimiters[0]) +
          '(' + consts.RE_ANYTHING + ')' +
          escapeRE(options.delimiters[1]),
          flags
        );
      }


      function matchRules(tag, node, attr, model, options) {
        var i, match;
        var rules = _dereq_('./rules');
        var rulesLen = rules.length;

        // Strip delimiters
        tag = tag.slice(options.delimiters[0].length, -options.delimiters[1].length);

        for (i = 0; i < rulesLen; i++) {
          match = rules[i](tag, node, attr, model, options);

          if (match) {
            match.index = i;
            return match;
          }
        }
      }


      function preprocess(template, options) {
        // replace {{{tag}}} with {{&tag}}
        template = template.replace(
          RegExp(
            escapeRE(options.delimiters[0] + '{') +
            consts.RE_SRC_IDENTIFIER +
            escapeRE('}' + options.delimiters[1]),
            'g'
          ),
          options.delimiters[0] + '&$1' + options.delimiters[1]
        );
        // wrap each non-attribute tag in HTML comment,
        // remove Mustache comments,
        template = template.replace(
          tokenizer(options, 'g'),
          function(match, match1, pos) {
            var head = template.slice(0, pos);
            var insideTag = !!head.match(RegExp('<' + consts.RE_SRC_IDENTIFIER + '[^>]*?$'));
            var insideComment = !!head.match(/<!--\s*$/);
            var isMustacheComment = match1.indexOf('!') === 0;

            return insideTag || insideComment ?
              isMustacheComment ?
                '' :
                match :
              '<!--' + match + '-->';
          }
        );
        return template;
      }


      function matchEndBlock(block, template, options) {
        var match = template.match(
          RegExp(
            escapeRE(options.delimiters[0]) +
            '\\/' + consts.RE_SRC_IDENTIFIER + '?' +
            escapeRE(options.delimiters[1])
          )
        );
        return match ?
          block === '' || !match[1] || match[1] === block :
          false;
      }


      // Variables

      var i, children, len, ai, alen, attr, val, attrRules, ri, attrVal;
      var buffer, pos, beginPos, bodyBeginPos, body, node, el, t, match, rule, token, block;
      var fragment = document.createDocumentFragment(), frag;
      var freak = _dereq_('freak');
      var iframe;

      // Init

      options = options || _dereq_('./default-options');

      model =
        typeof model === 'function' ?
          // Freak instance
          model :
          typeof model === 'object' ?
            // Wrap object
            freak(model) :
            // Simple value
            freak({'.': model});

      // Template can be a string or DOM structure
      if (template.nodeType) {
        body = template;
      }
      else {
        template = preprocess(template, options);
        iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.writeln('<!doctype html>\n<html><body><div>' + template + '</div></body></html>');
        body = iframe.contentDocument.body.children[0];
        document.body.removeChild(iframe);
        //body = document.createElement('body');
        //body.innerHTML = template;
      }

      // Iterate child nodes.
      for (i = 0, children = body.childNodes, len = children.length ; i < len; i++) {

        node = children[i];

        // Shallow copy of node and attributes (if element)
        el = node.cloneNode(false);

        fragment.appendChild(el);

        switch (el.nodeType) {

          // Element node
          case 1:

            // Remember model
            el.__jtmpl__ = model;

            // Check attributes
            for (ai = 0, alen = el.attributes.length; ai < alen; ai++) {

              attr = el.attributes[ai];
              attrRules = [];
              attrVal = '';
              val = attr.value;
              t = tokenizer(options, 'g');

              while ( (match = t.exec(val)) ) {

                rule = matchRules(match[0], el, attr.name.toLowerCase(), model, options);

                if (rule) {

                  attrRules.push(rule);

                  if (rule.block) {

                    block = match[0];
                    beginPos = match.index;
                    bodyBeginPos = match.index + match[0].length;

                    // Find closing tag
                    for (;
                        match &&
                        !matchEndBlock(rule.block, match[0], options);
                        match = t.exec(val));

                    if (!match) {
                      throw 'Unclosed' + block;
                    }
                    else {
                      // Replace full block tag body with rule contents
                      attrVal +=
                        val.slice(0, beginPos) +
                        rule.replace(attr.value.slice(bodyBeginPos, match.index)) +
                        val.slice(match.index + match[0].length);
                    }
                  }

                  if (!rule.block && rule.replace !== undefined) {
                    attr.value = rule.replace;
                  }

                }
              }

              // Rule changes can mutate attributes,
              // so process in another pass
              if (attrRules.length) {
                attr.value = attrVal;
              }
              for (ri = 0; ri < attrRules.length; ri++) {
                rule = attrRules[ri];
                if (rule.change) {
                  model.on('change', rule.block || rule.prop, rule.change);
                  rule.change();
                }
              }

            }

            // Recursively compile
            frag = compile(node, model, options);
            if (frag.childNodes.length) {
              el.appendChild(frag);
            }

            break;

          // Comment node
          case 8:
            if (matchEndBlock('', el.data, options)) {
              throw 'jtmpl: Unexpected ' + el.data;
            }

            if ( (match = el.data.match(tokenizer(options))) ) {

              rule = matchRules(el.data, node, null, model, options);
              if (rule) {

                // DOM replacement?
                if (rule.replace.nodeType) {
                  el.parentNode.replaceChild(rule.replace, el);
                }

                // Fetch block tag contents?
                if (rule.block) {

                  block = document.createDocumentFragment();

                  for (i++;

                      (i < len) &&
                      !matchEndBlock(rule.block, children[i].data || '', options);

                      i++) {

                    block.appendChild(children[i].cloneNode(true));
                  }

                  if (i === len) {
                    throw 'jtmpl: Unclosed ' + el.data;
                  }
                  else {
                    // Replace `el` with `rule.replace()` result
                    el.parentNode.replaceChild(rule.replace(block, el.parentNode), el);
                  }
                }

                if (rule.prop && rule.change) {
                  model.on('change', rule.prop, rule.change);
                  rule.change();
                }


              }

            }
            break;

        } // switch

      } // for

      return fragment;
    };

},{"./consts":4,"./default-options":6,"./rules":9,"freak":2}],4:[function(_dereq_,module,exports){
/*

## Constants

*/
  module.exports = {

    RE_IDENTIFIER: /^[\w\.\-]+$/,

    RE_SRC_IDENTIFIER: '([\\w\\.\\-]+)',

    // match: [1]=var_name, [2]='single-quoted' [3]="doube-quoted"
    RE_PARTIAL: />([\w\.\-]+)|'([^\']*)\'|"([^"]*)"/,

    RE_PIPE: /^[\w\.\-]+(?:\|[\w\.\-]+)?$/,

    RE_NODE_ID: /^#[\w\.\-]+$/,

    RE_ENDS_WITH_NODE_ID: /.+(#[\w\.\-]+)$/,

    RE_ANYTHING: '[\\s\\S]*?',

    RE_SPACE: '\\s*'

  };

},{}],5:[function(_dereq_,module,exports){
/*!
 * contentloaded.js
 *
 * Author: Diego Perini (diego.perini at gmail.com)
 * Summary: cross-browser wrapper for DOMContentLoaded
 * Updated: 20101020
 * License: MIT
 * Version: 1.2
 *
 * URL:
 * http://javascript.nwbox.com/ContentLoaded/
 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
 *
 */

// @win window reference
// @fn function reference
module.exports = function contentLoaded(win, fn) {

	var done = false, top = true,

	doc = win.document,
	root = doc.documentElement,
	modern = doc.addEventListener,

	add = modern ? 'addEventListener' : 'attachEvent',
	rem = modern ? 'removeEventListener' : 'detachEvent',
	pre = modern ? '' : 'on',

	init = function(e) {
		if (e.type == 'readystatechange' && doc.readyState != 'complete') return;
		(e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
		if (!done && (done = true)) fn.call(win, e.type || e);
	},

	poll = function() {
		try { root.doScroll('left'); } catch(e) { setTimeout(poll, 50); return; }
		init('poll');
	};

	if (doc.readyState == 'complete') fn.call(win, 'lazy');
	else {
		if (!modern && root.doScroll) {
			try { top = !win.frameElement; } catch(e) { }
			if (top) poll();
		}
		doc[add](pre + 'DOMContentLoaded', init, false);
		doc[add](pre + 'readystatechange', init, false);
		win[add](pre + 'load', init, false);
	}

}

},{}],6:[function(_dereq_,module,exports){
/*
  
Default options

*/
    
    module.exports = {
      delimiters: ['{{', '}}']
    };

},{}],7:[function(_dereq_,module,exports){
/*

Evaluate object from literal or CommonJS module

*/

    /* jshint evil:true */
    module.exports = function(target, src, model) {

      var consts = _dereq_('./consts');

      model = model || {};
      if (typeof model !== 'function') {
        model = jtmpl.freak(model);
      }

      function mixin(target, properties) {
        for (var prop in properties) {
          if (// Plugin
              (prop.indexOf('__') === 0 &&
                prop.lastIndexOf('__') === prop.length - 2) ||
              // Computed property
              typeof properties[prop] === 'function'
             ) {
            if (target.values[prop] === undefined) {
              target.values[prop] = properties[prop];
            }
          }
          else {
            // Target doesn't already have prop?
            if (target(prop) === undefined) {
              target(prop, properties[prop]);
            }
          }
        }
      }

      function applyPlugins() {
        var prop, arg;
        for (prop in jtmpl.plugins) {
          plugin = jtmpl.plugins[prop];
          arg = model.values['__' + prop + '__'];
          if (typeof plugin === 'function' && arg !== undefined) {
            plugin.call(model, arg, target);
          }
        }
      }

      function evalObject(body, src) {
        var result, module = { exports: {} };
        src = src ?
          '\n//@ sourceURL=' + src +
          '\n//# sourceURL=' + src :
          '';
        if (body.match(/^\s*{[\S\s]*}\s*$/)) {
          // Literal
          return eval('(function(){ var result=' + body + ';return result})()' + src);
        }
        // CommonJS module
        eval(body + src);
        return module.exports;
          //eval(
            //'(function(module, exports){' +
            //body +
            //';return module.exports})' +
            //src
          //)(module, module.exports);
      }

      function loadModel(src, template, doc) {
        var hashIndex;
        if (!src) {
          // No source
          jtmpl(target, template, model);
        }
        else if (src.match(consts.RE_NODE_ID)) {
          // Element in this document
          var element = doc.querySelector(src);
          mixin(model, evalObject(element.innerHTML, src));
          applyPlugins();
          jtmpl(target, template, model);
        }
        else {
          hashIndex = src.indexOf('#');
          // Get model via XHR
          jtmpl('GET', hashIndex > -1 ? src.substring(0, hashIndex) : src, function (resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var element = match && new DOMParser()
              .parseFromString(resp, 'text/html')
              .querySelector(match[1]);
            mixin(model, evalObject(match ? element.innerHTML : resp, src));
            applyPlugins();
            jtmpl(target, template, model);
          });
        }
      }

      function loadTemplate() {
        var hashIndex;

        if (!src) return;

        if (src.match(consts.RE_NODE_ID)) {
          // Template is the contents of element
          // belonging to this document
          var element = document.querySelector(src);
          loadModel(element.getAttribute('data-model'), element.innerHTML, document);
        }
        else {
          hashIndex = src.indexOf('#');
          // Get template via XHR
          jtmpl('GET', hashIndex > -1 ? src.substring(0, hashIndex) : src, function(resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var doc;
            if (match) {
              doc = document.implementation.createHTMLDocument('');
              doc.documentElement.innerHTML = resp;
            }
            else {
              doc = document;
            }
            var element = match && doc.querySelector(match[1]);

            loadModel(
              match ? element.getAttribute('data-model') : '',
              match ? element.innerHTML : resp,
              doc
            );
          });
        }
      }

      loadTemplate();
    };

},{"./consts":4}],8:[function(_dereq_,module,exports){
/*

## Main function

*/
    var consts = _dereq_('./consts');

    function jtmpl() {
      var args = [].slice.call(arguments);
      var target, t, template, model;

      // jtmpl('HTTP_METHOD', url[, parameters[, callback[, options]]])?
      if (['GET', 'POST'].indexOf(args[0]) > -1) {
        return _dereq_('./xhr').apply(null, args);
      }

      // jtmpl(target)?
      else if (args.length === 1 && typeof args[0] === 'string') {
        // return model
        return document.querySelector(args[0]).__jtmpl__;
      }

      // jtmpl(target, template, model[, options])?
      else if (
        ( args[0] && args[0].nodeType ||
          (typeof args[0] === 'string')
        ) &&

        ( (args[1] && typeof args[1].appendChild === 'function') ||
          (typeof args[1] === 'string')
        ) &&

        args[2] !== undefined

      ) {

        target = args[0] && args[0].nodeType  ?
          args[0] :
          document.querySelector(args[0]);

        template = args[1].match(consts.RE_NODE_ID) ?
          document.querySelector(args[1]).innerHTML :
          args[1];

        model =
          typeof args[2] === 'function' ?
            // already wrapped
            args[2] :
            // otherwise wrap
            jtmpl.freak(
              typeof args[2] === 'object' ?
                // object
                args[2] :

                typeof args[2] === 'string' && args[2].match(consts.RE_NODE_ID) ?
                  // src, load it
                  _dereq_('./loader')
                    (document.querySelector(args[2]).innerHTML) :

                  // simple value, box it
                  {'.': args[2]}
            );

        if (target.nodeName === 'SCRIPT') {
          t = document.createElement('div');
          t.id = target.id;
          target.parentNode.replaceChild(t, target);
          target = t;
        }

        // Associate target and model
        target.__jtmpl__ = model;

        // Empty target
        target.innerHTML = '';

        // Assign compiled template
        target.appendChild(_dereq_('./compiler')(template, model, args[3]));
      }
    }



/*

On page ready, process jtmpl targets

*/

    _dereq_('./content-loaded')(window, function() {

      var loader = _dereq_('./loader');
      var targets = document.querySelectorAll('[data-jtmpl]');

      for (var i = 0, len = targets.length; i < len; i++) {
        loader(targets[i], targets[i].getAttribute('data-jtmpl'));
      }
    });


/*

Expose freak

*/

    jtmpl.freak = _dereq_('freak');



/*

Plugins

*/

    jtmpl.plugins = {
      init: function(arg) {
        if (typeof arg === 'function') {
          arg.call(this);
        }
      }
    };


/*

Export

*/
    module.exports = jtmpl;

},{"./compiler":3,"./consts":4,"./content-loaded":5,"./loader":7,"./xhr":17,"freak":2}],9:[function(_dereq_,module,exports){
/*

## Rules

Each rule is a function, args when called are:
(tag, node, attr, model, options)

tag: text between delimiters, {{tag}}
node: DOM node, where tag is found
attr: node attribute or null, if node contents
model: Freak model
options: configuration options

It must return either:

* falsy value - no match

* object - match found, return (all fields optional)

     {
       // Parse until {{/}} or {{/someProp}} ...
       block: 'someProp',

       // ... then this function will be called.
       // It must return string or DOMElement
       replace: function(tmpl, parent) { ... }
     }

*/

    module.exports = [
      _dereq_('./rules/value-var'),
      _dereq_('./rules/class-section'),
      _dereq_('./rules/section'),
      _dereq_('./rules/inverted-section'),
      _dereq_('./rules/partial'),
      _dereq_('./rules/unescaped-var'),
      _dereq_('./rules/var')
    ];

},{"./rules/class-section":10,"./rules/inverted-section":11,"./rules/partial":12,"./rules/section":13,"./rules/unescaped-var":14,"./rules/value-var":15,"./rules/var":16}],10:[function(_dereq_,module,exports){
/*

### class="{{#ifCondition}}some-class{{/}}"

Toggles class `some-class` in sync with boolean `model.ifCondition`


### class="{{^notIfCondition}}some-class{{/}}"

Toggles class `some-class` in sync with boolean not `model.notIfCondition`

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(new RegExp('(#|\\^)' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var inverted = match && (match[1] === '^');
      var prop = match && match[2];
      var klass;


      if (attr === 'class' && match) {

        return {
          block: prop,

          replace: function(tmpl) {
            klass = tmpl;
            return '';
          },

          change: function() {
            var val = model(prop);
            _dereq_('element-class')(node)
              [(inverted === !val) && 'add' || 'remove'](klass);
          }
        };
      }
    }

},{"../consts":4,"element-class":1}],11:[function(_dereq_,module,exports){
/*

### {{^inverted-section}}

Can be bound to text node

*/

    module.exports = function(tag, node, attr, model, options) {
      var compile = _dereq_('../compiler');
      var match = tag.match(new RegExp('^\\^' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var prop = match && match[1];
      var template;
      var fragment = document.createDocumentFragment();
      var anchor = document.createComment('');
      var length = 0;

      function change() {
        var val = prop === '.' ? model : model(prop);
        var i, len, render;

        // Delete old rendering
        while (length) {
          anchor.parentNode.removeChild(anchor.previousSibling);
          length--;
        }

        // Array?
        if (typeof val === 'function' && val.len !== undefined) {
          val.on('insert', change);
          val.on('delete', change);
          render = document.createDocumentFragment();

          if (val.len === 0) {
            render.appendChild(compile(template, val(i)));
          }

          length = render.childNodes.length;
          anchor.parentNode.insertBefore(render, anchor);
        }

        // Cast to boolean
        else {
          if (!val) {
            render = compile(template, model);
            length = render.childNodes.length;
            anchor.parentNode.insertBefore(render, anchor);
          }
        }
      }


      if (match && !attr) {

        return {
          prop: prop,
          block: prop,

          replace: function(tmpl, parent) {
            fragment.appendChild(anchor);
            template = tmpl;
            return anchor;
          },

          change: change
        };

      }
    }

},{"../compiler":3,"../consts":4}],12:[function(_dereq_,module,exports){
/*

### Partial

* {{>"#id"}}
* {{>"url"}}
* {{>"url#id"}}
* {{>partialSrc}}

Replaces parent tag contents, always wrap in a tag

*/

    module.exports = function(tag, node, attr, model, options) {
      var consts = _dereq_('../consts');
      var match = tag.match(consts.RE_PARTIAL);
      var anchor = document.createComment('');
      var target;

      var loader = match &&
        function() {
          if (!target) {
            target = anchor.parentNode;
          }
          _dereq_('../loader')(
            target,
            match[1] ?
              // Variable
              model(match[1]) :
              // Literal
              match[2] || match[3],
            model
          )
        };

      if (match) {

        if (match[1]) {
          // Variable
          model.on('change', match[1], loader);
        }

        // Load async
        setTimeout(loader, 0);

        return {
          replace: anchor
        };
      }
    }

},{"../consts":4,"../loader":7}],13:[function(_dereq_,module,exports){
/*

### {{#section}}

Can be bound to text node

*/

    module.exports = function(tag, node, attr, model, options) {
      var compile = _dereq_('../compiler');
      var match = tag.match(new RegExp('^#' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var prop = match && match[1];
      var template;
      var fragment = document.createDocumentFragment();
      var anchor = document.createComment('');
      var length = 0;

      function update(i) {
        return function() {
          var parent = anchor.parentNode;
          var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
          var pos = anchorIndex - length + i * template.childNodes.length;

          parent.replaceChild(
            compile(template, model(prop)(i)),
            parent.childNodes[pos]
          );
        };
      }

      function insert(index, count) {
        var parent = anchor.parentNode;
        var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
        var pos = anchorIndex - length + index * template.childNodes.length;
        var size = count * template.childNodes.length;
        var i, fragment;

        for (i = 0, fragment = document.createDocumentFragment();
            i < count; i++) {
          fragment.appendChild(compile(template, model(prop)(index + i)));
        }

        parent.insertBefore(fragment, parent.childNodes[pos]);
        length = length + size;
      }

      function del(index, count) {
        var parent = anchor.parentNode;
        var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
        var pos = anchorIndex - length + index * template.childNodes.length;
        var size = count * template.childNodes.length;

        length = length - size;

        while (size--) {
          parent.removeChild(parent.childNodes[pos]);
        }
      }

      function change() {
        var val = prop === '.' ? model : model(prop);
        var i, len, render;

        // Delete old rendering
        while (length) {
          anchor.parentNode.removeChild(anchor.previousSibling);
          length--;
        }

        // Array?
        if (typeof val === 'function' && val.len !== undefined) {
          val.on('insert', insert);
          val.on('delete', del);
          render = document.createDocumentFragment();

          for (i = 0, len = val.len; i < len; i++) {
            val.on('change', i, update(i));
            render.appendChild(compile(template, val(i)));
          }

          length = render.childNodes.length;
          anchor.parentNode.insertBefore(render, anchor);
        }

        // Object?
        else if (typeof val === 'function' && val.len === undefined) {
          render = compile(template, val);
          length = render.childNodes.length;
          anchor.parentNode.insertBefore(render, anchor);
        }

        // Cast to boolean
        else {
          if (!!val) {
            render = compile(template, model);
            length = render.childNodes.length;
            anchor.parentNode.insertBefore(render, anchor);
          }
        }
      }


      if (match) {

        return {
          prop: prop,
          block: prop,

          replace: function(tmpl, parent) {
            fragment.appendChild(anchor);
            template = tmpl;

            return anchor;
          },

          change: change
        };

      }
    }

},{"../compiler":3,"../consts":4}],14:[function(_dereq_,module,exports){
/*

### {{&var}}

(`{{{var}}}` is replaced on preprocessing step)

Can be bound to node innerHTML

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(new RegExp('^&' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var prop = match && match[1];
      var anchor = document.createComment('');
      var length = 0;

      if (match && !attr) {
        return {
          prop: prop,
          replace: anchor,
          change: function() {
            var fragment = document.createDocumentFragment();
            var el = document.createElement('body');
            var i;

            // Delete old value
            while (length) {
              anchor.parentNode.removeChild(anchor.previousSibling);
              length--;
            }

            el.innerHTML = model(prop) || '';
            length = el.childNodes.length;
            for (i = 0; i < length; i++) {
              fragment.appendChild(el.childNodes[0]);
            }
            anchor.parentNode.insertBefore(fragment, anchor);
          }
        };
      }
    }

},{"../consts":4}],15:[function(_dereq_,module,exports){
/*

### (value | checked | selected)="{{val}}"

Handle "value", "checked" and "selected" attributes

*/

    function triggerEvent(el, eventName){
      var event;
      if (document.createEvent){
        event = document.createEvent('HTMLEvents');
        event.initEvent(eventName,true,true);
      }
      else if(document.createEventObject){
        // IE < 9
        event = document.createEventObject();
        event.eventType = eventName;
      }
      event.eventName = eventName;
      if (el.dispatchEvent){
        el.dispatchEvent(event);
      }
      else if (el.fireEvent && htmlEvents['on' + eventName]) {
        // IE < 9
        el.fireEvent('on' + event.eventType, event);
      }
      else if (el[eventName]) {
        el[eventName]();
      }
      else if (el['on' + eventName]) {
        el['on' + eventName]();
      }
    }

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(_dereq_('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        var val = model(prop);
        if (node[attr] !== val) {
          node[attr] = val || '';
        }
      }

      if (match && ['value', 'checked', 'selected'].indexOf(attr) > -1) {
        // <select> option?
        if (node.nodeName === 'OPTION') {
          // Attach async, as parentNode is still documentFragment
          setTimeout(function() {
            if (node && node.parentNode) {
              node.parentNode.addEventListener('change', function() {
                if (model(prop) !== node.selected) {
                  model(prop, node.selected);
                }
              });
            }
          }, 0);
        }

        // radio group?
        if (node.type === 'radio' && node.name) {
          node.addEventListener('change', function() {
            if (node[attr]) {
              for (var i = 0,
                  inputs = document.querySelectorAll('input[type=radio][name=' + node.name + ']'),
                  len = inputs.length;
                  i < len;
                  i++
                ) {
                if (inputs[i] !== node) {
                  triggerEvent(inputs[i], 'change');
                }
              }
            }
            model(prop, node[attr]);
          });
        }

        // text input?
        var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
          'input' : 'change';

        node.addEventListener(eventType, function() {
          model(prop, node[attr]);
        });

        return {
          prop: prop,
          replace: '',
          change: change
        };
      }
    }

},{"../consts":4}],16:[function(_dereq_,module,exports){
/*

### {{var}}

Can be bound to text node data or attribute

*/

    module.exports = function(tag, node, attr, model, options) {
      var react, target, change;

      function get() {
        var val = model(tag);
        return (typeof val === 'function') ?
          JSON.stringify(val.values) :
          val;
      }

      if (tag.match(_dereq_('../consts').RE_IDENTIFIER)) {

        if (attr) {
          // Attribute
          change = function() {
            var val = get();
            return val ?
              node.setAttribute(attr, val) :
              node.removeAttribute(attr);
          };
        }
        else {
          // Text node
          target = document.createTextNode('');
          change = function() {
            target.data = get() || '';
          };
        }

        // Match found
        return {
          prop: tag,
          replace: target,
          change: change
        };
      }
    }

},{"../consts":4}],17:[function(_dereq_,module,exports){
/*

Requests API

*/

    module.exports = function() {
      var i, len, prop, props, request;
      var args = [].slice.call(arguments);

      var xhr = new XMLHttpRequest();

      // Last function argument
      var callback = args.reduce(
        function (prev, curr) {
          return typeof curr === 'function' ? curr : prev;
        },
        null
      );

      var opts = args[args.length - 1];

      if (typeof opts !== 'object') {
        opts = {};
      }

      for (i = 0, props = Object.getOwnPropertyNames(opts), len = props.length;
          i < len; i++) {
        prop = props[i];
        xhr[prop] = opts[prop];
      }

      request =
        (typeof args[2] === 'string') ?

          // String parameters
          args[2] :

          (typeof args[2] === 'object') ?

            // Object parameters. Serialize to URI
            Object.keys(args[2]).map(
              function(x) {
                return x + '=' + encodeURIComponent(args[2][x]);
              } 
            ).join('&') :

            // No parameters
            '';

      xhr.onload = function(event) {
        var resp;

        if (callback) {
          try {
            resp = JSON.parse(this.responseText);
          }
          catch (e) {
            resp = this.responseText;
          }
          callback.call(this, resp, event);
        }
      };

      xhr.open(args[0], args[1],
        (opts.async !== undefined ? opts.async : true), 
        opts.user, opts.password);

      xhr.send(request);

    };

},{}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2VsZW1lbnQtY2xhc3MvaW5kZXguanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbXBpbGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29uc3RzLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29udGVudC1sb2FkZWQuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9kZWZhdWx0LW9wdGlvbnMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9sb2FkZXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9tYWluLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9jbGFzcy1zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3BhcnRpYWwuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdW5lc2NhcGVkLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3ZhbHVlLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3Zhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0cykge1xuICByZXR1cm4gbmV3IEVsZW1lbnRDbGFzcyhvcHRzKVxufVxuXG5mdW5jdGlvbiBFbGVtZW50Q2xhc3Mob3B0cykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRWxlbWVudENsYXNzKSkgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG5cbiAgLy8gc2ltaWxhciBkb2luZyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50IGJ1dCB3b3JrcyBpbiBJRThcbiAgaWYgKG9wdHMubm9kZVR5cGUpIG9wdHMgPSB7ZWw6IG9wdHN9XG5cbiAgdGhpcy5vcHRzID0gb3B0c1xuICB0aGlzLmVsID0gb3B0cy5lbCB8fCBkb2N1bWVudC5ib2R5XG4gIGlmICh0eXBlb2YgdGhpcy5lbCAhPT0gJ29iamVjdCcpIHRoaXMuZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMuZWwpXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVybiBlbC5jbGFzc05hbWUgPSBjbGFzc05hbWVcbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICBpZiAoY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMSkgcmV0dXJuIGNsYXNzZXNcbiAgY2xhc3Nlcy5wdXNoKGNsYXNzTmFtZSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgdmFyIGlkeCA9IGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpXG4gIGlmIChpZHggPiAtMSkgY2xhc3Nlcy5zcGxpY2UoaWR4LCAxKVxuICBlbC5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKVxuICByZXR1cm4gY2xhc3Nlc1xufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHJldHVybiBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ3VwZGF0ZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIF9kZXBlbmRlbnRQcm9wcyA9IHt9O1xuICB2YXIgX2RlcGVuZGVudENvbnRleHRzID0ge307XG4gIHZhciBjYWNoZSA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICAvLyBBc3NlcnQgY29uZGl0aW9uXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVlcEVxdWFsKHgsIHkpIHtcbiAgICBpZiAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgeSA9PT0gXCJvYmplY3RcIiAmJiB5ICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyh4KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKHkpLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIHByb3AgaW4geCkge1xuICAgICAgICBpZiAoeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmICghZGVlcEVxdWFsKHhbcHJvcF0sIHlbcHJvcF0pKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoeCAhPT0geSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/XG4gICAgICBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAndXBkYXRlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgIT09IG51bGwpIHx8XG4gICAgICAoWydpbnNlcnQnLCAnZGVsZXRlJywgJ3VwZGF0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCA9PT0gbnVsbClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIG9yIHNwZWNpZmllZCBsaXN0ZW5lcnMgZ2l2ZW4gZXZlbnQgYW5kIHByb3BlcnR5XG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIChsaXN0ZW5lcnNbZXZlbnRdW1snY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSA/IGEgOiBudWxsXSB8fCBbXSlcbiAgICAgIC5tYXAoZnVuY3Rpb24obGlzdGVuZXIpIHtcbiAgICAgICAgbGlzdGVuZXIuY2FsbChpbnN0YW5jZSwgYSwgYik7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIEV4cG9ydCBtb2RlbCB0byBKU09OIHN0cmluZ1xuICAvLyBOT1QgZXhwb3J0ZWQ6XG4gIC8vIC0gcHJvcGVydGllcyBzdGFydGluZyB3aXRoIF8gKFB5dGhvbiBwcml2YXRlIHByb3BlcnRpZXMgY29udmVudGlvbilcbiAgLy8gLSBjb21wdXRlZCBwcm9wZXJ0aWVzIChkZXJpdmVkIGZyb20gbm9ybWFsIHByb3BlcnRpZXMpXG4gIGZ1bmN0aW9uIHRvSlNPTigpIHtcbiAgICBmdW5jdGlvbiBmaWx0ZXIob2JqKSB7XG4gICAgICB2YXIga2V5LCBmaWx0ZXJlZCA9IEFycmF5LmlzQXJyYXkob2JqKSA/IFtdIDoge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZmlsdGVyKG9ialtrZXldKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2tleV0gIT09ICdmdW5jdGlvbicgJiYga2V5WzBdICE9PSAnXycpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZpbHRlcihvYmopKTtcbiAgfVxuXG4gIC8vIExvYWQgbW9kZWwgZnJvbSBKU09OIHN0cmluZyBvciBvYmplY3RcbiAgZnVuY3Rpb24gZnJvbUpTT04oZGF0YSkge1xuICAgIHZhciBrZXk7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfVxuICAgIGZvciAoa2V5IGluIGRhdGEpIHtcbiAgICAgIG9ialtrZXldID0gZGF0YVtrZXldO1xuICAgIH1cbiAgfVxuXG4gIC8vIFVwZGF0ZSBoYW5kbGVyOiByZWNhbGN1bGF0ZSBkZXBlbmRlbnQgcHJvcGVydGllcyxcbiAgLy8gdHJpZ2dlciBjaGFuZ2UgaWYgbmVjZXNzYXJ5XG4gIGZ1bmN0aW9uIHVwZGF0ZShwcm9wLCBpbm5lclByb3ApIHtcbiAgICAvLyBUT0RPOiBtYXJrIGN1cnJlbnRseSB1cGRhdGluZyBwcm9wZXJ0aWVzIHRvIGF2b2lkXG4gICAgLy8gc3RhY2sgb3ZlcmZsb3cgZm9yIGNpcmN1bGFyIGRlcGVuZGVuY2llcyBhbmRcbiAgICAvLyB1bm5lY2Vzc2FyeSByZWNhbGN1bGF0aW9ucyBmb3IgY29tcHV0ZWQgc2V0dGVyc1xuXG4gICAgaWYgKCFkZWVwRXF1YWwoY2FjaGVbcHJvcF0sIGdldChwcm9wKSkpIHtcbiAgICAgIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApO1xuICAgIH1cblxuICAgIC8vIE5vdGlmeSBkZXBlbmRlbnRzXG4gICAgZm9yICh2YXIgaSA9IDAsIGRlcCA9IF9kZXBlbmRlbnRQcm9wc1twcm9wXSB8fCBbXSwgbGVuID0gZGVwLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBkZWxldGUgY2hpbGRyZW5bZGVwW2ldXTtcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0c1twcm9wXVtpXS50cmlnZ2VyKCd1cGRhdGUnLCBkZXBbaV0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5wYXJlbnQpIHtcbiAgICAgIC8vIE5vdGlmeSBjb21wdXRlZCBwcm9wZXJ0aWVzLCBkZXBlbmRpbmcgb24gcGFyZW50IG9iamVjdFxuICAgICAgaW5zdGFuY2UucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIGluc3RhbmNlLnByb3AsIHByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByb3h5IHRoZSBhY2Nlc3NvciBmdW5jdGlvbiB0byByZWNvcmRcbiAgLy8gYWxsIGFjY2Vzc2VkIHByb3BlcnRpZXNcbiAgZnVuY3Rpb24gZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCkge1xuICAgIGZ1bmN0aW9uIHRyYWNrZXIoY29udGV4dCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKF9wcm9wLCBfYXJnKSB7XG4gICAgICAgIGlmICghY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdID0gW107XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5pbmRleE9mKHByb3ApID09PSAtMSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5wdXNoKHByb3ApO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dChfcHJvcCwgX2FyZyk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0cmFja2VyKGluc3RhbmNlKTtcbiAgICBjb25zdHJ1Y3QocmVzdWx0KTtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICByZXN1bHQucGFyZW50ID0gdHJhY2tlcihwYXJlbnQpO1xuICAgIH1cbiAgICByZXN1bHQucm9vdCA9IHRyYWNrZXIocm9vdCB8fCBpbnN0YW5jZSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIEdldHRlciBmb3IgcHJvcCwgaWYgY2FsbGJhY2sgaXMgZ2l2ZW5cbiAgLy8gY2FuIHJldHVybiBhc3luYyB2YWx1ZVxuICBmdW5jdGlvbiBnZXQocHJvcCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuXG4gICAgcmV0dXJuIGNhY2hlW3Byb3BdID0gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpID9cbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICB2YWwuY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgY2FsbGJhY2spIDpcbiAgICAgIC8vIFN0YXRpYyBwcm9wZXJ0eSAobGVhZiBub2RlIGluIHRoZSBkZXBlbmRlbmN5IGdyYXBoKVxuICAgICAgdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldChwcm9wLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gcmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnID9cbiAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICBjaGlsZHJlbltwcm9wXSA/XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdIDpcbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gPSBmcmVhayhyZXN1bHQsIHJvb3QgfHwgaW5zdGFuY2UsIGluc3RhbmNlLCBwcm9wKSA6XG4gICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNldCBwcm9wIHRvIHZhbFxuICBmdW5jdGlvbiBzZXR0ZXIocHJvcCwgdmFsKSB7XG4gICAgdmFyIG9sZFZhbCA9IGdldChwcm9wKTtcblxuICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eSBzZXR0ZXJcbiAgICAgIG9ialtwcm9wXS5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCB2YWwpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFNpbXBsZSBwcm9wZXJ0eVxuICAgICAgb2JqW3Byb3BdID0gdmFsO1xuICAgICAgaWYgKHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgICBkZWxldGUgY2FjaGVbcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9sZFZhbCAhPT0gdmFsKSB7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yLCB1bmlmeSBnZXR0ZXIgYW5kIHNldHRlclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgZ2V0dGVyIDogc2V0dGVyXG4gICAgKShwcm9wLCBhcmcpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgZnVuY3Rpb24gY29uc3RydWN0KHRhcmdldCkge1xuICAgIG1peGluKHRhcmdldCwge1xuICAgICAgdmFsdWVzOiBvYmosXG4gICAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgICAgcm9vdDogcm9vdCB8fCB0YXJnZXQsXG4gICAgICBwcm9wOiBwcm9wID09PSB1bmRlZmluZWQgPyBudWxsIDogcHJvcCxcbiAgICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICAgIG9uOiBvbixcbiAgICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgLy8gLnRyaWdnZXIoZXZlbnRbLCBwcm9wXSlcbiAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICB0b0pTT046IHRvSlNPTixcbiAgICAgIGZyb21KU09OOiBmcm9tSlNPTixcbiAgICAgIC8vIEludGVybmFsOiBkZXBlbmRlbmN5IHRyYWNraW5nXG4gICAgICBfZGVwZW5kZW50UHJvcHM6IF9kZXBlbmRlbnRQcm9wcyxcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0czogX2RlcGVuZGVudENvbnRleHRzXG4gICAgfSk7XG5cbiAgICAvLyBXcmFwIG11dGF0aW5nIGFycmF5IG1ldGhvZCB0byB1cGRhdGVcbiAgICAvLyBzdGF0ZSBhbmQgbm90aWZ5IGxpc3RlbmVyc1xuICAgIGZ1bmN0aW9uIHdyYXBBcnJheU1ldGhvZChtZXRob2QsIGZ1bmMpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdW21ldGhvZF0uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgICAgZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB0YXJnZXQucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIHRhcmdldC5wcm9wKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHByb3RvdHlwZSBhbHJlYWR5IGNvbnRhaW5zIGxlbmd0aFxuICAgICAgICAvLyBgbGVuYCBzcGVjaWZpZXMgYXJyYXkgbGVuZ3RoXG4gICAgICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgICAgICBwb3A6IHdyYXBBcnJheU1ldGhvZCgncG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgdGhpcy5sZW4sIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBwdXNoOiB3cmFwQXJyYXlNZXRob2QoJ3B1c2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCB0aGlzLmxlbiAtIDEsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICByZXZlcnNlOiB3cmFwQXJyYXlNZXRob2QoJ3JldmVyc2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3NoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgdW5zaGlmdDogd3JhcEFycmF5TWV0aG9kKCd1bnNoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc29ydDogd3JhcEFycmF5TWV0aG9kKCdzb3J0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzcGxpY2U6IHdyYXBBcnJheU1ldGhvZCgnc3BsaWNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHMubGVuZ3RoIC0gMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICAvLyBDcmVhdGUgZnJlYWsgaW5zdGFuY2VcbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgY29uc3RydWN0KGluc3RhbmNlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwiLypcblxuIyMgQ29tcGlsZXJcblxuKi9cblxuXG4vKlxuXG4jIyMgY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSlcblxuUmV0dXJuIGRvY3VtZW50RnJhZ21lbnRcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwsIG9wdGlvbnMpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIC8vIFV0aWxpdHkgZnVuY3Rpb25zXG5cbiAgICAgIGZ1bmN0aW9uIGVzY2FwZVJFKHMpIHtcbiAgICAgICAgcmV0dXJuICAocyArICcnKS5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXFxcKCl7fXwtXSkvZywgJ1xcXFwkMScpO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIHRva2VuaXplcihvcHRpb25zLCBmbGFncykge1xuICAgICAgICByZXR1cm4gUmVnRXhwKFxuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgK1xuICAgICAgICAgICcoJyArIGNvbnN0cy5SRV9BTllUSElORyArICcpJyArXG4gICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKSxcbiAgICAgICAgICBmbGFnc1xuICAgICAgICApO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIG1hdGNoUnVsZXModGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICB2YXIgaSwgbWF0Y2g7XG4gICAgICAgIHZhciBydWxlcyA9IHJlcXVpcmUoJy4vcnVsZXMnKTtcbiAgICAgICAgdmFyIHJ1bGVzTGVuID0gcnVsZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vIFN0cmlwIGRlbGltaXRlcnNcbiAgICAgICAgdGFnID0gdGFnLnNsaWNlKG9wdGlvbnMuZGVsaW1pdGVyc1swXS5sZW5ndGgsIC1vcHRpb25zLmRlbGltaXRlcnNbMV0ubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcnVsZXNMZW47IGkrKykge1xuICAgICAgICAgIG1hdGNoID0gcnVsZXNbaV0odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucyk7XG5cbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIG1hdGNoLmluZGV4ID0gaTtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICAgIC8vIHJlcGxhY2Uge3t7dGFnfX19IHdpdGgge3smdGFnfX1cbiAgICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgICAgIFJlZ0V4cChcbiAgICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICd7JykgK1xuICAgICAgICAgICAgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICtcbiAgICAgICAgICAgIGVzY2FwZVJFKCd9JyArIG9wdGlvbnMuZGVsaW1pdGVyc1sxXSksXG4gICAgICAgICAgICAnZydcbiAgICAgICAgICApLFxuICAgICAgICAgIG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICcmJDEnICsgb3B0aW9ucy5kZWxpbWl0ZXJzWzFdXG4gICAgICAgICk7XG4gICAgICAgIC8vIHdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiBIVE1MIGNvbW1lbnQsXG4gICAgICAgIC8vIHJlbW92ZSBNdXN0YWNoZSBjb21tZW50cyxcbiAgICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgICAgIHRva2VuaXplcihvcHRpb25zLCAnZycpLFxuICAgICAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICAgICAgdmFyIGhlYWQgPSB0ZW1wbGF0ZS5zbGljZSgwLCBwb3MpO1xuICAgICAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaChSZWdFeHAoJzwnICsgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICsgJ1tePl0qPyQnKSk7XG4gICAgICAgICAgICB2YXIgaW5zaWRlQ29tbWVudCA9ICEhaGVhZC5tYXRjaCgvPCEtLVxccyokLyk7XG4gICAgICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zaWRlVGFnIHx8IGluc2lkZUNvbW1lbnQgP1xuICAgICAgICAgICAgICBpc011c3RhY2hlQ29tbWVudCA/XG4gICAgICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICAgICAgJzwhLS0nICsgbWF0Y2ggKyAnLS0+JztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBtYXRjaEVuZEJsb2NrKGJsb2NrLCB0ZW1wbGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgbWF0Y2ggPSB0ZW1wbGF0ZS5tYXRjaChcbiAgICAgICAgICBSZWdFeHAoXG4gICAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICtcbiAgICAgICAgICAgICdcXFxcLycgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnPycgK1xuICAgICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIG1hdGNoID9cbiAgICAgICAgICBibG9jayA9PT0gJycgfHwgIW1hdGNoWzFdIHx8IG1hdGNoWzFdID09PSBibG9jayA6XG4gICAgICAgICAgZmFsc2U7XG4gICAgICB9XG5cblxuICAgICAgLy8gVmFyaWFibGVzXG5cbiAgICAgIHZhciBpLCBjaGlsZHJlbiwgbGVuLCBhaSwgYWxlbiwgYXR0ciwgdmFsLCBhdHRyUnVsZXMsIHJpLCBhdHRyVmFsO1xuICAgICAgdmFyIGJ1ZmZlciwgcG9zLCBiZWdpblBvcywgYm9keUJlZ2luUG9zLCBib2R5LCBub2RlLCBlbCwgdCwgbWF0Y2gsIHJ1bGUsIHRva2VuLCBibG9jaztcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSwgZnJhZztcbiAgICAgIHZhciBmcmVhayA9IHJlcXVpcmUoJ2ZyZWFrJyk7XG4gICAgICB2YXIgaWZyYW1lO1xuXG4gICAgICAvLyBJbml0XG5cbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHJlcXVpcmUoJy4vZGVmYXVsdC1vcHRpb25zJyk7XG5cbiAgICAgIG1vZGVsID1cbiAgICAgICAgdHlwZW9mIG1vZGVsID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAvLyBGcmVhayBpbnN0YW5jZVxuICAgICAgICAgIG1vZGVsIDpcbiAgICAgICAgICB0eXBlb2YgbW9kZWwgPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICAgICAgICBmcmVhayhtb2RlbCkgOlxuICAgICAgICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICAgICAgICBmcmVhayh7Jy4nOiBtb2RlbH0pO1xuXG4gICAgICAvLyBUZW1wbGF0ZSBjYW4gYmUgYSBzdHJpbmcgb3IgRE9NIHN0cnVjdHVyZVxuICAgICAgaWYgKHRlbXBsYXRlLm5vZGVUeXBlKSB7XG4gICAgICAgIGJvZHkgPSB0ZW1wbGF0ZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUsIG9wdGlvbnMpO1xuICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgaWZyYW1lLmNvbnRlbnREb2N1bWVudC53cml0ZWxuKCc8IWRvY3R5cGUgaHRtbD5cXG48aHRtbD48Ym9keT48ZGl2PicgKyB0ZW1wbGF0ZSArICc8L2Rpdj48L2JvZHk+PC9odG1sPicpO1xuICAgICAgICBib2R5ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5ib2R5LmNoaWxkcmVuWzBdO1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICAgIC8vYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgLy9ib2R5LmlubmVySFRNTCA9IHRlbXBsYXRlO1xuICAgICAgfVxuXG4gICAgICAvLyBJdGVyYXRlIGNoaWxkIG5vZGVzLlxuICAgICAgZm9yIChpID0gMCwgY2hpbGRyZW4gPSBib2R5LmNoaWxkTm9kZXMsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aCA7IGkgPCBsZW47IGkrKykge1xuXG4gICAgICAgIG5vZGUgPSBjaGlsZHJlbltpXTtcblxuICAgICAgICAvLyBTaGFsbG93IGNvcHkgb2Ygbm9kZSBhbmQgYXR0cmlidXRlcyAoaWYgZWxlbWVudClcbiAgICAgICAgZWwgPSBub2RlLmNsb25lTm9kZShmYWxzZSk7XG5cbiAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWwpO1xuXG4gICAgICAgIHN3aXRjaCAoZWwubm9kZVR5cGUpIHtcblxuICAgICAgICAgIC8vIEVsZW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgMTpcblxuICAgICAgICAgICAgLy8gUmVtZW1iZXIgbW9kZWxcbiAgICAgICAgICAgIGVsLl9fanRtcGxfXyA9IG1vZGVsO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBmb3IgKGFpID0gMCwgYWxlbiA9IGVsLmF0dHJpYnV0ZXMubGVuZ3RoOyBhaSA8IGFsZW47IGFpKyspIHtcblxuICAgICAgICAgICAgICBhdHRyID0gZWwuYXR0cmlidXRlc1thaV07XG4gICAgICAgICAgICAgIGF0dHJSdWxlcyA9IFtdO1xuICAgICAgICAgICAgICBhdHRyVmFsID0gJyc7XG4gICAgICAgICAgICAgIHZhbCA9IGF0dHIudmFsdWU7XG4gICAgICAgICAgICAgIHQgPSB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoIChtYXRjaCA9IHQuZXhlYyh2YWwpKSApIHtcblxuICAgICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKG1hdGNoWzBdLCBlbCwgYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCksIG1vZGVsLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAgIGF0dHJSdWxlcy5wdXNoKHJ1bGUpO1xuXG4gICAgICAgICAgICAgICAgICBpZiAocnVsZS5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrID0gbWF0Y2hbMF07XG4gICAgICAgICAgICAgICAgICAgIGJlZ2luUG9zID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGJvZHlCZWdpblBvcyA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgY2xvc2luZyB0YWdcbiAgICAgICAgICAgICAgICAgICAgZm9yICg7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgIW1hdGNoRW5kQmxvY2socnVsZS5ibG9jaywgbWF0Y2hbMF0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSB0LmV4ZWModmFsKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdVbmNsb3NlZCcgKyBibG9jaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBSZXBsYWNlIGZ1bGwgYmxvY2sgdGFnIGJvZHkgd2l0aCBydWxlIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgYXR0clZhbCArPVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsLnNsaWNlKDAsIGJlZ2luUG9zKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBydWxlLnJlcGxhY2UoYXR0ci52YWx1ZS5zbGljZShib2R5QmVnaW5Qb3MsIG1hdGNoLmluZGV4KSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsLnNsaWNlKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoIXJ1bGUuYmxvY2sgJiYgcnVsZS5yZXBsYWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXR0ci52YWx1ZSA9IHJ1bGUucmVwbGFjZTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFJ1bGUgY2hhbmdlcyBjYW4gbXV0YXRlIGF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgIC8vIHNvIHByb2Nlc3MgaW4gYW5vdGhlciBwYXNzXG4gICAgICAgICAgICAgIGlmIChhdHRyUnVsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYXR0ci52YWx1ZSA9IGF0dHJWYWw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZm9yIChyaSA9IDA7IHJpIDwgYXR0clJ1bGVzLmxlbmd0aDsgcmkrKykge1xuICAgICAgICAgICAgICAgIHJ1bGUgPSBhdHRyUnVsZXNbcmldO1xuICAgICAgICAgICAgICAgIGlmIChydWxlLmNoYW5nZSkge1xuICAgICAgICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHJ1bGUuYmxvY2sgfHwgcnVsZS5wcm9wLCBydWxlLmNoYW5nZSk7XG4gICAgICAgICAgICAgICAgICBydWxlLmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBpbGVcbiAgICAgICAgICAgIGZyYWcgPSBjb21waWxlKG5vZGUsIG1vZGVsLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGlmIChmcmFnLmNoaWxkTm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGZyYWcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgODpcbiAgICAgICAgICAgIGlmIChtYXRjaEVuZEJsb2NrKCcnLCBlbC5kYXRhLCBvcHRpb25zKSkge1xuICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuZXhwZWN0ZWQgJyArIGVsLmRhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggKG1hdGNoID0gZWwuZGF0YS5tYXRjaCh0b2tlbml6ZXIob3B0aW9ucykpKSApIHtcblxuICAgICAgICAgICAgICBydWxlID0gbWF0Y2hSdWxlcyhlbC5kYXRhLCBub2RlLCBudWxsLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBET00gcmVwbGFjZW1lbnQ/XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucmVwbGFjZS5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlLCBlbCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGFnIGNvbnRlbnRzP1xuICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkrKztcblxuICAgICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIGNoaWxkcmVuW2ldLmRhdGEgfHwgJycsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGRyZW5baV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBlbC5kYXRhO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgYGVsYCB3aXRoIGBydWxlLnJlcGxhY2UoKWAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHJ1bGUucmVwbGFjZShibG9jaywgZWwucGFyZW50Tm9kZSksIGVsKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5wcm9wICYmIHJ1bGUuY2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcnVsZS5wcm9wLCBydWxlLmNoYW5nZSk7XG4gICAgICAgICAgICAgICAgICBydWxlLmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgfSAvLyBzd2l0Y2hcblxuICAgICAgfSAvLyBmb3JcblxuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH07XG4iLCIvKlxuXG4jIyBDb25zdGFudHNcblxuKi9cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJlLXF1b3RlZFwiXG4gICAgUkVfUEFSVElBTDogLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8sXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0VORFNfV0lUSF9OT0RFX0lEOiAvLisoI1tcXHdcXC5cXC1dKykkLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qIVxuICogY29udGVudGxvYWRlZC5qc1xuICpcbiAqIEF1dGhvcjogRGllZ28gUGVyaW5pIChkaWVnby5wZXJpbmkgYXQgZ21haWwuY29tKVxuICogU3VtbWFyeTogY3Jvc3MtYnJvd3NlciB3cmFwcGVyIGZvciBET01Db250ZW50TG9hZGVkXG4gKiBVcGRhdGVkOiAyMDEwMTAyMFxuICogTGljZW5zZTogTUlUXG4gKiBWZXJzaW9uOiAxLjJcbiAqXG4gKiBVUkw6XG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9cbiAqIGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9Db250ZW50TG9hZGVkL01JVC1MSUNFTlNFXG4gKlxuICovXG5cbi8vIEB3aW4gd2luZG93IHJlZmVyZW5jZVxuLy8gQGZuIGZ1bmN0aW9uIHJlZmVyZW5jZVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb250ZW50TG9hZGVkKHdpbiwgZm4pIHtcblxuXHR2YXIgZG9uZSA9IGZhbHNlLCB0b3AgPSB0cnVlLFxuXG5cdGRvYyA9IHdpbi5kb2N1bWVudCxcblx0cm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQsXG5cdG1vZGVybiA9IGRvYy5hZGRFdmVudExpc3RlbmVyLFxuXG5cdGFkZCA9IG1vZGVybiA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCcsXG5cdHJlbSA9IG1vZGVybiA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdkZXRhY2hFdmVudCcsXG5cdHByZSA9IG1vZGVybiA/ICcnIDogJ29uJyxcblxuXHRpbml0ID0gZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLnR5cGUgPT0gJ3JlYWR5c3RhdGVjaGFuZ2UnICYmIGRvYy5yZWFkeVN0YXRlICE9ICdjb21wbGV0ZScpIHJldHVybjtcblx0XHQoZS50eXBlID09ICdsb2FkJyA/IHdpbiA6IGRvYylbcmVtXShwcmUgKyBlLnR5cGUsIGluaXQsIGZhbHNlKTtcblx0XHRpZiAoIWRvbmUgJiYgKGRvbmUgPSB0cnVlKSkgZm4uY2FsbCh3aW4sIGUudHlwZSB8fCBlKTtcblx0fSxcblxuXHRwb2xsID0gZnVuY3Rpb24oKSB7XG5cdFx0dHJ5IHsgcm9vdC5kb1Njcm9sbCgnbGVmdCcpOyB9IGNhdGNoKGUpIHsgc2V0VGltZW91dChwb2xsLCA1MCk7IHJldHVybjsgfVxuXHRcdGluaXQoJ3BvbGwnKTtcblx0fTtcblxuXHRpZiAoZG9jLnJlYWR5U3RhdGUgPT0gJ2NvbXBsZXRlJykgZm4uY2FsbCh3aW4sICdsYXp5Jyk7XG5cdGVsc2Uge1xuXHRcdGlmICghbW9kZXJuICYmIHJvb3QuZG9TY3JvbGwpIHtcblx0XHRcdHRyeSB7IHRvcCA9ICF3aW4uZnJhbWVFbGVtZW50OyB9IGNhdGNoKGUpIHsgfVxuXHRcdFx0aWYgKHRvcCkgcG9sbCgpO1xuXHRcdH1cblx0XHRkb2NbYWRkXShwcmUgKyAnRE9NQ29udGVudExvYWRlZCcsIGluaXQsIGZhbHNlKTtcblx0XHRkb2NbYWRkXShwcmUgKyAncmVhZHlzdGF0ZWNoYW5nZScsIGluaXQsIGZhbHNlKTtcblx0XHR3aW5bYWRkXShwcmUgKyAnbG9hZCcsIGluaXQsIGZhbHNlKTtcblx0fVxuXG59XG4iLCIvKlxuICBcbkRlZmF1bHQgb3B0aW9uc1xuXG4qL1xuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgZGVsaW1pdGVyczogWyd7eycsICd9fSddXG4gICAgfTtcbiIsIi8qXG5cbkV2YWx1YXRlIG9iamVjdCBmcm9tIGxpdGVyYWwgb3IgQ29tbW9uSlMgbW9kdWxlXG5cbiovXG5cbiAgICAvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYywgbW9kZWwpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIG1vZGVsID0gbW9kZWwgfHwge307XG4gICAgICBpZiAodHlwZW9mIG1vZGVsICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG1vZGVsID0ganRtcGwuZnJlYWsobW9kZWwpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgaWYgKC8vIFBsdWdpblxuICAgICAgICAgICAgICAocHJvcC5pbmRleE9mKCdfXycpID09PSAwICYmXG4gICAgICAgICAgICAgICAgcHJvcC5sYXN0SW5kZXhPZignX18nKSA9PT0gcHJvcC5sZW5ndGggLSAyKSB8fFxuICAgICAgICAgICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eVxuICAgICAgICAgICAgICB0eXBlb2YgcHJvcGVydGllc1twcm9wXSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgaWYgKHRhcmdldC52YWx1ZXNbcHJvcF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQudmFsdWVzW3Byb3BdID0gcHJvcGVydGllc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBUYXJnZXQgZG9lc24ndCBhbHJlYWR5IGhhdmUgcHJvcD9cbiAgICAgICAgICAgIGlmICh0YXJnZXQocHJvcCkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQocHJvcCwgcHJvcGVydGllc1twcm9wXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGFwcGx5UGx1Z2lucygpIHtcbiAgICAgICAgdmFyIHByb3AsIGFyZztcbiAgICAgICAgZm9yIChwcm9wIGluIGp0bXBsLnBsdWdpbnMpIHtcbiAgICAgICAgICBwbHVnaW4gPSBqdG1wbC5wbHVnaW5zW3Byb3BdO1xuICAgICAgICAgIGFyZyA9IG1vZGVsLnZhbHVlc1snX18nICsgcHJvcCArICdfXyddO1xuICAgICAgICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSAnZnVuY3Rpb24nICYmIGFyZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBwbHVnaW4uY2FsbChtb2RlbCwgYXJnLCB0YXJnZXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBldmFsT2JqZWN0KGJvZHksIHNyYykge1xuICAgICAgICB2YXIgcmVzdWx0LCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH07XG4gICAgICAgIHNyYyA9IHNyYyA/XG4gICAgICAgICAgJ1xcbi8vQCBzb3VyY2VVUkw9JyArIHNyYyArXG4gICAgICAgICAgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNyYyA6XG4gICAgICAgICAgJyc7XG4gICAgICAgIGlmIChib2R5Lm1hdGNoKC9eXFxzKntbXFxTXFxzXSp9XFxzKiQvKSkge1xuICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICByZXR1cm4gZXZhbCgnKGZ1bmN0aW9uKCl7IHZhciByZXN1bHQ9JyArIGJvZHkgKyAnO3JldHVybiByZXN1bHR9KSgpJyArIHNyYyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29tbW9uSlMgbW9kdWxlXG4gICAgICAgIGV2YWwoYm9keSArIHNyYyk7XG4gICAgICAgIHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiAgICAgICAgICAvL2V2YWwoXG4gICAgICAgICAgICAvLycoZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzKXsnICtcbiAgICAgICAgICAgIC8vYm9keSArXG4gICAgICAgICAgICAvLyc7cmV0dXJuIG1vZHVsZS5leHBvcnRzfSknICtcbiAgICAgICAgICAgIC8vc3JjXG4gICAgICAgICAgLy8pKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBsb2FkTW9kZWwoc3JjLCB0ZW1wbGF0ZSwgZG9jKSB7XG4gICAgICAgIHZhciBoYXNoSW5kZXg7XG4gICAgICAgIGlmICghc3JjKSB7XG4gICAgICAgICAgLy8gTm8gc291cmNlXG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNyYy5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBFbGVtZW50IGluIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvYy5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QoZWxlbWVudC5pbm5lckhUTUwsIHNyYykpO1xuICAgICAgICAgIGFwcGx5UGx1Z2lucygpO1xuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCBtb2RlbCB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLCBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGNvbnN0cy5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICB2YXIgZWxlbWVudCA9IG1hdGNoICYmIG5ldyBET01QYXJzZXIoKVxuICAgICAgICAgICAgICAucGFyc2VGcm9tU3RyaW5nKHJlc3AsICd0ZXh0L2h0bWwnKVxuICAgICAgICAgICAgICAucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG4gICAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCwgc3JjKSk7XG4gICAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBsb2FkVGVtcGxhdGUoKSB7XG4gICAgICAgIHZhciBoYXNoSW5kZXg7XG5cbiAgICAgICAgaWYgKCFzcmMpIHJldHVybjtcblxuICAgICAgICBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIGlzIHRoZSBjb250ZW50cyBvZiBlbGVtZW50XG4gICAgICAgICAgLy8gYmVsb25naW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBsb2FkTW9kZWwoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSwgZWxlbWVudC5pbm5lckhUTUwsIGRvY3VtZW50KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCB0ZW1wbGF0ZSB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLCBmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgIHZhciBkb2M7XG4gICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgZG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlSFRNTERvY3VtZW50KCcnKTtcbiAgICAgICAgICAgICAgZG9jLmRvY3VtZW50RWxlbWVudC5pbm5lckhUTUwgPSByZXNwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGRvYyA9IGRvY3VtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBkb2MucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG5cbiAgICAgICAgICAgIGxvYWRNb2RlbChcbiAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbCcpIDogJycsXG4gICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLFxuICAgICAgICAgICAgICBkb2NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9hZFRlbXBsYXRlKCk7XG4gICAgfTtcbiIsIi8qXG5cbiMjIE1haW4gZnVuY3Rpb25cblxuKi9cbiAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgIGZ1bmN0aW9uIGp0bXBsKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgdGFyZ2V0LCB0LCB0ZW1wbGF0ZSwgbW9kZWw7XG5cbiAgICAgIC8vIGp0bXBsKCdIVFRQX01FVEhPRCcsIHVybFssIHBhcmFtZXRlcnNbLCBjYWxsYmFja1ssIG9wdGlvbnNdXV0pP1xuICAgICAgaWYgKFsnR0VUJywgJ1BPU1QnXS5pbmRleE9mKGFyZ3NbMF0pID4gLTEpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJy4veGhyJykuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRhcmdldCk/XG4gICAgICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gcmV0dXJuIG1vZGVsXG4gICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMF0pLl9fanRtcGxfXztcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gICAgICBlbHNlIGlmIChcbiAgICAgICAgKCBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgfHxcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgKCAoYXJnc1sxXSAmJiB0eXBlb2YgYXJnc1sxXS5hcHBlbmRDaGlsZCA9PT0gJ2Z1bmN0aW9uJykgfHxcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgYXJnc1syXSAhPT0gdW5kZWZpbmVkXG5cbiAgICAgICkge1xuXG4gICAgICAgIHRhcmdldCA9IGFyZ3NbMF0gJiYgYXJnc1swXS5ub2RlVHlwZSAgP1xuICAgICAgICAgIGFyZ3NbMF0gOlxuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICAgICAgdGVtcGxhdGUgPSBhcmdzWzFdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgICAgIGFyZ3NbMV07XG5cbiAgICAgICAgbW9kZWwgPVxuICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgIC8vIGFscmVhZHkgd3JhcHBlZFxuICAgICAgICAgICAgYXJnc1syXSA6XG4gICAgICAgICAgICAvLyBvdGhlcndpc2Ugd3JhcFxuICAgICAgICAgICAganRtcGwuZnJlYWsoXG4gICAgICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAgICAgLy8gb2JqZWN0XG4gICAgICAgICAgICAgICAgYXJnc1syXSA6XG5cbiAgICAgICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycgJiYgYXJnc1syXS5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgICAgICAgICAgLy8gc3JjLCBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICByZXF1aXJlKCcuL2xvYWRlcicpXG4gICAgICAgICAgICAgICAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMl0pLmlubmVySFRNTCkgOlxuXG4gICAgICAgICAgICAgICAgICAvLyBzaW1wbGUgdmFsdWUsIGJveCBpdFxuICAgICAgICAgICAgICAgICAgeycuJzogYXJnc1syXX1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgaWYgKHRhcmdldC5ub2RlTmFtZSA9PT0gJ1NDUklQVCcpIHtcbiAgICAgICAgICB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgdC5pZCA9IHRhcmdldC5pZDtcbiAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQodCwgdGFyZ2V0KTtcbiAgICAgICAgICB0YXJnZXQgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXNzb2NpYXRlIHRhcmdldCBhbmQgbW9kZWxcbiAgICAgICAgdGFyZ2V0Ll9fanRtcGxfXyA9IG1vZGVsO1xuXG4gICAgICAgIC8vIEVtcHR5IHRhcmdldFxuICAgICAgICB0YXJnZXQuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgLy8gQXNzaWduIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChyZXF1aXJlKCcuL2NvbXBpbGVyJykodGVtcGxhdGUsIG1vZGVsLCBhcmdzWzNdKSk7XG4gICAgICB9XG4gICAgfVxuXG5cblxuLypcblxuT24gcGFnZSByZWFkeSwgcHJvY2VzcyBqdG1wbCB0YXJnZXRzXG5cbiovXG5cbiAgICByZXF1aXJlKCcuL2NvbnRlbnQtbG9hZGVkJykod2luZG93LCBmdW5jdGlvbigpIHtcblxuICAgICAgdmFyIGxvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG4gICAgICB2YXIgdGFyZ2V0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWp0bXBsXScpO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGFyZ2V0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBsb2FkZXIodGFyZ2V0c1tpXSwgdGFyZ2V0c1tpXS5nZXRBdHRyaWJ1dGUoJ2RhdGEtanRtcGwnKSk7XG4gICAgICB9XG4gICAgfSk7XG5cblxuLypcblxuRXhwb3NlIGZyZWFrXG5cbiovXG5cbiAgICBqdG1wbC5mcmVhayA9IHJlcXVpcmUoJ2ZyZWFrJyk7XG5cblxuXG4vKlxuXG5QbHVnaW5zXG5cbiovXG5cbiAgICBqdG1wbC5wbHVnaW5zID0ge1xuICAgICAgaW5pdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgYXJnLmNhbGwodGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG5cbi8qXG5cbkV4cG9ydFxuXG4qL1xuICAgIG1vZHVsZS5leHBvcnRzID0ganRtcGw7XG4iLCIvKlxuXG4jIyBSdWxlc1xuXG5FYWNoIHJ1bGUgaXMgYSBmdW5jdGlvbiwgYXJncyB3aGVuIGNhbGxlZCBhcmU6XG4odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucylcblxudGFnOiB0ZXh0IGJldHdlZW4gZGVsaW1pdGVycywge3t0YWd9fVxubm9kZTogRE9NIG5vZGUsIHdoZXJlIHRhZyBpcyBmb3VuZFxuYXR0cjogbm9kZSBhdHRyaWJ1dGUgb3IgbnVsbCwgaWYgbm9kZSBjb250ZW50c1xubW9kZWw6IEZyZWFrIG1vZGVsXG5vcHRpb25zOiBjb25maWd1cmF0aW9uIG9wdGlvbnNcblxuSXQgbXVzdCByZXR1cm4gZWl0aGVyOlxuXG4qIGZhbHN5IHZhbHVlIC0gbm8gbWF0Y2hcblxuKiBvYmplY3QgLSBtYXRjaCBmb3VuZCwgcmV0dXJuIChhbGwgZmllbGRzIG9wdGlvbmFsKVxuXG4gICAgIHtcbiAgICAgICAvLyBQYXJzZSB1bnRpbCB7ey99fSBvciB7ey9zb21lUHJvcH19IC4uLlxuICAgICAgIGJsb2NrOiAnc29tZVByb3AnLFxuXG4gICAgICAgLy8gLi4uIHRoZW4gdGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZC5cbiAgICAgICAvLyBJdCBtdXN0IHJldHVybiBzdHJpbmcgb3IgRE9NRWxlbWVudFxuICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkgeyAuLi4gfVxuICAgICB9XG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdmFsdWUtdmFyJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL2NsYXNzLXNlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9pbnZlcnRlZC1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3BhcnRpYWwnKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdW5lc2NhcGVkLXZhcicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy92YXInKVxuICAgIF07XG4iLCIvKlxuXG4jIyMgY2xhc3M9XCJ7eyNpZkNvbmRpdGlvbn19c29tZS1jbGFzc3t7L319XCJcblxuVG9nZ2xlcyBjbGFzcyBgc29tZS1jbGFzc2AgaW4gc3luYyB3aXRoIGJvb2xlYW4gYG1vZGVsLmlmQ29uZGl0aW9uYFxuXG5cbiMjIyBjbGFzcz1cInt7Xm5vdElmQ29uZGl0aW9ufX1zb21lLWNsYXNze3svfX1cIlxuXG5Ub2dnbGVzIGNsYXNzIGBzb21lLWNsYXNzYCBpbiBzeW5jIHdpdGggYm9vbGVhbiBub3QgYG1vZGVsLm5vdElmQ29uZGl0aW9uYFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnKCN8XFxcXF4pJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgaW52ZXJ0ZWQgPSBtYXRjaCAmJiAobWF0Y2hbMV0gPT09ICdeJyk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzJdO1xuICAgICAgdmFyIGtsYXNzO1xuXG5cbiAgICAgIGlmIChhdHRyID09PSAnY2xhc3MnICYmIG1hdGNoKSB7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwpIHtcbiAgICAgICAgICAgIGtsYXNzID0gdG1wbDtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIHJlcXVpcmUoJ2VsZW1lbnQtY2xhc3MnKShub2RlKVxuICAgICAgICAgICAgICBbKGludmVydGVkID09PSAhdmFsKSAmJiAnYWRkJyB8fCAncmVtb3ZlJ10oa2xhc3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3teaW52ZXJ0ZWQtc2VjdGlvbn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ15cXFxcXicgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciB0ZW1wbGF0ZTtcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGNoYW5nZSk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCB2YWwoaSkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2ggJiYgIWF0dHIpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG4gICAgICAgICAgICByZXR1cm4gYW5jaG9yO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIFBhcnRpYWxcblxuKiB7ez5cIiNpZFwifX1cbioge3s+XCJ1cmxcIn19XG4qIHt7PlwidXJsI2lkXCJ9fVxuKiB7ez5wYXJ0aWFsU3JjfX1cblxuUmVwbGFjZXMgcGFyZW50IHRhZyBjb250ZW50cywgYWx3YXlzIHdyYXAgaW4gYSB0YWdcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4uL2NvbnN0cycpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKGNvbnN0cy5SRV9QQVJUSUFMKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciB0YXJnZXQ7XG5cbiAgICAgIHZhciBsb2FkZXIgPSBtYXRjaCAmJlxuICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcXVpcmUoJy4uL2xvYWRlcicpKFxuICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgbWF0Y2hbMV0gP1xuICAgICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgICBtb2RlbChtYXRjaFsxXSkgOlxuICAgICAgICAgICAgICAvLyBMaXRlcmFsXG4gICAgICAgICAgICAgIG1hdGNoWzJdIHx8IG1hdGNoWzNdLFxuICAgICAgICAgICAgbW9kZWxcbiAgICAgICAgICApXG4gICAgICAgIH07XG5cbiAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgIGlmIChtYXRjaFsxXSkge1xuICAgICAgICAgIC8vIFZhcmlhYmxlXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG1hdGNoWzFdLCBsb2FkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTG9hZCBhc3luY1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRlciwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICByZXBsYWNlOiBhbmNob3JcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3sjc2VjdGlvbn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ14jJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzFdO1xuICAgICAgdmFyIHRlbXBsYXRlO1xuICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgIGZ1bmN0aW9uIHVwZGF0ZShpKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGkgKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcblxuICAgICAgICAgIHBhcmVudC5yZXBsYWNlQ2hpbGQoXG4gICAgICAgICAgICBjb21waWxlKHRlbXBsYXRlLCBtb2RlbChwcm9wKShpKSksXG4gICAgICAgICAgICBwYXJlbnQuY2hpbGROb2Rlc1twb3NdXG4gICAgICAgICAgKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gaW5zZXJ0KGluZGV4LCBjb3VudCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgaSwgZnJhZ21lbnQ7XG5cbiAgICAgICAgZm9yIChpID0gMCwgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGluZGV4ICsgaSkpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBpbnNlcnQpO1xuICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgZGVsKTtcbiAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB2YWwubGVuOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhbC5vbignY2hhbmdlJywgaSwgdXBkYXRlKGkpKTtcbiAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCB2YWwoaSkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE9iamVjdD9cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZW5kZXIgPSBjb21waWxlKHRlbXBsYXRlLCB2YWwpO1xuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG5cbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG5cbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3smdmFyfX1cblxuKGB7e3t2YXJ9fX1gIGlzIHJlcGxhY2VkIG9uIHByZXByb2Nlc3Npbmcgc3RlcClcblxuQ2FuIGJlIGJvdW5kIHRvIG5vZGUgaW5uZXJIVE1MXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChuZXcgUmVnRXhwKCdeJicgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBpZiAobWF0Y2ggJiYgIWF0dHIpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwcm9wOiBwcm9wLFxuICAgICAgICAgIHJlcGxhY2U6IGFuY2hvcixcbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgdmFsdWVcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbC5pbm5lckhUTUwgPSBtb2RlbChwcm9wKSB8fCAnJztcbiAgICAgICAgICAgIGxlbmd0aCA9IGVsLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGVsLmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGZyYWdtZW50LCBhbmNob3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMgKHZhbHVlIHwgY2hlY2tlZCB8IHNlbGVjdGVkKT1cInt7dmFsfX1cIlxuXG5IYW5kbGUgXCJ2YWx1ZVwiLCBcImNoZWNrZWRcIiBhbmQgXCJzZWxlY3RlZFwiIGF0dHJpYnV0ZXNcblxuKi9cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXJFdmVudChlbCwgZXZlbnROYW1lKXtcbiAgICAgIHZhciBldmVudDtcbiAgICAgIGlmIChkb2N1bWVudC5jcmVhdGVFdmVudCl7XG4gICAgICAgIGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0hUTUxFdmVudHMnKTtcbiAgICAgICAgZXZlbnQuaW5pdEV2ZW50KGV2ZW50TmFtZSx0cnVlLHRydWUpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZihkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCl7XG4gICAgICAgIC8vIElFIDwgOVxuICAgICAgICBldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gICAgICAgIGV2ZW50LmV2ZW50VHlwZSA9IGV2ZW50TmFtZTtcbiAgICAgIH1cbiAgICAgIGV2ZW50LmV2ZW50TmFtZSA9IGV2ZW50TmFtZTtcbiAgICAgIGlmIChlbC5kaXNwYXRjaEV2ZW50KXtcbiAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChlbC5maXJlRXZlbnQgJiYgaHRtbEV2ZW50c1snb24nICsgZXZlbnROYW1lXSkge1xuICAgICAgICAvLyBJRSA8IDlcbiAgICAgICAgZWwuZmlyZUV2ZW50KCdvbicgKyBldmVudC5ldmVudFR5cGUsIGV2ZW50KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGVsW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgZWxbZXZlbnROYW1lXSgpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZWxbJ29uJyArIGV2ZW50TmFtZV0pIHtcbiAgICAgICAgZWxbJ29uJyArIGV2ZW50TmFtZV0oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgWyd2YWx1ZScsICdjaGVja2VkJywgJ3NlbGVjdGVkJ10uaW5kZXhPZihhdHRyKSA+IC0xKSB7XG4gICAgICAgIC8vIDxzZWxlY3Q+IG9wdGlvbj9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgLy8gQXR0YWNoIGFzeW5jLCBhcyBwYXJlbnROb2RlIGlzIHN0aWxsIGRvY3VtZW50RnJhZ21lbnRcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUgJiYgbm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwocHJvcCkgIT09IG5vZGUuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuc2VsZWN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGVbYXR0cl0pIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsXG4gICAgICAgICAgICAgICAgICBpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFt0eXBlPXJhZGlvXVtuYW1lPScgKyBub2RlLm5hbWUgKyAnXScpLFxuICAgICAgICAgICAgICAgICAgbGVuID0gaW5wdXRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgIGkgPCBsZW47XG4gICAgICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXRzW2ldICE9PSBub2RlKSB7XG4gICAgICAgICAgICAgICAgICB0cmlnZ2VyRXZlbnQoaW5wdXRzW2ldLCAnY2hhbmdlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRleHQgaW5wdXQ/XG4gICAgICAgIHZhciBldmVudFR5cGUgPSBbJ3RleHQnLCAncGFzc3dvcmQnXS5pbmRleE9mKG5vZGUudHlwZSkgPiAtMSA/XG4gICAgICAgICAgJ2lucHV0JyA6ICdjaGFuZ2UnO1xuXG4gICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3t2YXJ9fVxuXG5DYW4gYmUgYm91bmQgdG8gdGV4dCBub2RlIGRhdGEgb3IgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciByZWFjdCwgdGFyZ2V0LCBjaGFuZ2U7XG5cbiAgICAgIGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbC52YWx1ZXMpIDpcbiAgICAgICAgICB2YWw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUikpIHtcblxuICAgICAgICBpZiAoYXR0cikge1xuICAgICAgICAgIC8vIEF0dHJpYnV0ZVxuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGdldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbCA/XG4gICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbCkgOlxuICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgICAgICBjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRhcmdldC5kYXRhID0gZ2V0KCkgfHwgJyc7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1hdGNoIGZvdW5kXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogdGFnLFxuICAgICAgICAgIHJlcGxhY2U6IHRhcmdldCxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICApLmpvaW4oJyYnKSA6XG5cbiAgICAgICAgICAgIC8vIE5vIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICcnO1xuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIHJlc3A7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3AgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJlc3AgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCByZXNwLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vcGVuKGFyZ3NbMF0sIGFyZ3NbMV0sXG4gICAgICAgIChvcHRzLmFzeW5jICE9PSB1bmRlZmluZWQgPyBvcHRzLmFzeW5jIDogdHJ1ZSksIFxuICAgICAgICBvcHRzLnVzZXIsIG9wdHMucGFzc3dvcmQpO1xuXG4gICAgICB4aHIuc2VuZChyZXF1ZXN0KTtcblxuICAgIH07XG4iXX0=
(8)
});
