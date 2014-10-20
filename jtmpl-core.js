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
        if (x.hasOwnProperty(prop)) {
          if (y.hasOwnProperty(prop)) {
            if (!deepEqual(x[prop], y[prop])) {
              return false;
            }
          }
          else {
            return false;
          }
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
    var handlers = (listeners[event][['change'].indexOf(event) > -1 ? a : null] || []);
    var i, len = handlers.length;
    for (i = 0; i < len; i++) {
      handlers[i].call(instance, a, b);
    };
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
      instance(key, data[key]);
      trigger('update', key);
    }
    instance.len = obj.length;
  }

  // Update handler: recalculate dependent properties,
  // trigger change if necessary
  function update(prop) {
    if (!deepEqual(cache[prop], get(prop, function() {}, true))) {
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
      instance.parent.trigger('update', instance.prop);
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
        return context(_prop, _arg, true);
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

  // Shallow clone an object
  function shallowClone(obj) {
    var key, clone;
    if (obj && typeof obj === 'object') {
      clone = {};
      for (key in obj) {
        clone[key] = obj[key];
      }
    }
    else {
      clone = obj;
    }
    return clone;
  }

  // Getter for prop, if callback is given
  // can return async value
  function get(prop, callback, skipCaching) {
    var val = obj[prop];
    if (typeof val === 'function') {
      val = val.call(getDependencyTracker(prop), callback);
      if (!skipCaching) {
        cache[prop] = (val === undefined) ? val : shallowClone(val);
      }
    }
    else if (!skipCaching) {
      cache[prop] = val;
    }
    return val;
  }

  function getter(prop, callback, skipCaching) {
    var result = get(prop, callback, skipCaching);

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
        delete children[prop];
      }
    }

    if (oldVal !== val) {
      trigger('update', prop);
    }
  }

  // Functional accessor, unify getter and setter
  function accessor(prop, arg, skipCaching) {
    return (
      (arg === undefined || typeof arg === 'function') ?
        getter : setter
    )(prop, arg, skipCaching);
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
      // Deprecated. It has always been broken, anyway
      // Will think how to implement properly
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
        cache = {};
        children = {};
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
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        shift: wrapArrayMethod('shift', function() {
          trigger('delete', 0, 1);
        }),

        unshift: wrapArrayMethod('unshift', function() {
          trigger('insert', 0, 1);
        }),

        sort: wrapArrayMethod('sort', function() {
          trigger('delete', 0, this.len);
          trigger('insert', 0, this.len);
        }),

        splice: wrapArrayMethod('splice', function() {
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
/**
 * Rules
 */
module.exports = {

  attr: [

    function(node, attr) {

    }
  ],

  node: [

    /**
     * {{var}}
     */
    function(node) {
      if (node.innerHTML.match(/[\w\.\-]+/)) {
        return {
          rule: function(fragment, node, model) {
            var prop = node.innerHTML;
            var textNode = document.createTextNode(model(prop));
            model.on('change', prop, function() {
              textNode.data = model(prop);
            });
            fragment.appendChild(textNode);
          }
        };
      }
    }

  ]
};

},{}],4:[function(_dereq_,module,exports){
/**
 * Compile a template, parsed by @see parse
 *
 * @param {documentFragment} template
 *
 * @returns {string} - Function body, accepting Freak instance parameter, suitable for eval()
 */
function compile(template) {

  // Compile rules, for attributes and nodes
  var compileRules = _dereq_('./compile-rules');
  var match;

  // Generate dynamic function body
  var func = '(function(model) {' +
    'var frag = document.createDocumentFragment(), node;';


  // Iterate childNodes
  for (var i = 0, childNodes = template.childNodes, len = childNodes.length, node;
       i < len; i++) {

    node = childNodes[i];

    switch (node.nodeType) {

      // Element node
      case 1:

        // jtmpl tag?
        if (node.nodeName === 'SCRIPT' && node.type === 'text/jtmpl-tag') {

          for (var ri = 0, rules = compileRules.node, rlen = rules.length;
              ri < rlen; ri++) {
            match = rules[ri](node);

            // Rule found?
            if (match) {

              // Skip remaining rules
              break;
            }
          }

          // REMOVEMELATER
          if (!match) {
            func += 'node = document.createTextNode("AAAAAAAAAA");';
            func += 'frag.appendChild(node);';
          }
        }

        else {
          // Create element
          func += 'node = document.createElement("' + node.nodeName + '");';

          // Clone attributes
          for (var ai = 0, attributes = node.attributes, alen = attributes.length;
               ai < alen; ai++) {
                 func += 'node.setAttribute("' +
                   attributes[ai].name +
                   '", ' +
                   JSON.stringify(attributes[ai].value) +
                   ');';
               }

          // Recursively compile
          func += 'node.appendChild(' + compile(node, model) + '());';

          // Append to fragment
          func += 'frag.appendChild(node);';
        }

        break;


      // Text node
      case 3:
        func += 'frag.appendChild(document.createTextNode(' +
          JSON.stringify(node.data) + '));';
        break;


      // Comment node
      case 8:
        func += 'frag.appendChild(document.createComment(' +
          JSON.stringify(node.data) + '));';
        break;

    } // end switch
  } // end iterate childNodes

  func += 'return frag; })';

  return func;
}



module.exports = compile;

},{"./compile-rules":3}],5:[function(_dereq_,module,exports){
/*

## Compiler

*/


/*

### compile(template, model[, options])

Return documentFragment

*/


    var consts = _dereq_('./consts');
    var reEndBlock;

    // Utility functions

    function escapeRE(s) {
      return (s + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
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
      // 1. wrap each non-attribute tag
      // (that's not inside <select> (fuck you, IE)) in HTML comment
      // 2. remove Mustache comments
      template = template.replace(
        tokenizer(options, 'g'),
        function(match, match1, pos) {
          var head = template.slice(0, pos);
          var insideTag = !!head.match(RegExp('<' + consts.RE_SRC_IDENTIFIER + '[^>]*?$'));
          var opening = head.match(/<(select|SELECT)/g);
          var closing = head.match(/<\/(select|SELECT)/g);
          var insideSelect =
              (opening && opening.length || 0) > (closing && closing.length || 0);
          var insideComment = !!head.match(/<!--\s*$/);
          var isMustacheComment = match1.indexOf('!') === 0;

          return insideTag || insideComment ?
            isMustacheComment ?
              '' :
              match :
            insideSelect ?
              match :
              '<!--' + match + '-->';
        }
      );
      // prefix 'selected' and 'checked' attributes with 'jtmpl-'
      // (to avoid "special" processing, oh IE8)
      template = template.replace(
        /(<(?:option|OPTION)[^>]*?)(?:selected|SELECTED)=/g,
        '$1jtmpl-selected=');

      template = template.replace(
        /(<(?:input|INPUT)[^>]*?)(?:checked|CHECKED)=/g,
        '$1jtmpl-checked=');

      return template;
    }


    function matchEndBlock(block, template, options) {
      if (!reEndBlock) {
        reEndBlock = RegExp(
          escapeRE(options.delimiters[0]) +
          '\\/' + consts.RE_SRC_IDENTIFIER + '?' +
          escapeRE(options.delimiters[1])
        );
      }
      var match = template.match(reEndBlock);
      return match ?
        block === '' || !match[1] || match[1] === block :
        false;
    }




    var templateCache = [];
    var newCounter = 0;
    var cacheHitCounter = 0;


    module.exports = function compile(template, model, options) {

      // Variables

      var i, children, len, ai, alen, attr, val, attrRules, ri, attrName, attrVal;
      var buffer, pos, beginPos, bodyBeginPos, body, node, el, contents, t, match, rule, token, block;
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
        //console.log('compiler: IFRAME construction');
        template = preprocess(template, options);
        iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.writeln('<!doctype html>\n<html><body>' + template + '</body></html>');
        body = iframe.contentDocument.body;
        document.body.removeChild(iframe);
      }

      if (templateCache.indexOf(body) === -1) {
        newCounter++;
        templateCache.push(body);
      }
      else {
        cacheHitCounter++;
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
              // Unprefix 'jtmpl-' from attribute name, if needed
              attrName = attr.name.lastIndexOf('jtmpl-', 0) === 0 ?
                attr.name.slice('jtmpl-'.length) : attr.name;
              attrVal = '';
              val = attr.value;
              t = tokenizer(options, 'g');

              while ( (match = t.exec(val)) ) {

                rule = matchRules(match[0], el, attrName.toLowerCase(), model, options);

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

                  if (rule.asyncInit) {
                    setTimeout(rule.asyncInit, 0);
                  }

                }
              }

              // Set new attribute value
              //attrVal = attrVal || attr.value;
              //el.setAttribute(attrName, attrVal);

              // Attach attribute listeners and trigger initial change
              for (ri = 0; ri < attrRules.length; ri++) {
                rule = attrRules[ri];
                if (rule.change) {
                  model.on('change', rule.block || rule.prop, rule.change);
                  rule.change();
                }
              }

            }

            // Clear 'jtmpl-'-prefixed attributes
            ai = 0;
            while (ai < el.attributes.length) {
              attr = el.attributes[ai];
              if (attr.name.lastIndexOf('jtmpl-', 0) === 0) {
                el.removeAttribute(attr.name);
              }
              else {
                ai++;
              }
            }

            // Recursively compile
            frag = compile(node, model, options);
            if (frag.childNodes.length) {
              el.appendChild(frag);
            }

            break;

          // Text node
          case 3:
          // Comment node
          case 8:
            contents = el.data.trim();

            if (matchEndBlock('', contents, options)) {
              throw 'jtmpl: Unexpected ' + contents;
            }

            if ( (match = contents.match(tokenizer(options))) ) {

              rule = matchRules(contents, node, null, model, options);
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
                    throw 'jtmpl: Unclosed ' + contents;
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

     //console.log('newCounter: ' + newCounter);
     //console.log('cacheHitCounter: ' + cacheHitCounter);
      return fragment;
    };

},{"./consts":6,"./default-options":8,"./rules":12,"freak":2}],6:[function(_dereq_,module,exports){
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

},{}],7:[function(_dereq_,module,exports){
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

};

},{}],8:[function(_dereq_,module,exports){
/*
  
Default options

*/
    
    module.exports = {
      delimiters: ['{{', '}}']
    };

},{}],9:[function(_dereq_,module,exports){
/*

Evaluate object from literal or CommonJS module

*/

    /* jshint evil:true */
    module.exports = function(target, src, model) {

      var consts = _dereq_('./consts');

      model = model || {};
      if (typeof model !== 'function') {
        model = jtmpl(model);
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
          return eval('result=' + body + src);
        }
        // CommonJS module
        eval(body + src);
        return module.exports;
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
          // Older IEs complain if URL contains hash
          jtmpl('GET', hashIndex > -1 ? src.substring(0, hashIndex) : src,
            function (resp) {
              var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
              var element = match && new DOMParser()
                .parseFromString(resp, 'text/html')
                .querySelector(match[1]);
              mixin(model, evalObject(match ? element.innerHTML : resp, src));
              applyPlugins();
              jtmpl(target, template, model);
            }
          );
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
          jtmpl('GET', hashIndex > -1 ? src.substring(0, hashIndex) : src,
            function(resp) {
              var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
              var iframe, doc;
              if (match) {
                iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                doc = iframe.contentDocument;
                doc.writeln(resp);
                document.body.removeChild(iframe);
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
            }
          );
        }
      }

      loadTemplate();
    };

},{"./consts":6}],10:[function(_dereq_,module,exports){
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

      // jtmpl(object)?
      else if (args.length === 1 && typeof args[0] === 'object') {
        // return Freak instance
        return _dereq_('freak')(args[0]);
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

Expose new-generation compiler for experimenting

*/

    jtmpl.parse = _dereq_('./parse');
    jtmpl.compile = _dereq_('./compile');


/*

Plugins

*/

    jtmpl.plugins = {
      init: function(arg) {
        if (typeof arg === 'function') {
          var that = this;
          // Call async, after jtmpl has constructed the DOM
          setTimeout(function() {
            arg.call(that);
          });
        }
      }
    };


/*

Export

*/
    module.exports = jtmpl;

},{"./compile":4,"./compiler":5,"./consts":6,"./content-loaded":7,"./loader":9,"./parse":11,"./xhr":22,"freak":2}],11:[function(_dereq_,module,exports){
/**
 * Parse a text template to DOM structure ready for compiling
 * @see compile
 *
 * @param {string} template
 *
 * @returns {Element}
 */
function parse(template) {

  var iframe, body;

  function preprocess(template) {

    // replace {{{tag}}} with {{&tag}}
    template = template.replace(/\{\{\{([\S\s]*?)\}\}\}/, '{{&$1}}');

    // 1. wrap each non-attribute tag in <script type="text/jtmpl-tag">
    // 2. remove Mustache comments
    template = template.replace(
      /\{\{([\S\s]*?)\}\}/g,
      function(match, match1, pos) {
        var head = template.slice(0, pos);
        var insideTag = !!head.match(/<[\w\-]+[^>]*?$/);
        var opening = head.match(/<(script|SCRIPT)/g);
        var closing = head.match(/<\/(script|SCRIPT)/g);
        var insideScript =
            (opening && opening.length || 0) > (closing && closing.length || 0);
        var insideComment = !!head.match(/<!--\s*$/);
        var isMustacheComment = match1.indexOf('!') === 0;

        return insideTag || insideComment ?
          isMustacheComment ?
            '' :
            match :
          insideScript ?
            match :
            '<script type="text/jtmpl-tag">' + match1.trim() + '\x3C/script>';
      }
    );
    // prefix 'selected' and 'checked' attributes with 'jtmpl-'
    // (to avoid "special" processing, oh IE8)
    template = template.replace(
      /(<(?:option|OPTION)[^>]*?)(?:selected|SELECTED)=/g,
      '$1jtmpl-selected=');

    template = template.replace(
      /(<(?:input|INPUT)[^>]*?)(?:checked|CHECKED)=/g,
      '$1jtmpl-checked=');

    return template;
  }

  template = preprocess(template);
  iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  iframe.contentDocument.writeln('<!doctype html>\n<html><body>' + template + '</body></html>');
  body = iframe.contentDocument.body;
  document.body.removeChild(iframe);

  return body;
}



module.exports = parse;

},{}],12:[function(_dereq_,module,exports){
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
      _dereq_('./rules/checked-var'),
      _dereq_('./rules/selected-var'),
      _dereq_('./rules/class-section'),
      _dereq_('./rules/section'),
      _dereq_('./rules/inverted-section'),
      _dereq_('./rules/partial'),
      _dereq_('./rules/unescaped-var'),
      _dereq_('./rules/var')
    ];

},{"./rules/checked-var":13,"./rules/class-section":14,"./rules/inverted-section":15,"./rules/partial":16,"./rules/section":17,"./rules/selected-var":18,"./rules/unescaped-var":19,"./rules/value-var":20,"./rules/var":21}],13:[function(_dereq_,module,exports){
/*

### checked="{{val}}"

Handle "checked" attribute

*/

    var radioGroups = {};
    // Currently updating?
    var updating = false;


    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(_dereq_('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        if (updating) {
          return;
        }
        if (node.name) {
          for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
            radioGroups[node.name][0][i].checked = radioGroups[node.name][1][i](prop);
          }
        }
        else {
          node.checked = model(prop);
        }
      }

      if (match && attr === 'checked') {
        // radio group?
        if (node.type === 'radio' && node.name) {
          if (!radioGroups[node.name]) {
            // Init radio group ([0]: node, [1]: model)
            radioGroups[node.name] = [[], []];
          }
          // Add input to radio group
          radioGroups[node.name][0].push(node);
          // Add context to radio group
          radioGroups[node.name][1].push(model);
        }

        node.addEventListener('click', function() {
          if (node.type === 'radio' && node.name) {
            updating = true;
            // Update all inputs from the group
            for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
              radioGroups[node.name][1][i](prop, radioGroups[node.name][0][i].checked);
            }
            updating = false;
          }
          else {
            // Update current input only
            model(prop, node[attr]);
          }
        });

        return {
          prop: prop,
          replace: '',
          change: change,
          asyncInit: function() {
            model.trigger('change', prop);
          }
        };
      }
    }

},{"../consts":6}],14:[function(_dereq_,module,exports){
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

},{"../consts":6,"element-class":1}],15:[function(_dereq_,module,exports){
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

},{"../compiler":5,"../consts":6}],16:[function(_dereq_,module,exports){
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

},{"../consts":6,"../loader":9}],17:[function(_dereq_,module,exports){
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

},{"../compiler":5,"../consts":6}],18:[function(_dereq_,module,exports){
/*

### selected="{{val}}"

Handle "selected" attribute

*/

    var selects = [];
    var selectOptions = [];
    var selectOptionsContexts = [];
    // Currently updating? Initialized to true to avoid sync init
    var updating = true;

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(_dereq_('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        if (updating) {
          return;
        }
        if (node.nodeName === 'OPTION') {
          var i = selects.indexOf(node.parentNode);
          for (var j = 0, len = selectOptions[i].length; j < len; j++) {
            selectOptions[i][j].selected = selectOptionsContexts[i][j](prop);
          }
        }
        else {
          node.selected = model(prop);
        }
      }

      if (match && attr === 'selected') {
        // <select> option?
        if (node.nodeName === 'OPTION') {
          // Process async, as parentNode is still documentFragment
          setTimeout(function() {
            var i = selects.indexOf(node.parentNode);
            if (i === -1) {
              // Add <select> to list
              i = selects.push(node.parentNode) - 1;
              // Init options
              selectOptions.push([]);
              // Init options contexts
              selectOptionsContexts.push([]);
              // Attach change listener
              node.parentNode.addEventListener('change', function() {
                updating = true;
                for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
                  selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
                }
                updating = false;
              });
            }
            // Remember option and context
            selectOptions[i].push(node);
            selectOptionsContexts[i].push(model);
          }, 0);
        }
        else {
          node.addEventListener('change', function() {
            model(prop, this.selected);
          });
        }

        return {
          prop: prop,
          replace: '',
          change: change,
          asyncInit: function() {
            updating = false;
            model.trigger('change', prop);
          }
        };
      }
    }

},{"../consts":6}],19:[function(_dereq_,module,exports){
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

},{"../consts":6}],20:[function(_dereq_,module,exports){
/*

### value="{{val}}"

Handle "value" attribute

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(_dereq_('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        var val = model(prop);
        if (node[attr] !== val) {
          node[attr] = val || '';
        }
      }

      if (match && attr === 'value') {
        // text input?
        var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
          'keyup' : 'change'; // IE9 incorectly reports it supports input event

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

},{"../consts":6}],21:[function(_dereq_,module,exports){
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

},{"../consts":6}],22:[function(_dereq_,module,exports){
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

      var onload = function(event) {
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

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            onload.call(this, 'done');
          }
          else {
            console.log('jtmpl XHR error: ' + this.responseText);
          }
        }
      };

      xhr.open(args[0], args[1],
        (opts.async !== undefined ? opts.async : true),
        opts.user, opts.password);

      xhr.send(request);

      return xhr;

    };

},{}]},{},[10])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2VsZW1lbnQtY2xhc3MvaW5kZXguanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbXBpbGUtcnVsZXMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9jb21waWxlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9jb25zdHMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9jb250ZW50LWxvYWRlZC5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2RlZmF1bHQtb3B0aW9ucy5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2xvYWRlci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL21haW4uanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9wYXJzZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvY2hlY2tlZC12YXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9jbGFzcy1zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3BhcnRpYWwuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvc2VsZWN0ZWQtdmFyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdW5lc2NhcGVkLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3ZhbHVlLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3Zhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbn1cblxuZnVuY3Rpb24gRWxlbWVudENsYXNzKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEVsZW1lbnRDbGFzcykpIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG4gIHZhciBzZWxmID0gdGhpc1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuXG4gIC8vIHNpbWlsYXIgZG9pbmcgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCBidXQgd29ya3MgaW4gSUU4XG4gIGlmIChvcHRzLm5vZGVUeXBlKSBvcHRzID0ge2VsOiBvcHRzfVxuXG4gIHRoaXMub3B0cyA9IG9wdHNcbiAgdGhpcy5lbCA9IG9wdHMuZWwgfHwgZG9jdW1lbnQuYm9keVxuICBpZiAodHlwZW9mIHRoaXMuZWwgIT09ICdvYmplY3QnKSB0aGlzLmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLmVsKVxufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm4gZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgaWYgKGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTEpIHJldHVybiBjbGFzc2VzXG4gIGNsYXNzZXMucHVzaChjbGFzc05hbWUpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHZhciBpZHggPSBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKVxuICBpZiAoaWR4ID4gLTEpIGNsYXNzZXMuc3BsaWNlKGlkeCwgMSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICByZXR1cm4gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmcmVhayhvYmosIHJvb3QsIHBhcmVudCwgcHJvcCkge1xuXG4gIHZhciBsaXN0ZW5lcnMgPSB7XG4gICAgJ2NoYW5nZSc6IHt9LFxuICAgICd1cGRhdGUnOiB7fSxcbiAgICAnaW5zZXJ0Jzoge30sXG4gICAgJ2RlbGV0ZSc6IHt9XG4gIH07XG4gIHZhciBfZGVwZW5kZW50UHJvcHMgPSB7fTtcbiAgdmFyIF9kZXBlbmRlbnRDb250ZXh0cyA9IHt9O1xuICB2YXIgY2FjaGUgPSB7fTtcbiAgdmFyIGNoaWxkcmVuID0ge307XG5cbiAgLy8gQXNzZXJ0IGNvbmRpdGlvblxuICBmdW5jdGlvbiBhc3NlcnQoY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICB0aHJvdyBtc2cgfHwgJ2Fzc2VydGlvbiBmYWlsZWQnO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1peCBwcm9wZXJ0aWVzIGludG8gdGFyZ2V0XG4gIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BlcnRpZXMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W3Byb3BzW2ldXSA9IHByb3BlcnRpZXNbcHJvcHNbaV1dO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZXBFcXVhbCh4LCB5KSB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwgJiZcbiAgICAgICAgdHlwZW9mIHkgPT09IFwib2JqZWN0XCIgJiYgeSAhPT0gbnVsbCkge1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoeCkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyh5KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBwcm9wIGluIHgpIHtcbiAgICAgICAgaWYgKHguaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBpZiAoeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgaWYgKCFkZWVwRXF1YWwoeFtwcm9wXSwgeVtwcm9wXSkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHggIT09IHkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEV2ZW50IGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBvbigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSBbJ3N0cmluZycsICdudW1iZXInXS5pbmRleE9mKHR5cGVvZiBhcmd1bWVudHNbMV0pID4gLTEgP1xuICAgICAgYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG5cbiAgICAvLyBBcmdzIGNoZWNrXG4gICAgYXNzZXJ0KFsnY2hhbmdlJywgJ3VwZGF0ZScsICdpbnNlcnQnLCAnZGVsZXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSk7XG4gICAgYXNzZXJ0KFxuICAgICAgKFsnY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wICE9PSBudWxsKSB8fFxuICAgICAgKFsnaW5zZXJ0JywgJ2RlbGV0ZScsICd1cGRhdGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgPT09IG51bGwpXG4gICAgKTtcblxuICAgIC8vIEluaXQgbGlzdGVuZXJzIGZvciBwcm9wXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIC8vIEFscmVhZHkgcmVnaXN0ZXJlZD9cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCBvciBzcGVjaWZpZWQgbGlzdGVuZXJzIGdpdmVuIGV2ZW50IGFuZCBwcm9wZXJ0eVxuICBmdW5jdGlvbiBvZmYoKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcbiAgICB2YXIgaTtcblxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwcm9wZXJ0eSB3YXRjaGVycz9cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gUmVtb3ZlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICBpID0gbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgIGlmIChpID4gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH1cblxuICAvLyB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCdpbnNlcnQnIG9yICdkZWxldGUnLCBpbmRleCwgY291bnQpXG4gIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGEsIGIpIHtcbiAgICB2YXIgaGFuZGxlcnMgPSAobGlzdGVuZXJzW2V2ZW50XVtbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgPyBhIDogbnVsbF0gfHwgW10pO1xuICAgIHZhciBpLCBsZW4gPSBoYW5kbGVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBoYW5kbGVyc1tpXS5jYWxsKGluc3RhbmNlLCBhLCBiKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhwb3J0IG1vZGVsIHRvIEpTT04gc3RyaW5nXG4gIC8vIE5PVCBleHBvcnRlZDpcbiAgLy8gLSBwcm9wZXJ0aWVzIHN0YXJ0aW5nIHdpdGggXyAoUHl0aG9uIHByaXZhdGUgcHJvcGVydGllcyBjb252ZW50aW9uKVxuICAvLyAtIGNvbXB1dGVkIHByb3BlcnRpZXMgKGRlcml2ZWQgZnJvbSBub3JtYWwgcHJvcGVydGllcylcbiAgZnVuY3Rpb24gdG9KU09OKCkge1xuICAgIGZ1bmN0aW9uIGZpbHRlcihvYmopIHtcbiAgICAgIHZhciBrZXksIGZpbHRlcmVkID0gQXJyYXkuaXNBcnJheShvYmopID8gW10gOiB7fTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICBpZiAodHlwZW9mIG9ialtrZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmaWx0ZXIob2JqW2tleV0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvYmpba2V5XSAhPT0gJ2Z1bmN0aW9uJyAmJiBrZXlbMF0gIT09ICdfJykge1xuICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBvYmpba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbHRlcmVkO1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZmlsdGVyKG9iaikpO1xuICB9XG5cbiAgLy8gTG9hZCBtb2RlbCBmcm9tIEpTT04gc3RyaW5nIG9yIG9iamVjdFxuICBmdW5jdGlvbiBmcm9tSlNPTihkYXRhKSB7XG4gICAgdmFyIGtleTtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICB9XG4gICAgZm9yIChrZXkgaW4gZGF0YSkge1xuICAgICAgaW5zdGFuY2Uoa2V5LCBkYXRhW2tleV0pO1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywga2V5KTtcbiAgICB9XG4gICAgaW5zdGFuY2UubGVuID0gb2JqLmxlbmd0aDtcbiAgfVxuXG4gIC8vIFVwZGF0ZSBoYW5kbGVyOiByZWNhbGN1bGF0ZSBkZXBlbmRlbnQgcHJvcGVydGllcyxcbiAgLy8gdHJpZ2dlciBjaGFuZ2UgaWYgbmVjZXNzYXJ5XG4gIGZ1bmN0aW9uIHVwZGF0ZShwcm9wKSB7XG4gICAgaWYgKCFkZWVwRXF1YWwoY2FjaGVbcHJvcF0sIGdldChwcm9wLCBmdW5jdGlvbigpIHt9LCB0cnVlKSkpIHtcbiAgICAgIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApO1xuICAgIH1cblxuICAgIC8vIE5vdGlmeSBkZXBlbmRlbnRzXG4gICAgZm9yICh2YXIgaSA9IDAsIGRlcCA9IF9kZXBlbmRlbnRQcm9wc1twcm9wXSB8fCBbXSwgbGVuID0gZGVwLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBkZWxldGUgY2hpbGRyZW5bZGVwW2ldXTtcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0c1twcm9wXVtpXS50cmlnZ2VyKCd1cGRhdGUnLCBkZXBbaV0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5wYXJlbnQpIHtcbiAgICAgIC8vIE5vdGlmeSBjb21wdXRlZCBwcm9wZXJ0aWVzLCBkZXBlbmRpbmcgb24gcGFyZW50IG9iamVjdFxuICAgICAgaW5zdGFuY2UucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIGluc3RhbmNlLnByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByb3h5IHRoZSBhY2Nlc3NvciBmdW5jdGlvbiB0byByZWNvcmRcbiAgLy8gYWxsIGFjY2Vzc2VkIHByb3BlcnRpZXNcbiAgZnVuY3Rpb24gZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCkge1xuICAgIGZ1bmN0aW9uIHRyYWNrZXIoY29udGV4dCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKF9wcm9wLCBfYXJnKSB7XG4gICAgICAgIGlmICghY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdID0gW107XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5pbmRleE9mKHByb3ApID09PSAtMSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5wdXNoKHByb3ApO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dChfcHJvcCwgX2FyZywgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0cmFja2VyKGluc3RhbmNlKTtcbiAgICBjb25zdHJ1Y3QocmVzdWx0KTtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICByZXN1bHQucGFyZW50ID0gdHJhY2tlcihwYXJlbnQpO1xuICAgIH1cbiAgICByZXN1bHQucm9vdCA9IHRyYWNrZXIocm9vdCB8fCBpbnN0YW5jZSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNoYWxsb3cgY2xvbmUgYW4gb2JqZWN0XG4gIGZ1bmN0aW9uIHNoYWxsb3dDbG9uZShvYmopIHtcbiAgICB2YXIga2V5LCBjbG9uZTtcbiAgICBpZiAob2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICBjbG9uZSA9IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGNsb25lW2tleV0gPSBvYmpba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjbG9uZSA9IG9iajtcbiAgICB9XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG5cbiAgLy8gR2V0dGVyIGZvciBwcm9wLCBpZiBjYWxsYmFjayBpcyBnaXZlblxuICAvLyBjYW4gcmV0dXJuIGFzeW5jIHZhbHVlXG4gIGZ1bmN0aW9uIGdldChwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpIHtcbiAgICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YWwgPSB2YWwuY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgY2FsbGJhY2spO1xuICAgICAgaWYgKCFza2lwQ2FjaGluZykge1xuICAgICAgICBjYWNoZVtwcm9wXSA9ICh2YWwgPT09IHVuZGVmaW5lZCkgPyB2YWwgOiBzaGFsbG93Q2xvbmUodmFsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICBjYWNoZVtwcm9wXSA9IHZhbDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldHRlcihwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpIHtcbiAgICB2YXIgcmVzdWx0ID0gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZyk7XG5cbiAgICByZXR1cm4gcmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnID9cbiAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICBjaGlsZHJlbltwcm9wXSA/XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdIDpcbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gPSBmcmVhayhyZXN1bHQsIHJvb3QgfHwgaW5zdGFuY2UsIGluc3RhbmNlLCBwcm9wKSA6XG4gICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNldCBwcm9wIHRvIHZhbFxuICBmdW5jdGlvbiBzZXR0ZXIocHJvcCwgdmFsKSB7XG4gICAgdmFyIG9sZFZhbCA9IGdldChwcm9wKTtcblxuICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eSBzZXR0ZXJcbiAgICAgIG9ialtwcm9wXS5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCB2YWwpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFNpbXBsZSBwcm9wZXJ0eVxuICAgICAgb2JqW3Byb3BdID0gdmFsO1xuICAgICAgaWYgKHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgICBkZWxldGUgY2FjaGVbcHJvcF07XG4gICAgICAgIGRlbGV0ZSBjaGlsZHJlbltwcm9wXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob2xkVmFsICE9PSB2YWwpIHtcbiAgICAgIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZ1bmN0aW9uYWwgYWNjZXNzb3IsIHVuaWZ5IGdldHRlciBhbmQgc2V0dGVyXG4gIGZ1bmN0aW9uIGFjY2Vzc29yKHByb3AsIGFyZywgc2tpcENhY2hpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgZ2V0dGVyIDogc2V0dGVyXG4gICAgKShwcm9wLCBhcmcsIHNraXBDYWNoaW5nKTtcbiAgfVxuXG4gIC8vIEF0dGFjaCBpbnN0YW5jZSBtZW1iZXJzXG4gIGZ1bmN0aW9uIGNvbnN0cnVjdCh0YXJnZXQpIHtcbiAgICBtaXhpbih0YXJnZXQsIHtcbiAgICAgIHZhbHVlczogb2JqLFxuICAgICAgcGFyZW50OiBwYXJlbnQgfHwgbnVsbCxcbiAgICAgIHJvb3Q6IHJvb3QgfHwgdGFyZ2V0LFxuICAgICAgcHJvcDogcHJvcCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHByb3AsXG4gICAgICAvLyAub24oZXZlbnRbLCBwcm9wXSwgY2FsbGJhY2spXG4gICAgICBvbjogb24sXG4gICAgICAvLyAub2ZmKGV2ZW50WywgcHJvcF1bLCBjYWxsYmFja10pXG4gICAgICBvZmY6IG9mZixcbiAgICAgIC8vIC50cmlnZ2VyKGV2ZW50WywgcHJvcF0pXG4gICAgICB0cmlnZ2VyOiB0cmlnZ2VyLFxuICAgICAgdG9KU09OOiB0b0pTT04sXG4gICAgICAvLyBEZXByZWNhdGVkLiBJdCBoYXMgYWx3YXlzIGJlZW4gYnJva2VuLCBhbnl3YXlcbiAgICAgIC8vIFdpbGwgdGhpbmsgaG93IHRvIGltcGxlbWVudCBwcm9wZXJseVxuICAgICAgZnJvbUpTT046IGZyb21KU09OLFxuICAgICAgLy8gSW50ZXJuYWw6IGRlcGVuZGVuY3kgdHJhY2tpbmdcbiAgICAgIF9kZXBlbmRlbnRQcm9wczogX2RlcGVuZGVudFByb3BzLFxuICAgICAgX2RlcGVuZGVudENvbnRleHRzOiBfZGVwZW5kZW50Q29udGV4dHNcbiAgICB9KTtcblxuICAgIC8vIFdyYXAgbXV0YXRpbmcgYXJyYXkgbWV0aG9kIHRvIHVwZGF0ZVxuICAgIC8vIHN0YXRlIGFuZCBub3RpZnkgbGlzdGVuZXJzXG4gICAgZnVuY3Rpb24gd3JhcEFycmF5TWV0aG9kKG1ldGhvZCwgZnVuYykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW11bbWV0aG9kXS5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMubGVuID0gdGhpcy52YWx1ZXMubGVuZ3RoO1xuICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICBjaGlsZHJlbiA9IHt9O1xuICAgICAgICBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIHRhcmdldC5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgdGFyZ2V0LnByb3ApO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICBtaXhpbih0YXJnZXQsIHtcbiAgICAgICAgLy8gRnVuY3Rpb24gcHJvdG90eXBlIGFscmVhZHkgY29udGFpbnMgbGVuZ3RoXG4gICAgICAgIC8vIGBsZW5gIHNwZWNpZmllcyBhcnJheSBsZW5ndGhcbiAgICAgICAgbGVuOiBvYmoubGVuZ3RoLFxuXG4gICAgICAgIHBvcDogd3JhcEFycmF5TWV0aG9kKCdwb3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCB0aGlzLmxlbiwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHB1c2g6IHdyYXBBcnJheU1ldGhvZCgncHVzaCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIHRoaXMubGVuIC0gMSwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHJldmVyc2U6IHdyYXBBcnJheU1ldGhvZCgncmV2ZXJzZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3NoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHVuc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgndW5zaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBzb3J0OiB3cmFwQXJyYXlNZXRob2QoJ3NvcnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzcGxpY2U6IHdyYXBBcnJheU1ldGhvZCgnc3BsaWNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSkge1xuICAgICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzLmxlbmd0aCAtIDIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb24oJ3VwZGF0ZScsIHVwZGF0ZSk7XG5cbiAgLy8gQ3JlYXRlIGZyZWFrIGluc3RhbmNlXG4gIHZhciBpbnN0YW5jZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBhY2Nlc3Nvci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIEF0dGFjaCBpbnN0YW5jZSBtZW1iZXJzXG4gIGNvbnN0cnVjdChpbnN0YW5jZSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDb21tb25KUyBleHBvcnRcbmlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JykgbW9kdWxlLmV4cG9ydHMgPSBmcmVhaztcbiIsIi8qKlxuICogUnVsZXNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgYXR0cjogW1xuXG4gICAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuXG4gICAgfVxuICBdLFxuXG4gIG5vZGU6IFtcblxuICAgIC8qKlxuICAgICAqIHt7dmFyfX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbihub2RlKSB7XG4gICAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goL1tcXHdcXC5cXC1dKy8pKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG5vZGUsIG1vZGVsKSB7XG4gICAgICAgICAgICB2YXIgcHJvcCA9IG5vZGUuaW5uZXJIVE1MO1xuICAgICAgICAgICAgdmFyIHRleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobW9kZWwocHJvcCkpO1xuICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB0ZXh0Tm9kZS5kYXRhID0gbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRleHROb2RlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gIF1cbn07XG4iLCIvKipcbiAqIENvbXBpbGUgYSB0ZW1wbGF0ZSwgcGFyc2VkIGJ5IEBzZWUgcGFyc2VcbiAqXG4gKiBAcGFyYW0ge2RvY3VtZW50RnJhZ21lbnR9IHRlbXBsYXRlXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBGdW5jdGlvbiBib2R5LCBhY2NlcHRpbmcgRnJlYWsgaW5zdGFuY2UgcGFyYW1ldGVyLCBzdWl0YWJsZSBmb3IgZXZhbCgpXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUpIHtcblxuICAvLyBDb21waWxlIHJ1bGVzLCBmb3IgYXR0cmlidXRlcyBhbmQgbm9kZXNcbiAgdmFyIGNvbXBpbGVSdWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcycpO1xuICB2YXIgbWF0Y2g7XG5cbiAgLy8gR2VuZXJhdGUgZHluYW1pYyBmdW5jdGlvbiBib2R5XG4gIHZhciBmdW5jID0gJyhmdW5jdGlvbihtb2RlbCkgeycgK1xuICAgICd2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSwgbm9kZTsnO1xuXG5cbiAgLy8gSXRlcmF0ZSBjaGlsZE5vZGVzXG4gIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGgsIG5vZGU7XG4gICAgICAgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcblxuICAgIHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXG4gICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgIGNhc2UgMTpcblxuICAgICAgICAvLyBqdG1wbCB0YWc/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnU0NSSVBUJyAmJiBub2RlLnR5cGUgPT09ICd0ZXh0L2p0bXBsLXRhZycpIHtcblxuICAgICAgICAgIGZvciAodmFyIHJpID0gMCwgcnVsZXMgPSBjb21waWxlUnVsZXMubm9kZSwgcmxlbiA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgcmkgPCBybGVuOyByaSsrKSB7XG4gICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlKTtcblxuICAgICAgICAgICAgLy8gUnVsZSBmb3VuZD9cbiAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgIC8vIFNraXAgcmVtYWluaW5nIHJ1bGVzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFJFTU9WRU1FTEFURVJcbiAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICBmdW5jICs9ICdub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJBQUFBQUFBQUFBXCIpOyc7XG4gICAgICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKG5vZGUpOyc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGVsZW1lbnRcbiAgICAgICAgICBmdW5jICs9ICdub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIicgKyBub2RlLm5vZGVOYW1lICsgJ1wiKTsnO1xuXG4gICAgICAgICAgLy8gQ2xvbmUgYXR0cmlidXRlc1xuICAgICAgICAgIGZvciAodmFyIGFpID0gMCwgYXR0cmlidXRlcyA9IG5vZGUuYXR0cmlidXRlcywgYWxlbiA9IGF0dHJpYnV0ZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgYWkgPCBhbGVuOyBhaSsrKSB7XG4gICAgICAgICAgICAgICAgIGZ1bmMgKz0gJ25vZGUuc2V0QXR0cmlidXRlKFwiJyArXG4gICAgICAgICAgICAgICAgICAgYXR0cmlidXRlc1thaV0ubmFtZSArXG4gICAgICAgICAgICAgICAgICAgJ1wiLCAnICtcbiAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShhdHRyaWJ1dGVzW2FpXS52YWx1ZSkgK1xuICAgICAgICAgICAgICAgICAgICcpOyc7XG4gICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgZnVuYyArPSAnbm9kZS5hcHBlbmRDaGlsZCgnICsgY29tcGlsZShub2RlLCBtb2RlbCkgKyAnKCkpOyc7XG5cbiAgICAgICAgICAvLyBBcHBlbmQgdG8gZnJhZ21lbnRcbiAgICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKG5vZGUpOyc7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcblxuXG4gICAgICAvLyBUZXh0IG5vZGVcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpOyc7XG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgY2FzZSA4OlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobm9kZS5kYXRhKSArICcpKTsnO1xuICAgICAgICBicmVhaztcblxuICAgIH0gLy8gZW5kIHN3aXRjaFxuICB9IC8vIGVuZCBpdGVyYXRlIGNoaWxkTm9kZXNcblxuICBmdW5jICs9ICdyZXR1cm4gZnJhZzsgfSknO1xuXG4gIHJldHVybiBmdW5jO1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjb21waWxlO1xuIiwiLypcblxuIyMgQ29tcGlsZXJcblxuKi9cblxuXG4vKlxuXG4jIyMgY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSlcblxuUmV0dXJuIGRvY3VtZW50RnJhZ21lbnRcblxuKi9cblxuXG4gICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG4gICAgdmFyIHJlRW5kQmxvY2s7XG5cbiAgICAvLyBVdGlsaXR5IGZ1bmN0aW9uc1xuXG4gICAgZnVuY3Rpb24gZXNjYXBlUkUocykge1xuICAgICAgcmV0dXJuIChzICsgJycpLnJlcGxhY2UoLyhbLj8qK14kW1xcXVxcXFwoKXt9fC1dKS9nLCAnXFxcXCQxJyk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiB0b2tlbml6ZXIob3B0aW9ucywgZmxhZ3MpIHtcbiAgICAgIHJldHVybiBSZWdFeHAoXG4gICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgK1xuICAgICAgICAnKCcgKyBjb25zdHMuUkVfQU5ZVEhJTkcgKyAnKScgK1xuICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMV0pLFxuICAgICAgICBmbGFnc1xuICAgICAgKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIG1hdGNoUnVsZXModGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGksIG1hdGNoO1xuICAgICAgdmFyIHJ1bGVzID0gcmVxdWlyZSgnLi9ydWxlcycpO1xuICAgICAgdmFyIHJ1bGVzTGVuID0gcnVsZXMubGVuZ3RoO1xuXG4gICAgICAvLyBTdHJpcCBkZWxpbWl0ZXJzXG4gICAgICB0YWcgPSB0YWcuc2xpY2Uob3B0aW9ucy5kZWxpbWl0ZXJzWzBdLmxlbmd0aCwgLW9wdGlvbnMuZGVsaW1pdGVyc1sxXS5sZW5ndGgpO1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgcnVsZXNMZW47IGkrKykge1xuICAgICAgICBtYXRjaCA9IHJ1bGVzW2ldKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIG1hdGNoLmluZGV4ID0gaTtcbiAgICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIHByZXByb2Nlc3ModGVtcGxhdGUsIG9wdGlvbnMpIHtcbiAgICAgIC8vIHJlcGxhY2Uge3t7dGFnfX19IHdpdGgge3smdGFnfX1cbiAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgUmVnRXhwKFxuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICd7JykgK1xuICAgICAgICAgIGNvbnN0cy5SRV9TUkNfSURFTlRJRklFUiArXG4gICAgICAgICAgZXNjYXBlUkUoJ30nICsgb3B0aW9ucy5kZWxpbWl0ZXJzWzFdKSxcbiAgICAgICAgICAnZydcbiAgICAgICAgKSxcbiAgICAgICAgb3B0aW9ucy5kZWxpbWl0ZXJzWzBdICsgJyYkMScgKyBvcHRpb25zLmRlbGltaXRlcnNbMV1cbiAgICAgICk7XG4gICAgICAvLyAxLiB3cmFwIGVhY2ggbm9uLWF0dHJpYnV0ZSB0YWdcbiAgICAgIC8vICh0aGF0J3Mgbm90IGluc2lkZSA8c2VsZWN0PiAoZnVjayB5b3UsIElFKSkgaW4gSFRNTCBjb21tZW50XG4gICAgICAvLyAyLiByZW1vdmUgTXVzdGFjaGUgY29tbWVudHNcbiAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgdG9rZW5pemVyKG9wdGlvbnMsICdnJyksXG4gICAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgICB2YXIgaW5zaWRlVGFnID0gISFoZWFkLm1hdGNoKFJlZ0V4cCgnPCcgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnW14+XSo/JCcpKTtcbiAgICAgICAgICB2YXIgb3BlbmluZyA9IGhlYWQubWF0Y2goLzwoc2VsZWN0fFNFTEVDVCkvZyk7XG4gICAgICAgICAgdmFyIGNsb3NpbmcgPSBoZWFkLm1hdGNoKC88XFwvKHNlbGVjdHxTRUxFQ1QpL2cpO1xuICAgICAgICAgIHZhciBpbnNpZGVTZWxlY3QgPVxuICAgICAgICAgICAgICAob3BlbmluZyAmJiBvcGVuaW5nLmxlbmd0aCB8fCAwKSA+IChjbG9zaW5nICYmIGNsb3NpbmcubGVuZ3RoIHx8IDApO1xuICAgICAgICAgIHZhciBpbnNpZGVDb21tZW50ID0gISFoZWFkLm1hdGNoKC88IS0tXFxzKiQvKTtcbiAgICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgICAgcmV0dXJuIGluc2lkZVRhZyB8fCBpbnNpZGVDb21tZW50ID9cbiAgICAgICAgICAgIGlzTXVzdGFjaGVDb21tZW50ID9cbiAgICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICBpbnNpZGVTZWxlY3QgP1xuICAgICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICAgICc8IS0tJyArIG1hdGNoICsgJy0tPic7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICAvLyBwcmVmaXggJ3NlbGVjdGVkJyBhbmQgJ2NoZWNrZWQnIGF0dHJpYnV0ZXMgd2l0aCAnanRtcGwtJ1xuICAgICAgLy8gKHRvIGF2b2lkIFwic3BlY2lhbFwiIHByb2Nlc3NpbmcsIG9oIElFOClcbiAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgLyg8KD86b3B0aW9ufE9QVElPTilbXj5dKj8pKD86c2VsZWN0ZWR8U0VMRUNURUQpPS9nLFxuICAgICAgICAnJDFqdG1wbC1zZWxlY3RlZD0nKTtcblxuICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgICAvKDwoPzppbnB1dHxJTlBVVClbXj5dKj8pKD86Y2hlY2tlZHxDSEVDS0VEKT0vZyxcbiAgICAgICAgJyQxanRtcGwtY2hlY2tlZD0nKTtcblxuICAgICAgcmV0dXJuIHRlbXBsYXRlO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gbWF0Y2hFbmRCbG9jayhibG9jaywgdGVtcGxhdGUsIG9wdGlvbnMpIHtcbiAgICAgIGlmICghcmVFbmRCbG9jaykge1xuICAgICAgICByZUVuZEJsb2NrID0gUmVnRXhwKFxuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgK1xuICAgICAgICAgICdcXFxcLycgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnPycgK1xuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1sxXSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHZhciBtYXRjaCA9IHRlbXBsYXRlLm1hdGNoKHJlRW5kQmxvY2spO1xuICAgICAgcmV0dXJuIG1hdGNoID9cbiAgICAgICAgYmxvY2sgPT09ICcnIHx8ICFtYXRjaFsxXSB8fCBtYXRjaFsxXSA9PT0gYmxvY2sgOlxuICAgICAgICBmYWxzZTtcbiAgICB9XG5cblxuXG5cbiAgICB2YXIgdGVtcGxhdGVDYWNoZSA9IFtdO1xuICAgIHZhciBuZXdDb3VudGVyID0gMDtcbiAgICB2YXIgY2FjaGVIaXRDb3VudGVyID0gMDtcblxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCwgb3B0aW9ucykge1xuXG4gICAgICAvLyBWYXJpYWJsZXNcblxuICAgICAgdmFyIGksIGNoaWxkcmVuLCBsZW4sIGFpLCBhbGVuLCBhdHRyLCB2YWwsIGF0dHJSdWxlcywgcmksIGF0dHJOYW1lLCBhdHRyVmFsO1xuICAgICAgdmFyIGJ1ZmZlciwgcG9zLCBiZWdpblBvcywgYm9keUJlZ2luUG9zLCBib2R5LCBub2RlLCBlbCwgY29udGVudHMsIHQsIG1hdGNoLCBydWxlLCB0b2tlbiwgYmxvY2s7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIGZyYWc7XG4gICAgICB2YXIgZnJlYWsgPSByZXF1aXJlKCdmcmVhaycpO1xuICAgICAgdmFyIGlmcmFtZTtcblxuICAgICAgLy8gSW5pdFxuXG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCByZXF1aXJlKCcuL2RlZmF1bHQtb3B0aW9ucycpO1xuXG4gICAgICBtb2RlbCA9XG4gICAgICAgIHR5cGVvZiBtb2RlbCA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgLy8gRnJlYWsgaW5zdGFuY2VcbiAgICAgICAgICBtb2RlbCA6XG4gICAgICAgICAgdHlwZW9mIG1vZGVsID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAvLyBXcmFwIG9iamVjdFxuICAgICAgICAgICAgZnJlYWsobW9kZWwpIDpcbiAgICAgICAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgICAgICAgZnJlYWsoeycuJzogbW9kZWx9KTtcblxuICAgICAgLy8gVGVtcGxhdGUgY2FuIGJlIGEgc3RyaW5nIG9yIERPTSBzdHJ1Y3R1cmVcbiAgICAgIGlmICh0ZW1wbGF0ZS5ub2RlVHlwZSkge1xuICAgICAgICBib2R5ID0gdGVtcGxhdGU7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnY29tcGlsZXI6IElGUkFNRSBjb25zdHJ1Y3Rpb24nKTtcbiAgICAgICAgdGVtcGxhdGUgPSBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKTtcbiAgICAgICAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgICAgIGlmcmFtZS5jb250ZW50RG9jdW1lbnQud3JpdGVsbignPCFkb2N0eXBlIGh0bWw+XFxuPGh0bWw+PGJvZHk+JyArIHRlbXBsYXRlICsgJzwvYm9keT48L2h0bWw+Jyk7XG4gICAgICAgIGJvZHkgPSBpZnJhbWUuY29udGVudERvY3VtZW50LmJvZHk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRlbXBsYXRlQ2FjaGUuaW5kZXhPZihib2R5KSA9PT0gLTEpIHtcbiAgICAgICAgbmV3Q291bnRlcisrO1xuICAgICAgICB0ZW1wbGF0ZUNhY2hlLnB1c2goYm9keSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2FjaGVIaXRDb3VudGVyKys7XG4gICAgICB9XG5cbiAgICAgIC8vIEl0ZXJhdGUgY2hpbGQgbm9kZXMuXG4gICAgICBmb3IgKGkgPSAwLCBjaGlsZHJlbiA9IGJvZHkuY2hpbGROb2RlcywgbGVuID0gY2hpbGRyZW4ubGVuZ3RoIDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgbm9kZSA9IGNoaWxkcmVuW2ldO1xuXG4gICAgICAgIC8vIFNoYWxsb3cgY29weSBvZiBub2RlIGFuZCBhdHRyaWJ1dGVzIChpZiBlbGVtZW50KVxuICAgICAgICBlbCA9IG5vZGUuY2xvbmVOb2RlKGZhbHNlKTtcblxuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbCk7XG5cbiAgICAgICAgc3dpdGNoIChlbC5ub2RlVHlwZSkge1xuXG4gICAgICAgICAgLy8gRWxlbWVudCBub2RlXG4gICAgICAgICAgY2FzZSAxOlxuXG4gICAgICAgICAgICAvLyBSZW1lbWJlciBtb2RlbFxuICAgICAgICAgICAgZWwuX19qdG1wbF9fID0gbW9kZWw7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGZvciAoYWkgPSAwLCBhbGVuID0gZWwuYXR0cmlidXRlcy5sZW5ndGg7IGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICAgIGF0dHIgPSBlbC5hdHRyaWJ1dGVzW2FpXTtcbiAgICAgICAgICAgICAgYXR0clJ1bGVzID0gW107XG4gICAgICAgICAgICAgIC8vIFVucHJlZml4ICdqdG1wbC0nIGZyb20gYXR0cmlidXRlIG5hbWUsIGlmIG5lZWRlZFxuICAgICAgICAgICAgICBhdHRyTmFtZSA9IGF0dHIubmFtZS5sYXN0SW5kZXhPZignanRtcGwtJywgMCkgPT09IDAgP1xuICAgICAgICAgICAgICAgIGF0dHIubmFtZS5zbGljZSgnanRtcGwtJy5sZW5ndGgpIDogYXR0ci5uYW1lO1xuICAgICAgICAgICAgICBhdHRyVmFsID0gJyc7XG4gICAgICAgICAgICAgIHZhbCA9IGF0dHIudmFsdWU7XG4gICAgICAgICAgICAgIHQgPSB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoIChtYXRjaCA9IHQuZXhlYyh2YWwpKSApIHtcblxuICAgICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKG1hdGNoWzBdLCBlbCwgYXR0ck5hbWUudG9Mb3dlckNhc2UoKSwgbW9kZWwsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUpIHtcblxuICAgICAgICAgICAgICAgICAgYXR0clJ1bGVzLnB1c2gocnVsZSk7XG5cbiAgICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2sgPSBtYXRjaFswXTtcbiAgICAgICAgICAgICAgICAgICAgYmVnaW5Qb3MgPSBtYXRjaC5pbmRleDtcbiAgICAgICAgICAgICAgICAgICAgYm9keUJlZ2luUG9zID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBjbG9zaW5nIHRhZ1xuICAgICAgICAgICAgICAgICAgICBmb3IgKDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAhbWF0Y2hFbmRCbG9jayhydWxlLmJsb2NrLCBtYXRjaFswXSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IHQuZXhlYyh2YWwpKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1VuY2xvc2VkJyArIGJsb2NrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgZnVsbCBibG9jayB0YWcgYm9keSB3aXRoIHJ1bGUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICBhdHRyVmFsICs9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwuc2xpY2UoMCwgYmVnaW5Qb3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGUucmVwbGFjZShhdHRyLnZhbHVlLnNsaWNlKGJvZHlCZWdpblBvcywgbWF0Y2guaW5kZXgpKSArXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwuc2xpY2UobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmICghcnVsZS5ibG9jayAmJiBydWxlLnJlcGxhY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBhdHRyLnZhbHVlID0gcnVsZS5yZXBsYWNlO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAocnVsZS5hc3luY0luaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChydWxlLmFzeW5jSW5pdCwgMCk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBTZXQgbmV3IGF0dHJpYnV0ZSB2YWx1ZVxuICAgICAgICAgICAgICAvL2F0dHJWYWwgPSBhdHRyVmFsIHx8IGF0dHIudmFsdWU7XG4gICAgICAgICAgICAgIC8vZWwuc2V0QXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsKTtcblxuICAgICAgICAgICAgICAvLyBBdHRhY2ggYXR0cmlidXRlIGxpc3RlbmVycyBhbmQgdHJpZ2dlciBpbml0aWFsIGNoYW5nZVxuICAgICAgICAgICAgICBmb3IgKHJpID0gMDsgcmkgPCBhdHRyUnVsZXMubGVuZ3RoOyByaSsrKSB7XG4gICAgICAgICAgICAgICAgcnVsZSA9IGF0dHJSdWxlc1tyaV07XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUuY2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcnVsZS5ibG9jayB8fCBydWxlLnByb3AsIHJ1bGUuY2hhbmdlKTtcbiAgICAgICAgICAgICAgICAgIHJ1bGUuY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgJ2p0bXBsLSctcHJlZml4ZWQgYXR0cmlidXRlc1xuICAgICAgICAgICAgYWkgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGFpIDwgZWwuYXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgYXR0ciA9IGVsLmF0dHJpYnV0ZXNbYWldO1xuICAgICAgICAgICAgICBpZiAoYXR0ci5uYW1lLmxhc3RJbmRleE9mKCdqdG1wbC0nLCAwKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyLm5hbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGFpKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVjdXJzaXZlbHkgY29tcGlsZVxuICAgICAgICAgICAgZnJhZyA9IGNvbXBpbGUobm9kZSwgbW9kZWwsIG9wdGlvbnMpO1xuICAgICAgICAgICAgaWYgKGZyYWcuY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoZnJhZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gVGV4dCBub2RlXG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgODpcbiAgICAgICAgICAgIGNvbnRlbnRzID0gZWwuZGF0YS50cmltKCk7XG5cbiAgICAgICAgICAgIGlmIChtYXRjaEVuZEJsb2NrKCcnLCBjb250ZW50cywgb3B0aW9ucykpIHtcbiAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmV4cGVjdGVkICcgKyBjb250ZW50cztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCAobWF0Y2ggPSBjb250ZW50cy5tYXRjaCh0b2tlbml6ZXIob3B0aW9ucykpKSApIHtcblxuICAgICAgICAgICAgICBydWxlID0gbWF0Y2hSdWxlcyhjb250ZW50cywgbm9kZSwgbnVsbCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBpZiAocnVsZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gRE9NIHJlcGxhY2VtZW50P1xuICAgICAgICAgICAgICAgIGlmIChydWxlLnJlcGxhY2Uubm9kZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHJ1bGUucmVwbGFjZSwgZWwpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEZldGNoIGJsb2NrIHRhZyBjb250ZW50cz9cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgICBibG9jayA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICAgICAgZm9yIChpKys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAoaSA8IGxlbikgJiZcbiAgICAgICAgICAgICAgICAgICAgICAhbWF0Y2hFbmRCbG9jayhydWxlLmJsb2NrLCBjaGlsZHJlbltpXS5kYXRhIHx8ICcnLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgICAgICAgICAgIGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrLmFwcGVuZENoaWxkKGNoaWxkcmVuW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChpID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgY29udGVudHM7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUmVwbGFjZSBgZWxgIHdpdGggYHJ1bGUucmVwbGFjZSgpYCByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlKGJsb2NrLCBlbC5wYXJlbnROb2RlKSwgZWwpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChydWxlLnByb3AgJiYgcnVsZS5jaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBydWxlLnByb3AsIHJ1bGUuY2hhbmdlKTtcbiAgICAgICAgICAgICAgICAgIHJ1bGUuY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICB9IC8vIHN3aXRjaFxuXG4gICAgICB9IC8vIGZvclxuXG4gICAgIC8vY29uc29sZS5sb2coJ25ld0NvdW50ZXI6ICcgKyBuZXdDb3VudGVyKTtcbiAgICAgLy9jb25zb2xlLmxvZygnY2FjaGVIaXRDb3VudGVyOiAnICsgY2FjaGVIaXRDb3VudGVyKTtcbiAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICB9O1xuIiwiLypcblxuIyMgQ29uc3RhbnRzXG5cbiovXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgUkVfSURFTlRJRklFUjogL15bXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX1NSQ19JREVOVElGSUVSOiAnKFtcXFxcd1xcXFwuXFxcXC1dKyknLFxuXG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3ViZS1xdW90ZWRcIlxuICAgIFJFX1BBUlRJQUw6IC8+KFtcXHdcXC5cXC1dKyl8JyhbXlxcJ10qKVxcJ3xcIihbXlwiXSopXCIvLFxuXG4gICAgUkVfUElQRTogL15bXFx3XFwuXFwtXSsoPzpcXHxbXFx3XFwuXFwtXSspPyQvLFxuXG4gICAgUkVfTk9ERV9JRDogL14jW1xcd1xcLlxcLV0rJC8sXG5cbiAgICBSRV9FTkRTX1dJVEhfTk9ERV9JRDogLy4rKCNbXFx3XFwuXFwtXSspJC8sXG5cbiAgICBSRV9BTllUSElORzogJ1tcXFxcc1xcXFxTXSo/JyxcblxuICAgIFJFX1NQQUNFOiAnXFxcXHMqJ1xuXG4gIH07XG4iLCIvKiFcbiAqIGNvbnRlbnRsb2FkZWQuanNcbiAqXG4gKiBBdXRob3I6IERpZWdvIFBlcmluaSAoZGllZ28ucGVyaW5pIGF0IGdtYWlsLmNvbSlcbiAqIFN1bW1hcnk6IGNyb3NzLWJyb3dzZXIgd3JhcHBlciBmb3IgRE9NQ29udGVudExvYWRlZFxuICogVXBkYXRlZDogMjAxMDEwMjBcbiAqIExpY2Vuc2U6IE1JVFxuICogVmVyc2lvbjogMS4yXG4gKlxuICogVVJMOlxuICogaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL0NvbnRlbnRMb2FkZWQvXG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9NSVQtTElDRU5TRVxuICpcbiAqL1xuXG4vLyBAd2luIHdpbmRvdyByZWZlcmVuY2Vcbi8vIEBmbiBmdW5jdGlvbiByZWZlcmVuY2Vcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29udGVudExvYWRlZCh3aW4sIGZuKSB7XG5cblx0dmFyIGRvbmUgPSBmYWxzZSwgdG9wID0gdHJ1ZSxcblxuXHRkb2MgPSB3aW4uZG9jdW1lbnQsXG5cdHJvb3QgPSBkb2MuZG9jdW1lbnRFbGVtZW50LFxuXHRtb2Rlcm4gPSBkb2MuYWRkRXZlbnRMaXN0ZW5lcixcblxuXHRhZGQgPSBtb2Rlcm4gPyAnYWRkRXZlbnRMaXN0ZW5lcicgOiAnYXR0YWNoRXZlbnQnLFxuXHRyZW0gPSBtb2Rlcm4gPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnZGV0YWNoRXZlbnQnLFxuXHRwcmUgPSBtb2Rlcm4gPyAnJyA6ICdvbicsXG5cblx0aW5pdCA9IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS50eXBlID09ICdyZWFkeXN0YXRlY2hhbmdlJyAmJiBkb2MucmVhZHlTdGF0ZSAhPSAnY29tcGxldGUnKSByZXR1cm47XG5cdFx0KGUudHlwZSA9PSAnbG9hZCcgPyB3aW4gOiBkb2MpW3JlbV0ocHJlICsgZS50eXBlLCBpbml0LCBmYWxzZSk7XG5cdFx0aWYgKCFkb25lICYmIChkb25lID0gdHJ1ZSkpIGZuLmNhbGwod2luLCBlLnR5cGUgfHwgZSk7XG5cdH0sXG5cblx0cG9sbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRyeSB7IHJvb3QuZG9TY3JvbGwoJ2xlZnQnKTsgfSBjYXRjaChlKSB7IHNldFRpbWVvdXQocG9sbCwgNTApOyByZXR1cm47IH1cblx0XHRpbml0KCdwb2xsJyk7XG5cdH07XG5cblx0aWYgKGRvYy5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpIGZuLmNhbGwod2luLCAnbGF6eScpO1xuXHRlbHNlIHtcblx0XHRpZiAoIW1vZGVybiAmJiByb290LmRvU2Nyb2xsKSB7XG5cdFx0XHR0cnkgeyB0b3AgPSAhd2luLmZyYW1lRWxlbWVudDsgfSBjYXRjaChlKSB7IH1cblx0XHRcdGlmICh0b3ApIHBvbGwoKTtcblx0XHR9XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0LCBmYWxzZSk7XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ3JlYWR5c3RhdGVjaGFuZ2UnLCBpbml0LCBmYWxzZSk7XG5cdFx0d2luW2FkZF0ocHJlICsgJ2xvYWQnLCBpbml0LCBmYWxzZSk7XG5cdH1cblxufTtcbiIsIi8qXG4gIFxuRGVmYXVsdCBvcHRpb25zXG5cbiovXG4gICAgXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICBkZWxpbWl0ZXJzOiBbJ3t7JywgJ319J11cbiAgICB9O1xuIiwiLypcblxuRXZhbHVhdGUgb2JqZWN0IGZyb20gbGl0ZXJhbCBvciBDb21tb25KUyBtb2R1bGVcblxuKi9cblxuICAgIC8qIGpzaGludCBldmlsOnRydWUgKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgc3JjLCBtb2RlbCkge1xuXG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgICAgbW9kZWwgPSBtb2RlbCB8fCB7fTtcbiAgICAgIGlmICh0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbW9kZWwgPSBqdG1wbChtb2RlbCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICBpZiAoLy8gUGx1Z2luXG4gICAgICAgICAgICAgIChwcm9wLmluZGV4T2YoJ19fJykgPT09IDAgJiZcbiAgICAgICAgICAgICAgICBwcm9wLmxhc3RJbmRleE9mKCdfXycpID09PSBwcm9wLmxlbmd0aCAtIDIpIHx8XG4gICAgICAgICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICAgICAgICAgIHR5cGVvZiBwcm9wZXJ0aWVzW3Byb3BdID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnZhbHVlc1twcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldC52YWx1ZXNbcHJvcF0gPSBwcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRhcmdldCBkb2Vzbid0IGFscmVhZHkgaGF2ZSBwcm9wP1xuICAgICAgICAgICAgaWYgKHRhcmdldChwcm9wKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldChwcm9wLCBwcm9wZXJ0aWVzW3Byb3BdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYXBwbHlQbHVnaW5zKCkge1xuICAgICAgICB2YXIgcHJvcCwgYXJnO1xuICAgICAgICBmb3IgKHByb3AgaW4ganRtcGwucGx1Z2lucykge1xuICAgICAgICAgIHBsdWdpbiA9IGp0bXBsLnBsdWdpbnNbcHJvcF07XG4gICAgICAgICAgYXJnID0gbW9kZWwudmFsdWVzWydfXycgKyBwcm9wICsgJ19fJ107XG4gICAgICAgICAgaWYgKHR5cGVvZiBwbHVnaW4gPT09ICdmdW5jdGlvbicgJiYgYXJnICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBsdWdpbi5jYWxsKG1vZGVsLCBhcmcsIHRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGV2YWxPYmplY3QoYm9keSwgc3JjKSB7XG4gICAgICAgIHZhciByZXN1bHQsIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcbiAgICAgICAgc3JjID0gc3JjID9cbiAgICAgICAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc3JjICtcbiAgICAgICAgICAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc3JjIDpcbiAgICAgICAgICAnJztcbiAgICAgICAgaWYgKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSB7XG4gICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgIHJldHVybiBldmFsKCdyZXN1bHQ9JyArIGJvZHkgKyBzcmMpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICBldmFsKGJvZHkgKyBzcmMpO1xuICAgICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIEVsZW1lbnQgaW4gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jLnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChlbGVtZW50LmlubmVySFRNTCwgc3JjKSk7XG4gICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGhhc2hJbmRleCA9IHNyYy5pbmRleE9mKCcjJyk7XG4gICAgICAgICAgLy8gR2V0IG1vZGVsIHZpYSBYSFJcbiAgICAgICAgICAvLyBPbGRlciBJRXMgY29tcGxhaW4gaWYgVVJMIGNvbnRhaW5zIGhhc2hcbiAgICAgICAgICBqdG1wbCgnR0VUJywgaGFzaEluZGV4ID4gLTEgPyBzcmMuc3Vic3RyaW5nKDAsIGhhc2hJbmRleCkgOiBzcmMsXG4gICAgICAgICAgICBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAgICAgICAucGFyc2VGcm9tU3RyaW5nKHJlc3AsICd0ZXh0L2h0bWwnKVxuICAgICAgICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QobWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsIHNyYykpO1xuICAgICAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKCkge1xuICAgICAgICB2YXIgaGFzaEluZGV4O1xuXG4gICAgICAgIGlmICghc3JjKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHNyYy5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSBpcyB0aGUgY29udGVudHMgb2YgZWxlbWVudFxuICAgICAgICAgIC8vIGJlbG9uZ2luZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbG9hZE1vZGVsKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJyksIGVsZW1lbnQuaW5uZXJIVE1MLCBkb2N1bWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgdGVtcGxhdGUgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGNvbnN0cy5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICAgIHZhciBpZnJhbWUsIGRvYztcbiAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgICAgICAgICAgICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgICAgIGRvYyA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQ7XG4gICAgICAgICAgICAgICAgZG9jLndyaXRlbG4ocmVzcCk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRvYyA9IGRvY3VtZW50O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgZG9jLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuXG4gICAgICAgICAgICAgIGxvYWRNb2RlbChcbiAgICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJykgOiAnJyxcbiAgICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCxcbiAgICAgICAgICAgICAgICBkb2NcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvYWRUZW1wbGF0ZSgpO1xuICAgIH07XG4iLCIvKlxuXG4jIyBNYWluIGZ1bmN0aW9uXG5cbiovXG4gICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICBmdW5jdGlvbiBqdG1wbCgpIHtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgdmFyIHRhcmdldCwgdCwgdGVtcGxhdGUsIG1vZGVsO1xuXG4gICAgICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgICAgIGlmIChbJ0dFVCcsICdQT1NUJ10uaW5kZXhPZihhcmdzWzBdKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKCcuL3hocicpLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbChvYmplY3QpP1xuICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIHJldHVybiBGcmVhayBpbnN0YW5jZVxuICAgICAgICByZXR1cm4gcmVxdWlyZSgnZnJlYWsnKShhcmdzWzBdKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0KT9cbiAgICAgIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyByZXR1cm4gbW9kZWxcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSkuX19qdG1wbF9fO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICAoIGFyZ3NbMF0gJiYgYXJnc1swXS5ub2RlVHlwZSB8fFxuICAgICAgICAgICh0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICAoIChhcmdzWzFdICYmIHR5cGVvZiBhcmdzWzFdLmFwcGVuZENoaWxkID09PSAnZnVuY3Rpb24nKSB8fFxuICAgICAgICAgICh0eXBlb2YgYXJnc1sxXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICBhcmdzWzJdICE9PSB1bmRlZmluZWRcblxuICAgICAgKSB7XG5cbiAgICAgICAgdGFyZ2V0ID0gYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlICA/XG4gICAgICAgICAgYXJnc1swXSA6XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKTtcblxuICAgICAgICB0ZW1wbGF0ZSA9IGFyZ3NbMV0ubWF0Y2goY29uc3RzLlJFX05PREVfSUQpID9cbiAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMV0pLmlubmVySFRNTCA6XG4gICAgICAgICAgYXJnc1sxXTtcblxuICAgICAgICBtb2RlbCA9XG4gICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICAgICAgICBhcmdzWzJdIDpcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSB3cmFwXG4gICAgICAgICAgICBqdG1wbC5mcmVhayhcbiAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgICAgICAvLyBvYmplY3RcbiAgICAgICAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJyAmJiBhcmdzWzJdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgICAgICAgICAvLyBzcmMsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgIHJlcXVpcmUoJy4vbG9hZGVyJylcbiAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1syXSkuaW5uZXJIVE1MKSA6XG5cbiAgICAgICAgICAgICAgICAgIC8vIHNpbXBsZSB2YWx1ZSwgYm94IGl0XG4gICAgICAgICAgICAgICAgICB7Jy4nOiBhcmdzWzJdfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBpZiAodGFyZ2V0Lm5vZGVOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgICAgIHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICB0LmlkID0gdGFyZ2V0LmlkO1xuICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0LCB0YXJnZXQpO1xuICAgICAgICAgIHRhcmdldCA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NvY2lhdGUgdGFyZ2V0IGFuZCBtb2RlbFxuICAgICAgICB0YXJnZXQuX19qdG1wbF9fID0gbW9kZWw7XG5cbiAgICAgICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICAvLyBBc3NpZ24gY29tcGlsZWQgdGVtcGxhdGVcbiAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICAgIH1cbiAgICB9XG5cblxuXG4vKlxuXG5PbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcblxuKi9cblxuICAgIHJlcXVpcmUoJy4vY29udGVudC1sb2FkZWQnKSh3aW5kb3csIGZ1bmN0aW9uKCkge1xuXG4gICAgICB2YXIgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbiAgICAgIHZhciB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtanRtcGxdJyk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0YXJnZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGxvYWRlcih0YXJnZXRzW2ldLCB0YXJnZXRzW2ldLmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG5cbi8qXG5cbkV4cG9zZSBuZXctZ2VuZXJhdGlvbiBjb21waWxlciBmb3IgZXhwZXJpbWVudGluZ1xuXG4qL1xuXG4gICAganRtcGwucGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG4gICAganRtcGwuY29tcGlsZSA9IHJlcXVpcmUoJy4vY29tcGlsZScpO1xuXG5cbi8qXG5cblBsdWdpbnNcblxuKi9cblxuICAgIGp0bXBsLnBsdWdpbnMgPSB7XG4gICAgICBpbml0OiBmdW5jdGlvbihhcmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgICAgLy8gQ2FsbCBhc3luYywgYWZ0ZXIganRtcGwgaGFzIGNvbnN0cnVjdGVkIHRoZSBET01cbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYXJnLmNhbGwodGhhdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG5cbi8qXG5cbkV4cG9ydFxuXG4qL1xuICAgIG1vZHVsZS5leHBvcnRzID0ganRtcGw7XG4iLCIvKipcbiAqIFBhcnNlIGEgdGV4dCB0ZW1wbGF0ZSB0byBET00gc3RydWN0dXJlIHJlYWR5IGZvciBjb21waWxpbmdcbiAqIEBzZWUgY29tcGlsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5mdW5jdGlvbiBwYXJzZSh0ZW1wbGF0ZSkge1xuXG4gIHZhciBpZnJhbWUsIGJvZHk7XG5cbiAgZnVuY3Rpb24gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSkge1xuXG4gICAgLy8gcmVwbGFjZSB7e3t0YWd9fX0gd2l0aCB7eyZ0YWd9fVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgvXFx7XFx7XFx7KFtcXFNcXHNdKj8pXFx9XFx9XFx9LywgJ3t7JiQxfX0nKTtcblxuICAgIC8vIDEuIHdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2p0bXBsLXRhZ1wiPlxuICAgIC8vIDIuIHJlbW92ZSBNdXN0YWNoZSBjb21tZW50c1xuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC9cXHtcXHsoW1xcU1xcc10qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICB2YXIgaGVhZCA9IHRlbXBsYXRlLnNsaWNlKDAsIHBvcyk7XG4gICAgICAgIHZhciBpbnNpZGVUYWcgPSAhIWhlYWQubWF0Y2goLzxbXFx3XFwtXStbXj5dKj8kLyk7XG4gICAgICAgIHZhciBvcGVuaW5nID0gaGVhZC5tYXRjaCgvPChzY3JpcHR8U0NSSVBUKS9nKTtcbiAgICAgICAgdmFyIGNsb3NpbmcgPSBoZWFkLm1hdGNoKC88XFwvKHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgaW5zaWRlU2NyaXB0ID1cbiAgICAgICAgICAgIChvcGVuaW5nICYmIG9wZW5pbmcubGVuZ3RoIHx8IDApID4gKGNsb3NpbmcgJiYgY2xvc2luZy5sZW5ndGggfHwgMCk7XG4gICAgICAgIHZhciBpbnNpZGVDb21tZW50ID0gISFoZWFkLm1hdGNoKC88IS0tXFxzKiQvKTtcbiAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICByZXR1cm4gaW5zaWRlVGFnIHx8IGluc2lkZUNvbW1lbnQgP1xuICAgICAgICAgIGlzTXVzdGFjaGVDb21tZW50ID9cbiAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICBpbnNpZGVTY3JpcHQgP1xuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgJzxzY3JpcHQgdHlwZT1cInRleHQvanRtcGwtdGFnXCI+JyArIG1hdGNoMS50cmltKCkgKyAnXFx4M0Mvc2NyaXB0Pic7XG4gICAgICB9XG4gICAgKTtcbiAgICAvLyBwcmVmaXggJ3NlbGVjdGVkJyBhbmQgJ2NoZWNrZWQnIGF0dHJpYnV0ZXMgd2l0aCAnanRtcGwtJ1xuICAgIC8vICh0byBhdm9pZCBcInNwZWNpYWxcIiBwcm9jZXNzaW5nLCBvaCBJRTgpXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgLyg8KD86b3B0aW9ufE9QVElPTilbXj5dKj8pKD86c2VsZWN0ZWR8U0VMRUNURUQpPS9nLFxuICAgICAgJyQxanRtcGwtc2VsZWN0ZWQ9Jyk7XG5cbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzppbnB1dHxJTlBVVClbXj5dKj8pKD86Y2hlY2tlZHxDSEVDS0VEKT0vZyxcbiAgICAgICckMWp0bXBsLWNoZWNrZWQ9Jyk7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUpO1xuICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgaWZyYW1lLmNvbnRlbnREb2N1bWVudC53cml0ZWxuKCc8IWRvY3R5cGUgaHRtbD5cXG48aHRtbD48Ym9keT4nICsgdGVtcGxhdGUgKyAnPC9ib2R5PjwvaHRtbD4nKTtcbiAgYm9keSA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQuYm9keTtcbiAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuXG4gIHJldHVybiBib2R5O1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcbiIsIi8qXG5cbiMjIFJ1bGVzXG5cbkVhY2ggcnVsZSBpcyBhIGZ1bmN0aW9uLCBhcmdzIHdoZW4gY2FsbGVkIGFyZTpcbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKVxuXG50YWc6IHRleHQgYmV0d2VlbiBkZWxpbWl0ZXJzLCB7e3RhZ319XG5ub2RlOiBET00gbm9kZSwgd2hlcmUgdGFnIGlzIGZvdW5kXG5hdHRyOiBub2RlIGF0dHJpYnV0ZSBvciBudWxsLCBpZiBub2RlIGNvbnRlbnRzXG5tb2RlbDogRnJlYWsgbW9kZWxcbm9wdGlvbnM6IGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuXG5JdCBtdXN0IHJldHVybiBlaXRoZXI6XG5cbiogZmFsc3kgdmFsdWUgLSBubyBtYXRjaFxuXG4qIG9iamVjdCAtIG1hdGNoIGZvdW5kLCByZXR1cm4gKGFsbCBmaWVsZHMgb3B0aW9uYWwpXG5cbiAgICAge1xuICAgICAgIC8vIFBhcnNlIHVudGlsIHt7L319IG9yIHt7L3NvbWVQcm9wfX0gLi4uXG4gICAgICAgYmxvY2s6ICdzb21lUHJvcCcsXG5cbiAgICAgICAvLyAuLi4gdGhlbiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkLlxuICAgICAgIC8vIEl0IG11c3QgcmV0dXJuIHN0cmluZyBvciBET01FbGVtZW50XG4gICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCwgcGFyZW50KSB7IC4uLiB9XG4gICAgIH1cblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gW1xuICAgICAgcmVxdWlyZSgnLi9ydWxlcy92YWx1ZS12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvY2hlY2tlZC12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VsZWN0ZWQtdmFyJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL2NsYXNzLXNlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9pbnZlcnRlZC1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3BhcnRpYWwnKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdW5lc2NhcGVkLXZhcicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy92YXInKVxuICAgIF07XG4iLCIvKlxuXG4jIyMgY2hlY2tlZD1cInt7dmFsfX1cIlxuXG5IYW5kbGUgXCJjaGVja2VkXCIgYXR0cmlidXRlXG5cbiovXG5cbiAgICB2YXIgcmFkaW9Hcm91cHMgPSB7fTtcbiAgICAvLyBDdXJyZW50bHkgdXBkYXRpbmc/XG4gICAgdmFyIHVwZGF0aW5nID0gZmFsc2U7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX0lERU5USUZJRVIpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFswXTtcblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICBpZiAodXBkYXRpbmcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUubmFtZSkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQgPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdW2ldKHByb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgYXR0ciA9PT0gJ2NoZWNrZWQnKSB7XG4gICAgICAgIC8vIHJhZGlvIGdyb3VwP1xuICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgIGlmICghcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgLy8gSW5pdCByYWRpbyBncm91cCAoWzBdOiBub2RlLCBbMV06IG1vZGVsKVxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBBZGQgaW5wdXQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgLy8gQWRkIGNvbnRleHQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdLnB1c2gobW9kZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICB1cGRhdGluZyA9IHRydWU7XG4gICAgICAgICAgICAvLyBVcGRhdGUgYWxsIGlucHV0cyBmcm9tIHRoZSBncm91cFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wLCByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXBkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiAnJyxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZSxcbiAgICAgICAgICBhc3luY0luaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwudHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyBjbGFzcz1cInt7I2lmQ29uZGl0aW9ufX1zb21lLWNsYXNze3svfX1cIlxuXG5Ub2dnbGVzIGNsYXNzIGBzb21lLWNsYXNzYCBpbiBzeW5jIHdpdGggYm9vbGVhbiBgbW9kZWwuaWZDb25kaXRpb25gXG5cblxuIyMjIGNsYXNzPVwie3tebm90SWZDb25kaXRpb259fXNvbWUtY2xhc3N7ey99fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIG5vdCBgbW9kZWwubm90SWZDb25kaXRpb25gXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChuZXcgUmVnRXhwKCcoI3xcXFxcXiknICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBpbnZlcnRlZCA9IG1hdGNoICYmIChtYXRjaFsxXSA9PT0gJ14nKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMl07XG4gICAgICB2YXIga2xhc3M7XG5cblxuICAgICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgbWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgICAgIFsoaW52ZXJ0ZWQgPT09ICF2YWwpICYmICdhZGQnIHx8ICdyZW1vdmUnXShrbGFzcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7e15pbnZlcnRlZC1zZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXlxcXFxeJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzFdO1xuICAgICAgdmFyIHRlbXBsYXRlO1xuICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBjaGFuZ2UpO1xuICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgY2hhbmdlKTtcbiAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICBpZiAodmFsLmxlbiA9PT0gMCkge1xuICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIHZhbChpKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghdmFsKSB7XG4gICAgICAgICAgICByZW5kZXIgPSBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIGlmIChtYXRjaCAmJiAhYXR0cikge1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAgIHRlbXBsYXRlID0gdG1wbDtcbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG5cbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMgUGFydGlhbFxuXG4qIHt7PlwiI2lkXCJ9fVxuKiB7ez5cInVybFwifX1cbioge3s+XCJ1cmwjaWRcIn19XG4qIHt7PnBhcnRpYWxTcmN9fVxuXG5SZXBsYWNlcyBwYXJlbnQgdGFnIGNvbnRlbnRzLCBhbHdheXMgd3JhcCBpbiBhIHRhZ1xuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2goY29uc3RzLlJFX1BBUlRJQUwpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIHRhcmdldDtcblxuICAgICAgdmFyIGxvYWRlciA9IG1hdGNoICYmXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICB0YXJnZXQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVxdWlyZSgnLi4vbG9hZGVyJykoXG4gICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICBtYXRjaFsxXSA/XG4gICAgICAgICAgICAgIC8vIFZhcmlhYmxlXG4gICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICAgICAgbWF0Y2hbMl0gfHwgbWF0Y2hbM10sXG4gICAgICAgICAgICBtb2RlbFxuICAgICAgICAgIClcbiAgICAgICAgfTtcblxuICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgbWF0Y2hbMV0sIGxvYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBMb2FkIGFzeW5jXG4gICAgICAgIHNldFRpbWVvdXQobG9hZGVyLCAwKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlcGxhY2U6IGFuY2hvclxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7eyNzZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgdGVtcGxhdGU7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgcGFyZW50LnJlcGxhY2VDaGlsZChcbiAgICAgICAgICAgIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGkpKSxcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaW5kZXggKyBpKSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShmcmFnbWVudCwgcGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgIGxlbmd0aCA9IGxlbmd0aCArIHNpemU7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGRlbChpbmRleCwgY291bnQpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBzaXplID0gY291bnQgKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcblxuICAgICAgICBsZW5ndGggPSBsZW5ndGggLSBzaXplO1xuXG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICB2YXIgdmFsID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcbiAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFycmF5P1xuICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGluc2VydCk7XG4gICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC5sZW47IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFsLm9uKCdjaGFuZ2UnLCBpLCB1cGRhdGUoaSkpO1xuICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIHZhbChpKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJlbmRlciA9IGNvbXBpbGUodGVtcGxhdGUsIHZhbCk7XG4gICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKCEhdmFsKSB7XG4gICAgICAgICAgICByZW5kZXIgPSBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAgIHRlbXBsYXRlID0gdG1wbDtcblxuICAgICAgICAgICAgcmV0dXJuIGFuY2hvcjtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcblxuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyBzZWxlY3RlZD1cInt7dmFsfX1cIlxuXG5IYW5kbGUgXCJzZWxlY3RlZFwiIGF0dHJpYnV0ZVxuXG4qL1xuXG4gICAgdmFyIHNlbGVjdHMgPSBbXTtcbiAgICB2YXIgc2VsZWN0T3B0aW9ucyA9IFtdO1xuICAgIHZhciBzZWxlY3RPcHRpb25zQ29udGV4dHMgPSBbXTtcbiAgICAvLyBDdXJyZW50bHkgdXBkYXRpbmc/IEluaXRpYWxpemVkIHRvIHRydWUgdG8gYXZvaWQgc3luYyBpbml0XG4gICAgdmFyIHVwZGF0aW5nID0gdHJ1ZTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX0lERU5USUZJRVIpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFswXTtcblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICBpZiAodXBkYXRpbmcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICBmb3IgKHZhciBqID0gMCwgbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXVtqXS5zZWxlY3RlZCA9IHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtqXShwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbm9kZS5zZWxlY3RlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXRjaCAmJiBhdHRyID09PSAnc2VsZWN0ZWQnKSB7XG4gICAgICAgIC8vIDxzZWxlY3Q+IG9wdGlvbj9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgLy8gUHJvY2VzcyBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgLy8gQWRkIDxzZWxlY3Q+IHRvIGxpc3RcbiAgICAgICAgICAgICAgaSA9IHNlbGVjdHMucHVzaChub2RlLnBhcmVudE5vZGUpIC0gMTtcbiAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zXG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnMucHVzaChbXSk7XG4gICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9ucyBjb250ZXh0c1xuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHMucHVzaChbXSk7XG4gICAgICAgICAgICAgIC8vIEF0dGFjaCBjaGFuZ2UgbGlzdGVuZXJcbiAgICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHVwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBvaSA9IDAsIG9sZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgb2kgPCBvbGVuOyBvaSsrKSB7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bb2ldKHByb3AsIHNlbGVjdE9wdGlvbnNbaV1bb2ldLnNlbGVjdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdXBkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBSZW1lbWJlciBvcHRpb24gYW5kIGNvbnRleHRcbiAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwocHJvcCwgdGhpcy5zZWxlY3RlZCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2UsXG4gICAgICAgICAgYXN5bmNJbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBtb2RlbC50cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7JnZhcn19XG5cbihge3t7dmFyfX19YCBpcyByZXBsYWNlZCBvbiBwcmVwcm9jZXNzaW5nIHN0ZXApXG5cbkNhbiBiZSBib3VuZCB0byBub2RlIGlubmVySFRNTFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiYnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgaWYgKG1hdGNoICYmICFhdHRyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiBhbmNob3IsXG4gICAgICAgICAgY2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgICAgIHZhciBpO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHZhbHVlXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbC5jaGlsZE5vZGVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShmcmFnbWVudCwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHZhbHVlPVwie3t2YWx9fVwiXG5cbkhhbmRsZSBcInZhbHVlXCIgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgYXR0ciA9PT0gJ3ZhbHVlJykge1xuICAgICAgICAvLyB0ZXh0IGlucHV0P1xuICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICdrZXl1cCcgOiAnY2hhbmdlJzsgLy8gSUU5IGluY29yZWN0bHkgcmVwb3J0cyBpdCBzdXBwb3J0cyBpbnB1dCBldmVudFxuXG4gICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3t2YXJ9fVxuXG5DYW4gYmUgYm91bmQgdG8gdGV4dCBub2RlIGRhdGEgb3IgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciByZWFjdCwgdGFyZ2V0LCBjaGFuZ2U7XG5cbiAgICAgIGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbC52YWx1ZXMpIDpcbiAgICAgICAgICB2YWw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUikpIHtcblxuICAgICAgICBpZiAoYXR0cikge1xuICAgICAgICAgIC8vIEF0dHJpYnV0ZVxuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGdldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbCA/XG4gICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbCkgOlxuICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgICAgICBjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRhcmdldC5kYXRhID0gZ2V0KCkgfHwgJyc7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1hdGNoIGZvdW5kXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogdGFnLFxuICAgICAgICAgIHJlcGxhY2U6IHRhcmdldCxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkge1xuICAgICAgICAgICAgb25sb2FkLmNhbGwodGhpcywgJ2RvbmUnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnanRtcGwgWEhSIGVycm9yOiAnICsgdGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSxcbiAgICAgICAgb3B0cy51c2VyLCBvcHRzLnBhc3N3b3JkKTtcblxuICAgICAgeGhyLnNlbmQocmVxdWVzdCk7XG5cbiAgICAgIHJldHVybiB4aHI7XG5cbiAgICB9O1xuIl19
(10)
});
