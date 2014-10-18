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
        console.log('compiler: IFRAME construction');
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

},{"./consts":5,"./default-options":7,"./rules":10,"freak":2}],4:[function(_dereq_,module,exports){
/*

## Compiler



t = document.createDocumentFragment();
n = document.createElement('div');
n.innerHTML = '<p class="classy"><i selected checked attr="">zzz</i> ooo <!-- pfff --> </p> hey <!-- eee --> hoe';
t.appendChild(n);
t.appendChild(document.createComment('divvv'));
t.appendChild(document.createElement('span'));
t.appendChild(document.createTextNode('spannn'));


*/

    module.exports = function compile2(template, model, options) {
      var result = '(function(model) {' +
        'var frag = document.createDocumentFragment(), node;';

      for (var i = 0, childNodes = template.childNodes, len = childNodes.length;
           i < len; i++) {

        switch (childNodes[i].nodeType) {

          // Element node
          case 1:

            // Create element
            result += 'node = document.createElement("' + childNodes[i].nodeName + '");';

            // Clone attributes
            for (var ai = 0, attributes = childNodes[i].attributes, alen = attributes.length;
                ai < alen; ai++) {
              result += 'node.setAttribute("' +
                attributes[ai].name +
                '", ' +
                JSON.stringify(attributes[ai].value) +
                ');';
            }

            // Recursively compile
            result += 'node.appendChild(' + compile2(childNodes[i], model, options) + '());';

            // Append to fragment
            result += 'frag.appendChild(node);';
            break;


          // Text node
          case 3:
            result += 'frag.appendChild(document.createTextNode("' + childNodes[i].data + '"));';
            break;


          // Comment node
          case 8:
            result += 'frag.appendChild(document.createComment("' + childNodes[i].data + '"));';
            break;

        } // end switch
      } // end iterate childNodes

       result += 'return frag; })';

      return result;
    };


},{}],5:[function(_dereq_,module,exports){
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

},{}],6:[function(_dereq_,module,exports){
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

},{}],7:[function(_dereq_,module,exports){
/*
  
Default options

*/
    
    module.exports = {
      delimiters: ['{{', '}}']
    };

},{}],8:[function(_dereq_,module,exports){
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

},{"./consts":5}],9:[function(_dereq_,module,exports){
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

    jtmpl.compile2 = _dereq_('./compiler2');


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

},{"./compiler":3,"./compiler2":4,"./consts":5,"./content-loaded":6,"./loader":8,"./xhr":20,"freak":2}],10:[function(_dereq_,module,exports){
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

},{"./rules/checked-var":11,"./rules/class-section":12,"./rules/inverted-section":13,"./rules/partial":14,"./rules/section":15,"./rules/selected-var":16,"./rules/unescaped-var":17,"./rules/value-var":18,"./rules/var":19}],11:[function(_dereq_,module,exports){
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

},{"../consts":5}],12:[function(_dereq_,module,exports){
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

},{"../consts":5,"element-class":1}],13:[function(_dereq_,module,exports){
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

},{"../compiler":3,"../consts":5}],14:[function(_dereq_,module,exports){
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

},{"../consts":5,"../loader":8}],15:[function(_dereq_,module,exports){
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

},{"../compiler":3,"../consts":5}],16:[function(_dereq_,module,exports){
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

},{"../consts":5}],17:[function(_dereq_,module,exports){
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

},{"../consts":5}],18:[function(_dereq_,module,exports){
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

},{"../consts":5}],19:[function(_dereq_,module,exports){
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

},{"../consts":5}],20:[function(_dereq_,module,exports){
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

},{}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2VsZW1lbnQtY2xhc3MvaW5kZXguanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbXBpbGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZXIyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29uc3RzLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29udGVudC1sb2FkZWQuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9kZWZhdWx0LW9wdGlvbnMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9sb2FkZXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9tYWluLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9jaGVja2VkLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL2NsYXNzLXNlY3Rpb24uanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9pbnZlcnRlZC1zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvcGFydGlhbC5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3NlY3Rpb24uanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9zZWxlY3RlZC12YXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy91bmVzY2FwZWQtdmFyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdmFsdWUtdmFyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdmFyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMveGhyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbn1cblxuZnVuY3Rpb24gRWxlbWVudENsYXNzKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEVsZW1lbnRDbGFzcykpIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG4gIHZhciBzZWxmID0gdGhpc1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuXG4gIC8vIHNpbWlsYXIgZG9pbmcgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCBidXQgd29ya3MgaW4gSUU4XG4gIGlmIChvcHRzLm5vZGVUeXBlKSBvcHRzID0ge2VsOiBvcHRzfVxuXG4gIHRoaXMub3B0cyA9IG9wdHNcbiAgdGhpcy5lbCA9IG9wdHMuZWwgfHwgZG9jdW1lbnQuYm9keVxuICBpZiAodHlwZW9mIHRoaXMuZWwgIT09ICdvYmplY3QnKSB0aGlzLmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLmVsKVxufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm4gZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgaWYgKGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTEpIHJldHVybiBjbGFzc2VzXG4gIGNsYXNzZXMucHVzaChjbGFzc05hbWUpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHZhciBpZHggPSBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKVxuICBpZiAoaWR4ID4gLTEpIGNsYXNzZXMuc3BsaWNlKGlkeCwgMSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICByZXR1cm4gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmcmVhayhvYmosIHJvb3QsIHBhcmVudCwgcHJvcCkge1xuXG4gIHZhciBsaXN0ZW5lcnMgPSB7XG4gICAgJ2NoYW5nZSc6IHt9LFxuICAgICd1cGRhdGUnOiB7fSxcbiAgICAnaW5zZXJ0Jzoge30sXG4gICAgJ2RlbGV0ZSc6IHt9XG4gIH07XG4gIHZhciBfZGVwZW5kZW50UHJvcHMgPSB7fTtcbiAgdmFyIF9kZXBlbmRlbnRDb250ZXh0cyA9IHt9O1xuICB2YXIgY2FjaGUgPSB7fTtcbiAgdmFyIGNoaWxkcmVuID0ge307XG5cbiAgLy8gQXNzZXJ0IGNvbmRpdGlvblxuICBmdW5jdGlvbiBhc3NlcnQoY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICB0aHJvdyBtc2cgfHwgJ2Fzc2VydGlvbiBmYWlsZWQnO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1peCBwcm9wZXJ0aWVzIGludG8gdGFyZ2V0XG4gIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BlcnRpZXMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W3Byb3BzW2ldXSA9IHByb3BlcnRpZXNbcHJvcHNbaV1dO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZXBFcXVhbCh4LCB5KSB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwgJiZcbiAgICAgICAgdHlwZW9mIHkgPT09IFwib2JqZWN0XCIgJiYgeSAhPT0gbnVsbCkge1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoeCkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyh5KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBwcm9wIGluIHgpIHtcbiAgICAgICAgaWYgKHguaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBpZiAoeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgaWYgKCFkZWVwRXF1YWwoeFtwcm9wXSwgeVtwcm9wXSkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHggIT09IHkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEV2ZW50IGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBvbigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSBbJ3N0cmluZycsICdudW1iZXInXS5pbmRleE9mKHR5cGVvZiBhcmd1bWVudHNbMV0pID4gLTEgP1xuICAgICAgYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG5cbiAgICAvLyBBcmdzIGNoZWNrXG4gICAgYXNzZXJ0KFsnY2hhbmdlJywgJ3VwZGF0ZScsICdpbnNlcnQnLCAnZGVsZXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSk7XG4gICAgYXNzZXJ0KFxuICAgICAgKFsnY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wICE9PSBudWxsKSB8fFxuICAgICAgKFsnaW5zZXJ0JywgJ2RlbGV0ZScsICd1cGRhdGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgPT09IG51bGwpXG4gICAgKTtcblxuICAgIC8vIEluaXQgbGlzdGVuZXJzIGZvciBwcm9wXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIC8vIEFscmVhZHkgcmVnaXN0ZXJlZD9cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCBvciBzcGVjaWZpZWQgbGlzdGVuZXJzIGdpdmVuIGV2ZW50IGFuZCBwcm9wZXJ0eVxuICBmdW5jdGlvbiBvZmYoKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcbiAgICB2YXIgaTtcblxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwcm9wZXJ0eSB3YXRjaGVycz9cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gUmVtb3ZlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICBpID0gbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgIGlmIChpID4gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH1cblxuICAvLyB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCdpbnNlcnQnIG9yICdkZWxldGUnLCBpbmRleCwgY291bnQpXG4gIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGEsIGIpIHtcbiAgICB2YXIgaGFuZGxlcnMgPSAobGlzdGVuZXJzW2V2ZW50XVtbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgPyBhIDogbnVsbF0gfHwgW10pO1xuICAgIHZhciBpLCBsZW4gPSBoYW5kbGVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBoYW5kbGVyc1tpXS5jYWxsKGluc3RhbmNlLCBhLCBiKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gRXhwb3J0IG1vZGVsIHRvIEpTT04gc3RyaW5nXG4gIC8vIE5PVCBleHBvcnRlZDpcbiAgLy8gLSBwcm9wZXJ0aWVzIHN0YXJ0aW5nIHdpdGggXyAoUHl0aG9uIHByaXZhdGUgcHJvcGVydGllcyBjb252ZW50aW9uKVxuICAvLyAtIGNvbXB1dGVkIHByb3BlcnRpZXMgKGRlcml2ZWQgZnJvbSBub3JtYWwgcHJvcGVydGllcylcbiAgZnVuY3Rpb24gdG9KU09OKCkge1xuICAgIGZ1bmN0aW9uIGZpbHRlcihvYmopIHtcbiAgICAgIHZhciBrZXksIGZpbHRlcmVkID0gQXJyYXkuaXNBcnJheShvYmopID8gW10gOiB7fTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICBpZiAodHlwZW9mIG9ialtrZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmaWx0ZXIob2JqW2tleV0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvYmpba2V5XSAhPT0gJ2Z1bmN0aW9uJyAmJiBrZXlbMF0gIT09ICdfJykge1xuICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBvYmpba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbHRlcmVkO1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZmlsdGVyKG9iaikpO1xuICB9XG5cbiAgLy8gTG9hZCBtb2RlbCBmcm9tIEpTT04gc3RyaW5nIG9yIG9iamVjdFxuICBmdW5jdGlvbiBmcm9tSlNPTihkYXRhKSB7XG4gICAgdmFyIGtleTtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICB9XG4gICAgZm9yIChrZXkgaW4gZGF0YSkge1xuICAgICAgaW5zdGFuY2Uoa2V5LCBkYXRhW2tleV0pO1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywga2V5KTtcbiAgICB9XG4gICAgaW5zdGFuY2UubGVuID0gb2JqLmxlbmd0aDtcbiAgfVxuXG4gIC8vIFVwZGF0ZSBoYW5kbGVyOiByZWNhbGN1bGF0ZSBkZXBlbmRlbnQgcHJvcGVydGllcyxcbiAgLy8gdHJpZ2dlciBjaGFuZ2UgaWYgbmVjZXNzYXJ5XG4gIGZ1bmN0aW9uIHVwZGF0ZShwcm9wKSB7XG4gICAgaWYgKCFkZWVwRXF1YWwoY2FjaGVbcHJvcF0sIGdldChwcm9wLCBmdW5jdGlvbigpIHt9LCB0cnVlKSkpIHtcbiAgICAgIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApO1xuICAgIH1cblxuICAgIC8vIE5vdGlmeSBkZXBlbmRlbnRzXG4gICAgZm9yICh2YXIgaSA9IDAsIGRlcCA9IF9kZXBlbmRlbnRQcm9wc1twcm9wXSB8fCBbXSwgbGVuID0gZGVwLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBkZWxldGUgY2hpbGRyZW5bZGVwW2ldXTtcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0c1twcm9wXVtpXS50cmlnZ2VyKCd1cGRhdGUnLCBkZXBbaV0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5wYXJlbnQpIHtcbiAgICAgIC8vIE5vdGlmeSBjb21wdXRlZCBwcm9wZXJ0aWVzLCBkZXBlbmRpbmcgb24gcGFyZW50IG9iamVjdFxuICAgICAgaW5zdGFuY2UucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIGluc3RhbmNlLnByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByb3h5IHRoZSBhY2Nlc3NvciBmdW5jdGlvbiB0byByZWNvcmRcbiAgLy8gYWxsIGFjY2Vzc2VkIHByb3BlcnRpZXNcbiAgZnVuY3Rpb24gZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCkge1xuICAgIGZ1bmN0aW9uIHRyYWNrZXIoY29udGV4dCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKF9wcm9wLCBfYXJnKSB7XG4gICAgICAgIGlmICghY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdID0gW107XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5pbmRleE9mKHByb3ApID09PSAtMSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXS5wdXNoKHByb3ApO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dChfcHJvcCwgX2FyZywgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0cmFja2VyKGluc3RhbmNlKTtcbiAgICBjb25zdHJ1Y3QocmVzdWx0KTtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICByZXN1bHQucGFyZW50ID0gdHJhY2tlcihwYXJlbnQpO1xuICAgIH1cbiAgICByZXN1bHQucm9vdCA9IHRyYWNrZXIocm9vdCB8fCBpbnN0YW5jZSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNoYWxsb3cgY2xvbmUgYW4gb2JqZWN0XG4gIGZ1bmN0aW9uIHNoYWxsb3dDbG9uZShvYmopIHtcbiAgICB2YXIga2V5LCBjbG9uZTtcbiAgICBpZiAob2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICBjbG9uZSA9IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGNsb25lW2tleV0gPSBvYmpba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjbG9uZSA9IG9iajtcbiAgICB9XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG5cbiAgLy8gR2V0dGVyIGZvciBwcm9wLCBpZiBjYWxsYmFjayBpcyBnaXZlblxuICAvLyBjYW4gcmV0dXJuIGFzeW5jIHZhbHVlXG4gIGZ1bmN0aW9uIGdldChwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpIHtcbiAgICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YWwgPSB2YWwuY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgY2FsbGJhY2spO1xuICAgICAgaWYgKCFza2lwQ2FjaGluZykge1xuICAgICAgICBjYWNoZVtwcm9wXSA9ICh2YWwgPT09IHVuZGVmaW5lZCkgPyB2YWwgOiBzaGFsbG93Q2xvbmUodmFsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICBjYWNoZVtwcm9wXSA9IHZhbDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldHRlcihwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpIHtcbiAgICB2YXIgcmVzdWx0ID0gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZyk7XG5cbiAgICByZXR1cm4gcmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnID9cbiAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICBjaGlsZHJlbltwcm9wXSA/XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdIDpcbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gPSBmcmVhayhyZXN1bHQsIHJvb3QgfHwgaW5zdGFuY2UsIGluc3RhbmNlLCBwcm9wKSA6XG4gICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNldCBwcm9wIHRvIHZhbFxuICBmdW5jdGlvbiBzZXR0ZXIocHJvcCwgdmFsKSB7XG4gICAgdmFyIG9sZFZhbCA9IGdldChwcm9wKTtcblxuICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eSBzZXR0ZXJcbiAgICAgIG9ialtwcm9wXS5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCB2YWwpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFNpbXBsZSBwcm9wZXJ0eVxuICAgICAgb2JqW3Byb3BdID0gdmFsO1xuICAgICAgaWYgKHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgICBkZWxldGUgY2FjaGVbcHJvcF07XG4gICAgICAgIGRlbGV0ZSBjaGlsZHJlbltwcm9wXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob2xkVmFsICE9PSB2YWwpIHtcbiAgICAgIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZ1bmN0aW9uYWwgYWNjZXNzb3IsIHVuaWZ5IGdldHRlciBhbmQgc2V0dGVyXG4gIGZ1bmN0aW9uIGFjY2Vzc29yKHByb3AsIGFyZywgc2tpcENhY2hpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgZ2V0dGVyIDogc2V0dGVyXG4gICAgKShwcm9wLCBhcmcsIHNraXBDYWNoaW5nKTtcbiAgfVxuXG4gIC8vIEF0dGFjaCBpbnN0YW5jZSBtZW1iZXJzXG4gIGZ1bmN0aW9uIGNvbnN0cnVjdCh0YXJnZXQpIHtcbiAgICBtaXhpbih0YXJnZXQsIHtcbiAgICAgIHZhbHVlczogb2JqLFxuICAgICAgcGFyZW50OiBwYXJlbnQgfHwgbnVsbCxcbiAgICAgIHJvb3Q6IHJvb3QgfHwgdGFyZ2V0LFxuICAgICAgcHJvcDogcHJvcCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHByb3AsXG4gICAgICAvLyAub24oZXZlbnRbLCBwcm9wXSwgY2FsbGJhY2spXG4gICAgICBvbjogb24sXG4gICAgICAvLyAub2ZmKGV2ZW50WywgcHJvcF1bLCBjYWxsYmFja10pXG4gICAgICBvZmY6IG9mZixcbiAgICAgIC8vIC50cmlnZ2VyKGV2ZW50WywgcHJvcF0pXG4gICAgICB0cmlnZ2VyOiB0cmlnZ2VyLFxuICAgICAgdG9KU09OOiB0b0pTT04sXG4gICAgICAvLyBEZXByZWNhdGVkLiBJdCBoYXMgYWx3YXlzIGJlZW4gYnJva2VuLCBhbnl3YXlcbiAgICAgIC8vIFdpbGwgdGhpbmsgaG93IHRvIGltcGxlbWVudCBwcm9wZXJseVxuICAgICAgZnJvbUpTT046IGZyb21KU09OLFxuICAgICAgLy8gSW50ZXJuYWw6IGRlcGVuZGVuY3kgdHJhY2tpbmdcbiAgICAgIF9kZXBlbmRlbnRQcm9wczogX2RlcGVuZGVudFByb3BzLFxuICAgICAgX2RlcGVuZGVudENvbnRleHRzOiBfZGVwZW5kZW50Q29udGV4dHNcbiAgICB9KTtcblxuICAgIC8vIFdyYXAgbXV0YXRpbmcgYXJyYXkgbWV0aG9kIHRvIHVwZGF0ZVxuICAgIC8vIHN0YXRlIGFuZCBub3RpZnkgbGlzdGVuZXJzXG4gICAgZnVuY3Rpb24gd3JhcEFycmF5TWV0aG9kKG1ldGhvZCwgZnVuYykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW11bbWV0aG9kXS5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMubGVuID0gdGhpcy52YWx1ZXMubGVuZ3RoO1xuICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICBjaGlsZHJlbiA9IHt9O1xuICAgICAgICBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIHRhcmdldC5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgdGFyZ2V0LnByb3ApO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICBtaXhpbih0YXJnZXQsIHtcbiAgICAgICAgLy8gRnVuY3Rpb24gcHJvdG90eXBlIGFscmVhZHkgY29udGFpbnMgbGVuZ3RoXG4gICAgICAgIC8vIGBsZW5gIHNwZWNpZmllcyBhcnJheSBsZW5ndGhcbiAgICAgICAgbGVuOiBvYmoubGVuZ3RoLFxuXG4gICAgICAgIHBvcDogd3JhcEFycmF5TWV0aG9kKCdwb3AnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCB0aGlzLmxlbiwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHB1c2g6IHdyYXBBcnJheU1ldGhvZCgncHVzaCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIHRoaXMubGVuIC0gMSwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHJldmVyc2U6IHdyYXBBcnJheU1ldGhvZCgncmV2ZXJzZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3NoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHVuc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgndW5zaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBzb3J0OiB3cmFwQXJyYXlNZXRob2QoJ3NvcnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzcGxpY2U6IHdyYXBBcnJheU1ldGhvZCgnc3BsaWNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSkge1xuICAgICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzLmxlbmd0aCAtIDIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb24oJ3VwZGF0ZScsIHVwZGF0ZSk7XG5cbiAgLy8gQ3JlYXRlIGZyZWFrIGluc3RhbmNlXG4gIHZhciBpbnN0YW5jZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBhY2Nlc3Nvci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIEF0dGFjaCBpbnN0YW5jZSBtZW1iZXJzXG4gIGNvbnN0cnVjdChpbnN0YW5jZSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDb21tb25KUyBleHBvcnRcbmlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JykgbW9kdWxlLmV4cG9ydHMgPSBmcmVhaztcbiIsIi8qXG5cbiMjIENvbXBpbGVyXG5cbiovXG5cblxuLypcblxuIyMjIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsWywgb3B0aW9uc10pXG5cblJldHVybiBkb2N1bWVudEZyYWdtZW50XG5cbiovXG5cblxuICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuICAgIHZhciByZUVuZEJsb2NrO1xuXG4gICAgLy8gVXRpbGl0eSBmdW5jdGlvbnNcblxuICAgIGZ1bmN0aW9uIGVzY2FwZVJFKHMpIHtcbiAgICAgIHJldHVybiAocyArICcnKS5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXFxcKCl7fXwtXSkvZywgJ1xcXFwkMScpO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gdG9rZW5pemVyKG9wdGlvbnMsIGZsYWdzKSB7XG4gICAgICByZXR1cm4gUmVnRXhwKFxuICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICtcbiAgICAgICAgJygnICsgY29uc3RzLlJFX0FOWVRISU5HICsgJyknICtcbiAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKSxcbiAgICAgICAgZmxhZ3NcbiAgICAgICk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBtYXRjaFJ1bGVzKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBpLCBtYXRjaDtcbiAgICAgIHZhciBydWxlcyA9IHJlcXVpcmUoJy4vcnVsZXMnKTtcbiAgICAgIHZhciBydWxlc0xlbiA9IHJ1bGVzLmxlbmd0aDtcblxuICAgICAgLy8gU3RyaXAgZGVsaW1pdGVyc1xuICAgICAgdGFnID0gdGFnLnNsaWNlKG9wdGlvbnMuZGVsaW1pdGVyc1swXS5sZW5ndGgsIC1vcHRpb25zLmRlbGltaXRlcnNbMV0ubGVuZ3RoKTtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IHJ1bGVzTGVuOyBpKyspIHtcbiAgICAgICAgbWF0Y2ggPSBydWxlc1tpXSh0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKTtcblxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBtYXRjaC5pbmRleCA9IGk7XG4gICAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICAvLyByZXBsYWNlIHt7e3RhZ319fSB3aXRoIHt7JnRhZ319XG4gICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAgIFJlZ0V4cChcbiAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0gKyAneycpICtcbiAgICAgICAgICBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgK1xuICAgICAgICAgIGVzY2FwZVJFKCd9JyArIG9wdGlvbnMuZGVsaW1pdGVyc1sxXSksXG4gICAgICAgICAgJ2cnXG4gICAgICAgICksXG4gICAgICAgIG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICcmJDEnICsgb3B0aW9ucy5kZWxpbWl0ZXJzWzFdXG4gICAgICApO1xuICAgICAgLy8gMS4gd3JhcCBlYWNoIG5vbi1hdHRyaWJ1dGUgdGFnXG4gICAgICAvLyAodGhhdCdzIG5vdCBpbnNpZGUgPHNlbGVjdD4gKGZ1Y2sgeW91LCBJRSkpIGluIEhUTUwgY29tbWVudFxuICAgICAgLy8gMi4gcmVtb3ZlIE11c3RhY2hlIGNvbW1lbnRzXG4gICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAgIHRva2VuaXplcihvcHRpb25zLCAnZycpLFxuICAgICAgICBmdW5jdGlvbihtYXRjaCwgbWF0Y2gxLCBwb3MpIHtcbiAgICAgICAgICB2YXIgaGVhZCA9IHRlbXBsYXRlLnNsaWNlKDAsIHBvcyk7XG4gICAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaChSZWdFeHAoJzwnICsgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICsgJ1tePl0qPyQnKSk7XG4gICAgICAgICAgdmFyIG9wZW5pbmcgPSBoZWFkLm1hdGNoKC88KHNlbGVjdHxTRUxFQ1QpL2cpO1xuICAgICAgICAgIHZhciBjbG9zaW5nID0gaGVhZC5tYXRjaCgvPFxcLyhzZWxlY3R8U0VMRUNUKS9nKTtcbiAgICAgICAgICB2YXIgaW5zaWRlU2VsZWN0ID1cbiAgICAgICAgICAgICAgKG9wZW5pbmcgJiYgb3BlbmluZy5sZW5ndGggfHwgMCkgPiAoY2xvc2luZyAmJiBjbG9zaW5nLmxlbmd0aCB8fCAwKTtcbiAgICAgICAgICB2YXIgaW5zaWRlQ29tbWVudCA9ICEhaGVhZC5tYXRjaCgvPCEtLVxccyokLyk7XG4gICAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgICBpc011c3RhY2hlQ29tbWVudCA/XG4gICAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgaW5zaWRlU2VsZWN0ID9cbiAgICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgICAnPCEtLScgKyBtYXRjaCArICctLT4nO1xuICAgICAgICB9XG4gICAgICApO1xuICAgICAgLy8gcHJlZml4ICdzZWxlY3RlZCcgYW5kICdjaGVja2VkJyBhdHRyaWJ1dGVzIHdpdGggJ2p0bXBsLSdcbiAgICAgIC8vICh0byBhdm9pZCBcInNwZWNpYWxcIiBwcm9jZXNzaW5nLCBvaCBJRTgpXG4gICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAgIC8oPCg/Om9wdGlvbnxPUFRJT04pW14+XSo/KSg/OnNlbGVjdGVkfFNFTEVDVEVEKT0vZyxcbiAgICAgICAgJyQxanRtcGwtc2VsZWN0ZWQ9Jyk7XG5cbiAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgLyg8KD86aW5wdXR8SU5QVVQpW14+XSo/KSg/OmNoZWNrZWR8Q0hFQ0tFRCk9L2csXG4gICAgICAgICckMWp0bXBsLWNoZWNrZWQ9Jyk7XG5cbiAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIG1hdGNoRW5kQmxvY2soYmxvY2ssIHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICBpZiAoIXJlRW5kQmxvY2spIHtcbiAgICAgICAgcmVFbmRCbG9jayA9IFJlZ0V4cChcbiAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICtcbiAgICAgICAgICAnXFxcXC8nICsgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICsgJz8nICtcbiAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMV0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB2YXIgbWF0Y2ggPSB0ZW1wbGF0ZS5tYXRjaChyZUVuZEJsb2NrKTtcbiAgICAgIHJldHVybiBtYXRjaCA/XG4gICAgICAgIGJsb2NrID09PSAnJyB8fCAhbWF0Y2hbMV0gfHwgbWF0Y2hbMV0gPT09IGJsb2NrIDpcbiAgICAgICAgZmFsc2U7XG4gICAgfVxuXG5cblxuXG4gICAgdmFyIHRlbXBsYXRlQ2FjaGUgPSBbXTtcbiAgICB2YXIgbmV3Q291bnRlciA9IDA7XG4gICAgdmFyIGNhY2hlSGl0Q291bnRlciA9IDA7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwsIG9wdGlvbnMpIHtcblxuICAgICAgLy8gVmFyaWFibGVzXG5cbiAgICAgIHZhciBpLCBjaGlsZHJlbiwgbGVuLCBhaSwgYWxlbiwgYXR0ciwgdmFsLCBhdHRyUnVsZXMsIHJpLCBhdHRyTmFtZSwgYXR0clZhbDtcbiAgICAgIHZhciBidWZmZXIsIHBvcywgYmVnaW5Qb3MsIGJvZHlCZWdpblBvcywgYm9keSwgbm9kZSwgZWwsIGNvbnRlbnRzLCB0LCBtYXRjaCwgcnVsZSwgdG9rZW4sIGJsb2NrO1xuICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpLCBmcmFnO1xuICAgICAgdmFyIGZyZWFrID0gcmVxdWlyZSgnZnJlYWsnKTtcbiAgICAgIHZhciBpZnJhbWU7XG5cbiAgICAgIC8vIEluaXRcblxuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgcmVxdWlyZSgnLi9kZWZhdWx0LW9wdGlvbnMnKTtcblxuICAgICAgbW9kZWwgPVxuICAgICAgICB0eXBlb2YgbW9kZWwgPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIC8vIEZyZWFrIGluc3RhbmNlXG4gICAgICAgICAgbW9kZWwgOlxuICAgICAgICAgIHR5cGVvZiBtb2RlbCA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgICAgICAgIGZyZWFrKG1vZGVsKSA6XG4gICAgICAgICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgICAgICAgIGZyZWFrKHsnLic6IG1vZGVsfSk7XG5cbiAgICAgIC8vIFRlbXBsYXRlIGNhbiBiZSBhIHN0cmluZyBvciBET00gc3RydWN0dXJlXG4gICAgICBpZiAodGVtcGxhdGUubm9kZVR5cGUpIHtcbiAgICAgICAgYm9keSA9IHRlbXBsYXRlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdjb21waWxlcjogSUZSQU1FIGNvbnN0cnVjdGlvbicpO1xuICAgICAgICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUsIG9wdGlvbnMpO1xuICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgaWZyYW1lLmNvbnRlbnREb2N1bWVudC53cml0ZWxuKCc8IWRvY3R5cGUgaHRtbD5cXG48aHRtbD48Ym9keT4nICsgdGVtcGxhdGUgKyAnPC9ib2R5PjwvaHRtbD4nKTtcbiAgICAgICAgYm9keSA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQuYm9keTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGVtcGxhdGVDYWNoZS5pbmRleE9mKGJvZHkpID09PSAtMSkge1xuICAgICAgICBuZXdDb3VudGVyKys7XG4gICAgICAgIHRlbXBsYXRlQ2FjaGUucHVzaChib2R5KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYWNoZUhpdENvdW50ZXIrKztcbiAgICAgIH1cblxuICAgICAgLy8gSXRlcmF0ZSBjaGlsZCBub2Rlcy5cbiAgICAgIGZvciAoaSA9IDAsIGNoaWxkcmVuID0gYm9keS5jaGlsZE5vZGVzLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGggOyBpIDwgbGVuOyBpKyspIHtcblxuICAgICAgICBub2RlID0gY2hpbGRyZW5baV07XG5cbiAgICAgICAgLy8gU2hhbGxvdyBjb3B5IG9mIG5vZGUgYW5kIGF0dHJpYnV0ZXMgKGlmIGVsZW1lbnQpXG4gICAgICAgIGVsID0gbm9kZS5jbG9uZU5vZGUoZmFsc2UpO1xuXG4gICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGVsKTtcblxuICAgICAgICBzd2l0Y2ggKGVsLm5vZGVUeXBlKSB7XG5cbiAgICAgICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgICAgICBjYXNlIDE6XG5cbiAgICAgICAgICAgIC8vIFJlbWVtYmVyIG1vZGVsXG4gICAgICAgICAgICBlbC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlc1xuICAgICAgICAgICAgZm9yIChhaSA9IDAsIGFsZW4gPSBlbC5hdHRyaWJ1dGVzLmxlbmd0aDsgYWkgPCBhbGVuOyBhaSsrKSB7XG5cbiAgICAgICAgICAgICAgYXR0ciA9IGVsLmF0dHJpYnV0ZXNbYWldO1xuICAgICAgICAgICAgICBhdHRyUnVsZXMgPSBbXTtcbiAgICAgICAgICAgICAgLy8gVW5wcmVmaXggJ2p0bXBsLScgZnJvbSBhdHRyaWJ1dGUgbmFtZSwgaWYgbmVlZGVkXG4gICAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lLmxhc3RJbmRleE9mKCdqdG1wbC0nLCAwKSA9PT0gMCA/XG4gICAgICAgICAgICAgICAgYXR0ci5uYW1lLnNsaWNlKCdqdG1wbC0nLmxlbmd0aCkgOiBhdHRyLm5hbWU7XG4gICAgICAgICAgICAgIGF0dHJWYWwgPSAnJztcbiAgICAgICAgICAgICAgdmFsID0gYXR0ci52YWx1ZTtcbiAgICAgICAgICAgICAgdCA9IHRva2VuaXplcihvcHRpb25zLCAnZycpO1xuXG4gICAgICAgICAgICAgIHdoaWxlICggKG1hdGNoID0gdC5leGVjKHZhbCkpICkge1xuXG4gICAgICAgICAgICAgICAgcnVsZSA9IG1hdGNoUnVsZXMobWF0Y2hbMF0sIGVsLCBhdHRyTmFtZS50b0xvd2VyQ2FzZSgpLCBtb2RlbCwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZSkge1xuXG4gICAgICAgICAgICAgICAgICBhdHRyUnVsZXMucHVzaChydWxlKTtcblxuICAgICAgICAgICAgICAgICAgaWYgKHJ1bGUuYmxvY2spIHtcblxuICAgICAgICAgICAgICAgICAgICBibG9jayA9IG1hdGNoWzBdO1xuICAgICAgICAgICAgICAgICAgICBiZWdpblBvcyA9IG1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICAgICAgICBib2R5QmVnaW5Qb3MgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGNsb3NpbmcgdGFnXG4gICAgICAgICAgICAgICAgICAgIGZvciAoO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIG1hdGNoWzBdLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoID0gdC5leGVjKHZhbCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0aHJvdyAnVW5jbG9zZWQnICsgYmxvY2s7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gUmVwbGFjZSBmdWxsIGJsb2NrIHRhZyBib2R5IHdpdGggcnVsZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgIGF0dHJWYWwgKz1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbC5zbGljZSgwLCBiZWdpblBvcykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgcnVsZS5yZXBsYWNlKGF0dHIudmFsdWUuc2xpY2UoYm9keUJlZ2luUG9zLCBtYXRjaC5pbmRleCkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbC5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKCFydWxlLmJsb2NrICYmIHJ1bGUucmVwbGFjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dHIudmFsdWUgPSBydWxlLnJlcGxhY2U7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChydWxlLmFzeW5jSW5pdCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHJ1bGUuYXN5bmNJbml0LCAwKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFNldCBuZXcgYXR0cmlidXRlIHZhbHVlXG4gICAgICAgICAgICAgIC8vYXR0clZhbCA9IGF0dHJWYWwgfHwgYXR0ci52YWx1ZTtcbiAgICAgICAgICAgICAgLy9lbC5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWwpO1xuXG4gICAgICAgICAgICAgIC8vIEF0dGFjaCBhdHRyaWJ1dGUgbGlzdGVuZXJzIGFuZCB0cmlnZ2VyIGluaXRpYWwgY2hhbmdlXG4gICAgICAgICAgICAgIGZvciAocmkgPSAwOyByaSA8IGF0dHJSdWxlcy5sZW5ndGg7IHJpKyspIHtcbiAgICAgICAgICAgICAgICBydWxlID0gYXR0clJ1bGVzW3JpXTtcbiAgICAgICAgICAgICAgICBpZiAocnVsZS5jaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBydWxlLmJsb2NrIHx8IHJ1bGUucHJvcCwgcnVsZS5jaGFuZ2UpO1xuICAgICAgICAgICAgICAgICAgcnVsZS5jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDbGVhciAnanRtcGwtJy1wcmVmaXhlZCBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBhaSA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoYWkgPCBlbC5hdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBhdHRyID0gZWwuYXR0cmlidXRlc1thaV07XG4gICAgICAgICAgICAgIGlmIChhdHRyLm5hbWUubGFzdEluZGV4T2YoJ2p0bXBsLScsIDApID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIubmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWkrKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICBmcmFnID0gY29tcGlsZShub2RlLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICBpZiAoZnJhZy5jaGlsZE5vZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBlbC5hcHBlbmRDaGlsZChmcmFnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBUZXh0IG5vZGVcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgY29udGVudHMgPSBlbC5kYXRhLnRyaW0oKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoRW5kQmxvY2soJycsIGNvbnRlbnRzLCBvcHRpb25zKSkge1xuICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuZXhwZWN0ZWQgJyArIGNvbnRlbnRzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIChtYXRjaCA9IGNvbnRlbnRzLm1hdGNoKHRva2VuaXplcihvcHRpb25zKSkpICkge1xuXG4gICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKGNvbnRlbnRzLCBub2RlLCBudWxsLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBET00gcmVwbGFjZW1lbnQ/XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucmVwbGFjZS5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlLCBlbCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGFnIGNvbnRlbnRzP1xuICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkrKztcblxuICAgICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIGNoaWxkcmVuW2ldLmRhdGEgfHwgJycsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGRyZW5baV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBjb250ZW50cztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZXBsYWNlIGBlbGAgd2l0aCBgcnVsZS5yZXBsYWNlKClgIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICBlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChydWxlLnJlcGxhY2UoYmxvY2ssIGVsLnBhcmVudE5vZGUpLCBlbCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucHJvcCAmJiBydWxlLmNoYW5nZSkge1xuICAgICAgICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHJ1bGUucHJvcCwgcnVsZS5jaGFuZ2UpO1xuICAgICAgICAgICAgICAgICAgcnVsZS5jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIH0gLy8gc3dpdGNoXG5cbiAgICAgIH0gLy8gZm9yXG5cbiAgICAgLy9jb25zb2xlLmxvZygnbmV3Q291bnRlcjogJyArIG5ld0NvdW50ZXIpO1xuICAgICAvL2NvbnNvbGUubG9nKCdjYWNoZUhpdENvdW50ZXI6ICcgKyBjYWNoZUhpdENvdW50ZXIpO1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH07XG4iLCIvKlxuXG4jIyBDb21waWxlclxuXG5cblxudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbm4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbm4uaW5uZXJIVE1MID0gJzxwIGNsYXNzPVwiY2xhc3N5XCI+PGkgc2VsZWN0ZWQgY2hlY2tlZCBhdHRyPVwiXCI+enp6PC9pPiBvb28gPCEtLSBwZmZmIC0tPiA8L3A+IGhleSA8IS0tIGVlZSAtLT4gaG9lJztcbnQuYXBwZW5kQ2hpbGQobik7XG50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJ2RpdnZ2JykpO1xudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJykpO1xudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnc3Bhbm5uJykpO1xuXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbXBpbGUyKHRlbXBsYXRlLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIHJlc3VsdCA9ICcoZnVuY3Rpb24obW9kZWwpIHsnICtcbiAgICAgICAgJ3ZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpLCBub2RlOyc7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuXG4gICAgICAgIHN3aXRjaCAoY2hpbGROb2Rlc1tpXS5ub2RlVHlwZSkge1xuXG4gICAgICAgICAgLy8gRWxlbWVudCBub2RlXG4gICAgICAgICAgY2FzZSAxOlxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgZWxlbWVudFxuICAgICAgICAgICAgcmVzdWx0ICs9ICdub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIicgKyBjaGlsZE5vZGVzW2ldLm5vZGVOYW1lICsgJ1wiKTsnO1xuXG4gICAgICAgICAgICAvLyBDbG9uZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBmb3IgKHZhciBhaSA9IDAsIGF0dHJpYnV0ZXMgPSBjaGlsZE5vZGVzW2ldLmF0dHJpYnV0ZXMsIGFsZW4gPSBhdHRyaWJ1dGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhaSA8IGFsZW47IGFpKyspIHtcbiAgICAgICAgICAgICAgcmVzdWx0ICs9ICdub2RlLnNldEF0dHJpYnV0ZShcIicgK1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNbYWldLm5hbWUgK1xuICAgICAgICAgICAgICAgICdcIiwgJyArXG4gICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYXR0cmlidXRlc1thaV0udmFsdWUpICtcbiAgICAgICAgICAgICAgICAnKTsnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICByZXN1bHQgKz0gJ25vZGUuYXBwZW5kQ2hpbGQoJyArIGNvbXBpbGUyKGNoaWxkTm9kZXNbaV0sIG1vZGVsLCBvcHRpb25zKSArICcoKSk7JztcblxuICAgICAgICAgICAgLy8gQXBwZW5kIHRvIGZyYWdtZW50XG4gICAgICAgICAgICByZXN1bHQgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7JztcbiAgICAgICAgICAgIGJyZWFrO1xuXG5cbiAgICAgICAgICAvLyBUZXh0IG5vZGVcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICByZXN1bHQgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCInICsgY2hpbGROb2Rlc1tpXS5kYXRhICsgJ1wiKSk7JztcbiAgICAgICAgICAgIGJyZWFrO1xuXG5cbiAgICAgICAgICAvLyBDb21tZW50IG5vZGVcbiAgICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgICByZXN1bHQgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlQ29tbWVudChcIicgKyBjaGlsZE5vZGVzW2ldLmRhdGEgKyAnXCIpKTsnO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgfSAvLyBlbmQgc3dpdGNoXG4gICAgICB9IC8vIGVuZCBpdGVyYXRlIGNoaWxkTm9kZXNcblxuICAgICAgIHJlc3VsdCArPSAncmV0dXJuIGZyYWc7IH0pJztcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4iLCIvKlxuXG4jIyBDb25zdGFudHNcblxuKi9cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJlLXF1b3RlZFwiXG4gICAgUkVfUEFSVElBTDogLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8sXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0VORFNfV0lUSF9OT0RFX0lEOiAvLisoI1tcXHdcXC5cXC1dKykkLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qIVxuICogY29udGVudGxvYWRlZC5qc1xuICpcbiAqIEF1dGhvcjogRGllZ28gUGVyaW5pIChkaWVnby5wZXJpbmkgYXQgZ21haWwuY29tKVxuICogU3VtbWFyeTogY3Jvc3MtYnJvd3NlciB3cmFwcGVyIGZvciBET01Db250ZW50TG9hZGVkXG4gKiBVcGRhdGVkOiAyMDEwMTAyMFxuICogTGljZW5zZTogTUlUXG4gKiBWZXJzaW9uOiAxLjJcbiAqXG4gKiBVUkw6XG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9cbiAqIGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9Db250ZW50TG9hZGVkL01JVC1MSUNFTlNFXG4gKlxuICovXG5cbi8vIEB3aW4gd2luZG93IHJlZmVyZW5jZVxuLy8gQGZuIGZ1bmN0aW9uIHJlZmVyZW5jZVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb250ZW50TG9hZGVkKHdpbiwgZm4pIHtcblxuXHR2YXIgZG9uZSA9IGZhbHNlLCB0b3AgPSB0cnVlLFxuXG5cdGRvYyA9IHdpbi5kb2N1bWVudCxcblx0cm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQsXG5cdG1vZGVybiA9IGRvYy5hZGRFdmVudExpc3RlbmVyLFxuXG5cdGFkZCA9IG1vZGVybiA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCcsXG5cdHJlbSA9IG1vZGVybiA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdkZXRhY2hFdmVudCcsXG5cdHByZSA9IG1vZGVybiA/ICcnIDogJ29uJyxcblxuXHRpbml0ID0gZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLnR5cGUgPT0gJ3JlYWR5c3RhdGVjaGFuZ2UnICYmIGRvYy5yZWFkeVN0YXRlICE9ICdjb21wbGV0ZScpIHJldHVybjtcblx0XHQoZS50eXBlID09ICdsb2FkJyA/IHdpbiA6IGRvYylbcmVtXShwcmUgKyBlLnR5cGUsIGluaXQsIGZhbHNlKTtcblx0XHRpZiAoIWRvbmUgJiYgKGRvbmUgPSB0cnVlKSkgZm4uY2FsbCh3aW4sIGUudHlwZSB8fCBlKTtcblx0fSxcblxuXHRwb2xsID0gZnVuY3Rpb24oKSB7XG5cdFx0dHJ5IHsgcm9vdC5kb1Njcm9sbCgnbGVmdCcpOyB9IGNhdGNoKGUpIHsgc2V0VGltZW91dChwb2xsLCA1MCk7IHJldHVybjsgfVxuXHRcdGluaXQoJ3BvbGwnKTtcblx0fTtcblxuXHRpZiAoZG9jLnJlYWR5U3RhdGUgPT0gJ2NvbXBsZXRlJykgZm4uY2FsbCh3aW4sICdsYXp5Jyk7XG5cdGVsc2Uge1xuXHRcdGlmICghbW9kZXJuICYmIHJvb3QuZG9TY3JvbGwpIHtcblx0XHRcdHRyeSB7IHRvcCA9ICF3aW4uZnJhbWVFbGVtZW50OyB9IGNhdGNoKGUpIHsgfVxuXHRcdFx0aWYgKHRvcCkgcG9sbCgpO1xuXHRcdH1cblx0XHRkb2NbYWRkXShwcmUgKyAnRE9NQ29udGVudExvYWRlZCcsIGluaXQsIGZhbHNlKTtcblx0XHRkb2NbYWRkXShwcmUgKyAncmVhZHlzdGF0ZWNoYW5nZScsIGluaXQsIGZhbHNlKTtcblx0XHR3aW5bYWRkXShwcmUgKyAnbG9hZCcsIGluaXQsIGZhbHNlKTtcblx0fVxuXG59O1xuIiwiLypcbiAgXG5EZWZhdWx0IG9wdGlvbnNcblxuKi9cbiAgICBcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgIGRlbGltaXRlcnM6IFsne3snLCAnfX0nXVxuICAgIH07XG4iLCIvKlxuXG5FdmFsdWF0ZSBvYmplY3QgZnJvbSBsaXRlcmFsIG9yIENvbW1vbkpTIG1vZHVsZVxuXG4qL1xuXG4gICAgLyoganNoaW50IGV2aWw6dHJ1ZSAqL1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBzcmMsIG1vZGVsKSB7XG5cbiAgICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuXG4gICAgICBtb2RlbCA9IG1vZGVsIHx8IHt9O1xuICAgICAgaWYgKHR5cGVvZiBtb2RlbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBtb2RlbCA9IGp0bXBsKG1vZGVsKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgIGlmICgvLyBQbHVnaW5cbiAgICAgICAgICAgICAgKHByb3AuaW5kZXhPZignX18nKSA9PT0gMCAmJlxuICAgICAgICAgICAgICAgIHByb3AubGFzdEluZGV4T2YoJ19fJykgPT09IHByb3AubGVuZ3RoIC0gMikgfHxcbiAgICAgICAgICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHlcbiAgICAgICAgICAgICAgdHlwZW9mIHByb3BlcnRpZXNbcHJvcF0gPT09ICdmdW5jdGlvbidcbiAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgIGlmICh0YXJnZXQudmFsdWVzW3Byb3BdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0LnZhbHVlc1twcm9wXSA9IHByb3BlcnRpZXNbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gVGFyZ2V0IGRvZXNuJ3QgYWxyZWFkeSBoYXZlIHByb3A/XG4gICAgICAgICAgICBpZiAodGFyZ2V0KHByb3ApID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0KHByb3AsIHByb3BlcnRpZXNbcHJvcF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBhcHBseVBsdWdpbnMoKSB7XG4gICAgICAgIHZhciBwcm9wLCBhcmc7XG4gICAgICAgIGZvciAocHJvcCBpbiBqdG1wbC5wbHVnaW5zKSB7XG4gICAgICAgICAgcGx1Z2luID0ganRtcGwucGx1Z2luc1twcm9wXTtcbiAgICAgICAgICBhcmcgPSBtb2RlbC52YWx1ZXNbJ19fJyArIHByb3AgKyAnX18nXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHBsdWdpbiA9PT0gJ2Z1bmN0aW9uJyAmJiBhcmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcGx1Z2luLmNhbGwobW9kZWwsIGFyZywgdGFyZ2V0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZXZhbE9iamVjdChib2R5LCBzcmMpIHtcbiAgICAgICAgdmFyIHJlc3VsdCwgbW9kdWxlID0geyBleHBvcnRzOiB7fSB9O1xuICAgICAgICBzcmMgPSBzcmMgP1xuICAgICAgICAgICdcXG4vL0Agc291cmNlVVJMPScgKyBzcmMgK1xuICAgICAgICAgICdcXG4vLyMgc291cmNlVVJMPScgKyBzcmMgOlxuICAgICAgICAgICcnO1xuICAgICAgICBpZiAoYm9keS5tYXRjaCgvXlxccyp7W1xcU1xcc10qfVxccyokLykpIHtcbiAgICAgICAgICAvLyBMaXRlcmFsXG4gICAgICAgICAgcmV0dXJuIGV2YWwoJ3Jlc3VsdD0nICsgYm9keSArIHNyYyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29tbW9uSlMgbW9kdWxlXG4gICAgICAgIGV2YWwoYm9keSArIHNyYyk7XG4gICAgICAgIHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZE1vZGVsKHNyYywgdGVtcGxhdGUsIGRvYykge1xuICAgICAgICB2YXIgaGFzaEluZGV4O1xuICAgICAgICBpZiAoIXNyYykge1xuICAgICAgICAgIC8vIE5vIHNvdXJjZVxuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzcmMubWF0Y2goY29uc3RzLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gRWxlbWVudCBpbiB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KGVsZW1lbnQuaW5uZXJIVE1MLCBzcmMpKTtcbiAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgbW9kZWwgdmlhIFhIUlxuICAgICAgICAgIC8vIE9sZGVyIElFcyBjb21wbGFpbiBpZiBVUkwgY29udGFpbnMgaGFzaFxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChjb25zdHMuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IG1hdGNoICYmIG5ldyBET01QYXJzZXIoKVxuICAgICAgICAgICAgICAgIC5wYXJzZUZyb21TdHJpbmcocmVzcCwgJ3RleHQvaHRtbCcpXG4gICAgICAgICAgICAgICAgLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuICAgICAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCwgc3JjKSk7XG4gICAgICAgICAgICAgIGFwcGx5UGx1Z2lucygpO1xuICAgICAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBsb2FkVGVtcGxhdGUoKSB7XG4gICAgICAgIHZhciBoYXNoSW5kZXg7XG5cbiAgICAgICAgaWYgKCFzcmMpIHJldHVybjtcblxuICAgICAgICBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIGlzIHRoZSBjb250ZW50cyBvZiBlbGVtZW50XG4gICAgICAgICAgLy8gYmVsb25naW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBsb2FkTW9kZWwoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSwgZWxlbWVudC5pbm5lckhUTUwsIGRvY3VtZW50KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCB0ZW1wbGF0ZSB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLFxuICAgICAgICAgICAgZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGlmcmFtZSwgZG9jO1xuICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgICAgICAgICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgICAgZG9jID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudDtcbiAgICAgICAgICAgICAgICBkb2Mud3JpdGVsbihyZXNwKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jID0gZG9jdW1lbnQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBkb2MucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG5cbiAgICAgICAgICAgICAgbG9hZE1vZGVsKFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSA6ICcnLFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLFxuICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9hZFRlbXBsYXRlKCk7XG4gICAgfTtcbiIsIi8qXG5cbiMjIE1haW4gZnVuY3Rpb25cblxuKi9cbiAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgIGZ1bmN0aW9uIGp0bXBsKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgdGFyZ2V0LCB0LCB0ZW1wbGF0ZSwgbW9kZWw7XG5cbiAgICAgIC8vIGp0bXBsKCdIVFRQX01FVEhPRCcsIHVybFssIHBhcmFtZXRlcnNbLCBjYWxsYmFja1ssIG9wdGlvbnNdXV0pP1xuICAgICAgaWYgKFsnR0VUJywgJ1BPU1QnXS5pbmRleE9mKGFyZ3NbMF0pID4gLTEpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJy4veGhyJykuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKG9iamVjdCk/XG4gICAgICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gcmV0dXJuIEZyZWFrIGluc3RhbmNlXG4gICAgICAgIHJldHVybiByZXF1aXJlKCdmcmVhaycpKGFyZ3NbMF0pO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQpP1xuICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIHJldHVybiBtb2RlbFxuICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKS5fX2p0bXBsX187XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsWywgb3B0aW9uc10pP1xuICAgICAgZWxzZSBpZiAoXG4gICAgICAgICggYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlIHx8XG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgICggKGFyZ3NbMV0gJiYgdHlwZW9mIGFyZ3NbMV0uYXBwZW5kQ2hpbGQgPT09ICdmdW5jdGlvbicpIHx8XG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzFdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgIGFyZ3NbMl0gIT09IHVuZGVmaW5lZFxuXG4gICAgICApIHtcblxuICAgICAgICB0YXJnZXQgPSBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgID9cbiAgICAgICAgICBhcmdzWzBdIDpcbiAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMF0pO1xuXG4gICAgICAgIHRlbXBsYXRlID0gYXJnc1sxXS5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1sxXSkuaW5uZXJIVE1MIDpcbiAgICAgICAgICBhcmdzWzFdO1xuXG4gICAgICAgIG1vZGVsID1cbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAvLyBhbHJlYWR5IHdyYXBwZWRcbiAgICAgICAgICAgIGFyZ3NbMl0gOlxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHdyYXBcbiAgICAgICAgICAgIGp0bXBsLmZyZWFrKFxuICAgICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgIC8vIG9iamVjdFxuICAgICAgICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMl0ubWF0Y2goY29uc3RzLlJFX05PREVfSUQpID9cbiAgICAgICAgICAgICAgICAgIC8vIHNyYywgbG9hZCBpdFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZSgnLi9sb2FkZXInKVxuICAgICAgICAgICAgICAgICAgICAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzJdKS5pbm5lckhUTUwpIDpcblxuICAgICAgICAgICAgICAgICAgLy8gc2ltcGxlIHZhbHVlLCBib3ggaXRcbiAgICAgICAgICAgICAgICAgIHsnLic6IGFyZ3NbMl19XG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGlmICh0YXJnZXQubm9kZU5hbWUgPT09ICdTQ1JJUFQnKSB7XG4gICAgICAgICAgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIHQuaWQgPSB0YXJnZXQuaWQ7XG4gICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHQsIHRhcmdldCk7XG4gICAgICAgICAgdGFyZ2V0ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc29jaWF0ZSB0YXJnZXQgYW5kIG1vZGVsXG4gICAgICAgIHRhcmdldC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgICAgICAvLyBFbXB0eSB0YXJnZXRcbiAgICAgICAgdGFyZ2V0LmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQocmVxdWlyZSgnLi9jb21waWxlcicpKHRlbXBsYXRlLCBtb2RlbCwgYXJnc1szXSkpO1xuICAgICAgfVxuICAgIH1cblxuXG5cbi8qXG5cbk9uIHBhZ2UgcmVhZHksIHByb2Nlc3MganRtcGwgdGFyZ2V0c1xuXG4qL1xuXG4gICAgcmVxdWlyZSgnLi9jb250ZW50LWxvYWRlZCcpKHdpbmRvdywgZnVuY3Rpb24oKSB7XG5cbiAgICAgIHZhciBsb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xuICAgICAgdmFyIHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qdG1wbF0nKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRhcmdldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgbG9hZGVyKHRhcmdldHNbaV0sIHRhcmdldHNbaV0uZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJykpO1xuICAgICAgfVxuICAgIH0pO1xuXG5cblxuLypcblxuRXhwb3NlIG5ldy1nZW5lcmF0aW9uIGNvbXBpbGVyIGZvciBleHBlcmltZW50aW5nXG5cbiovXG5cbiAgICBqdG1wbC5jb21waWxlMiA9IHJlcXVpcmUoJy4vY29tcGlsZXIyJyk7XG5cblxuLypcblxuUGx1Z2luc1xuXG4qL1xuXG4gICAganRtcGwucGx1Z2lucyA9IHtcbiAgICAgIGluaXQ6IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAvLyBDYWxsIGFzeW5jLCBhZnRlciBqdG1wbCBoYXMgY29uc3RydWN0ZWQgdGhlIERPTVxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhcmcuY2FsbCh0aGF0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cblxuLypcblxuRXhwb3J0XG5cbiovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBqdG1wbDtcbiIsIi8qXG5cbiMjIFJ1bGVzXG5cbkVhY2ggcnVsZSBpcyBhIGZ1bmN0aW9uLCBhcmdzIHdoZW4gY2FsbGVkIGFyZTpcbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKVxuXG50YWc6IHRleHQgYmV0d2VlbiBkZWxpbWl0ZXJzLCB7e3RhZ319XG5ub2RlOiBET00gbm9kZSwgd2hlcmUgdGFnIGlzIGZvdW5kXG5hdHRyOiBub2RlIGF0dHJpYnV0ZSBvciBudWxsLCBpZiBub2RlIGNvbnRlbnRzXG5tb2RlbDogRnJlYWsgbW9kZWxcbm9wdGlvbnM6IGNvbmZpZ3VyYXRpb24gb3B0aW9uc1xuXG5JdCBtdXN0IHJldHVybiBlaXRoZXI6XG5cbiogZmFsc3kgdmFsdWUgLSBubyBtYXRjaFxuXG4qIG9iamVjdCAtIG1hdGNoIGZvdW5kLCByZXR1cm4gKGFsbCBmaWVsZHMgb3B0aW9uYWwpXG5cbiAgICAge1xuICAgICAgIC8vIFBhcnNlIHVudGlsIHt7L319IG9yIHt7L3NvbWVQcm9wfX0gLi4uXG4gICAgICAgYmxvY2s6ICdzb21lUHJvcCcsXG5cbiAgICAgICAvLyAuLi4gdGhlbiB0aGlzIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkLlxuICAgICAgIC8vIEl0IG11c3QgcmV0dXJuIHN0cmluZyBvciBET01FbGVtZW50XG4gICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCwgcGFyZW50KSB7IC4uLiB9XG4gICAgIH1cblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gW1xuICAgICAgcmVxdWlyZSgnLi9ydWxlcy92YWx1ZS12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvY2hlY2tlZC12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VsZWN0ZWQtdmFyJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL2NsYXNzLXNlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9pbnZlcnRlZC1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3BhcnRpYWwnKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdW5lc2NhcGVkLXZhcicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy92YXInKVxuICAgIF07XG4iLCIvKlxuXG4jIyMgY2hlY2tlZD1cInt7dmFsfX1cIlxuXG5IYW5kbGUgXCJjaGVja2VkXCIgYXR0cmlidXRlXG5cbiovXG5cbiAgICB2YXIgcmFkaW9Hcm91cHMgPSB7fTtcbiAgICAvLyBDdXJyZW50bHkgdXBkYXRpbmc/XG4gICAgdmFyIHVwZGF0aW5nID0gZmFsc2U7XG5cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX0lERU5USUZJRVIpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFswXTtcblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICBpZiAodXBkYXRpbmcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUubmFtZSkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQgPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdW2ldKHByb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgYXR0ciA9PT0gJ2NoZWNrZWQnKSB7XG4gICAgICAgIC8vIHJhZGlvIGdyb3VwP1xuICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgIGlmICghcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgLy8gSW5pdCByYWRpbyBncm91cCAoWzBdOiBub2RlLCBbMV06IG1vZGVsKVxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBBZGQgaW5wdXQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgLy8gQWRkIGNvbnRleHQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdLnB1c2gobW9kZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICB1cGRhdGluZyA9IHRydWU7XG4gICAgICAgICAgICAvLyBVcGRhdGUgYWxsIGlucHV0cyBmcm9tIHRoZSBncm91cFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wLCByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXBkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiAnJyxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZSxcbiAgICAgICAgICBhc3luY0luaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwudHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyBjbGFzcz1cInt7I2lmQ29uZGl0aW9ufX1zb21lLWNsYXNze3svfX1cIlxuXG5Ub2dnbGVzIGNsYXNzIGBzb21lLWNsYXNzYCBpbiBzeW5jIHdpdGggYm9vbGVhbiBgbW9kZWwuaWZDb25kaXRpb25gXG5cblxuIyMjIGNsYXNzPVwie3tebm90SWZDb25kaXRpb259fXNvbWUtY2xhc3N7ey99fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIG5vdCBgbW9kZWwubm90SWZDb25kaXRpb25gXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChuZXcgUmVnRXhwKCcoI3xcXFxcXiknICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBpbnZlcnRlZCA9IG1hdGNoICYmIChtYXRjaFsxXSA9PT0gJ14nKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMl07XG4gICAgICB2YXIga2xhc3M7XG5cblxuICAgICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgbWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgICAgIFsoaW52ZXJ0ZWQgPT09ICF2YWwpICYmICdhZGQnIHx8ICdyZW1vdmUnXShrbGFzcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7e15pbnZlcnRlZC1zZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXlxcXFxeJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzFdO1xuICAgICAgdmFyIHRlbXBsYXRlO1xuICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBjaGFuZ2UpO1xuICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgY2hhbmdlKTtcbiAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICBpZiAodmFsLmxlbiA9PT0gMCkge1xuICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIHZhbChpKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghdmFsKSB7XG4gICAgICAgICAgICByZW5kZXIgPSBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIGlmIChtYXRjaCAmJiAhYXR0cikge1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAgIHRlbXBsYXRlID0gdG1wbDtcbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG5cbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMgUGFydGlhbFxuXG4qIHt7PlwiI2lkXCJ9fVxuKiB7ez5cInVybFwifX1cbioge3s+XCJ1cmwjaWRcIn19XG4qIHt7PnBhcnRpYWxTcmN9fVxuXG5SZXBsYWNlcyBwYXJlbnQgdGFnIGNvbnRlbnRzLCBhbHdheXMgd3JhcCBpbiBhIHRhZ1xuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2goY29uc3RzLlJFX1BBUlRJQUwpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIHRhcmdldDtcblxuICAgICAgdmFyIGxvYWRlciA9IG1hdGNoICYmXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICB0YXJnZXQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVxdWlyZSgnLi4vbG9hZGVyJykoXG4gICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICBtYXRjaFsxXSA/XG4gICAgICAgICAgICAgIC8vIFZhcmlhYmxlXG4gICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICAgICAgbWF0Y2hbMl0gfHwgbWF0Y2hbM10sXG4gICAgICAgICAgICBtb2RlbFxuICAgICAgICAgIClcbiAgICAgICAgfTtcblxuICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgbWF0Y2hbMV0sIGxvYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBMb2FkIGFzeW5jXG4gICAgICAgIHNldFRpbWVvdXQobG9hZGVyLCAwKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlcGxhY2U6IGFuY2hvclxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7eyNzZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgdGVtcGxhdGU7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgcGFyZW50LnJlcGxhY2VDaGlsZChcbiAgICAgICAgICAgIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGkpKSxcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaW5kZXggKyBpKSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShmcmFnbWVudCwgcGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgIGxlbmd0aCA9IGxlbmd0aCArIHNpemU7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGRlbChpbmRleCwgY291bnQpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBzaXplID0gY291bnQgKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcblxuICAgICAgICBsZW5ndGggPSBsZW5ndGggLSBzaXplO1xuXG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICB2YXIgdmFsID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcbiAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFycmF5P1xuICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGluc2VydCk7XG4gICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC5sZW47IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFsLm9uKCdjaGFuZ2UnLCBpLCB1cGRhdGUoaSkpO1xuICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIHZhbChpKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJlbmRlciA9IGNvbXBpbGUodGVtcGxhdGUsIHZhbCk7XG4gICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKCEhdmFsKSB7XG4gICAgICAgICAgICByZW5kZXIgPSBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAgIHRlbXBsYXRlID0gdG1wbDtcblxuICAgICAgICAgICAgcmV0dXJuIGFuY2hvcjtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcblxuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyBzZWxlY3RlZD1cInt7dmFsfX1cIlxuXG5IYW5kbGUgXCJzZWxlY3RlZFwiIGF0dHJpYnV0ZVxuXG4qL1xuXG4gICAgdmFyIHNlbGVjdHMgPSBbXTtcbiAgICB2YXIgc2VsZWN0T3B0aW9ucyA9IFtdO1xuICAgIHZhciBzZWxlY3RPcHRpb25zQ29udGV4dHMgPSBbXTtcbiAgICAvLyBDdXJyZW50bHkgdXBkYXRpbmc/IEluaXRpYWxpemVkIHRvIHRydWUgdG8gYXZvaWQgc3luYyBpbml0XG4gICAgdmFyIHVwZGF0aW5nID0gdHJ1ZTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX0lERU5USUZJRVIpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFswXTtcblxuICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICBpZiAodXBkYXRpbmcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICBmb3IgKHZhciBqID0gMCwgbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXVtqXS5zZWxlY3RlZCA9IHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtqXShwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbm9kZS5zZWxlY3RlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXRjaCAmJiBhdHRyID09PSAnc2VsZWN0ZWQnKSB7XG4gICAgICAgIC8vIDxzZWxlY3Q+IG9wdGlvbj9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgLy8gUHJvY2VzcyBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgLy8gQWRkIDxzZWxlY3Q+IHRvIGxpc3RcbiAgICAgICAgICAgICAgaSA9IHNlbGVjdHMucHVzaChub2RlLnBhcmVudE5vZGUpIC0gMTtcbiAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zXG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnMucHVzaChbXSk7XG4gICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9ucyBjb250ZXh0c1xuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHMucHVzaChbXSk7XG4gICAgICAgICAgICAgIC8vIEF0dGFjaCBjaGFuZ2UgbGlzdGVuZXJcbiAgICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHVwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBvaSA9IDAsIG9sZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgb2kgPCBvbGVuOyBvaSsrKSB7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bb2ldKHByb3AsIHNlbGVjdE9wdGlvbnNbaV1bb2ldLnNlbGVjdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdXBkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBSZW1lbWJlciBvcHRpb24gYW5kIGNvbnRleHRcbiAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwocHJvcCwgdGhpcy5zZWxlY3RlZCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2UsXG4gICAgICAgICAgYXN5bmNJbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBtb2RlbC50cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7JnZhcn19XG5cbihge3t7dmFyfX19YCBpcyByZXBsYWNlZCBvbiBwcmVwcm9jZXNzaW5nIHN0ZXApXG5cbkNhbiBiZSBib3VuZCB0byBub2RlIGlubmVySFRNTFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiYnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgaWYgKG1hdGNoICYmICFhdHRyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiBhbmNob3IsXG4gICAgICAgICAgY2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgICAgIHZhciBpO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHZhbHVlXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbC5jaGlsZE5vZGVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShmcmFnbWVudCwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHZhbHVlPVwie3t2YWx9fVwiXG5cbkhhbmRsZSBcInZhbHVlXCIgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgYXR0ciA9PT0gJ3ZhbHVlJykge1xuICAgICAgICAvLyB0ZXh0IGlucHV0P1xuICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICdrZXl1cCcgOiAnY2hhbmdlJzsgLy8gSUU5IGluY29yZWN0bHkgcmVwb3J0cyBpdCBzdXBwb3J0cyBpbnB1dCBldmVudFxuXG4gICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3t2YXJ9fVxuXG5DYW4gYmUgYm91bmQgdG8gdGV4dCBub2RlIGRhdGEgb3IgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciByZWFjdCwgdGFyZ2V0LCBjaGFuZ2U7XG5cbiAgICAgIGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbC52YWx1ZXMpIDpcbiAgICAgICAgICB2YWw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUikpIHtcblxuICAgICAgICBpZiAoYXR0cikge1xuICAgICAgICAgIC8vIEF0dHJpYnV0ZVxuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGdldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbCA/XG4gICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbCkgOlxuICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgICAgICBjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRhcmdldC5kYXRhID0gZ2V0KCkgfHwgJyc7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1hdGNoIGZvdW5kXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogdGFnLFxuICAgICAgICAgIHJlcGxhY2U6IHRhcmdldCxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkge1xuICAgICAgICAgICAgb25sb2FkLmNhbGwodGhpcywgJ2RvbmUnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnanRtcGwgWEhSIGVycm9yOiAnICsgdGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSxcbiAgICAgICAgb3B0cy51c2VyLCBvcHRzLnBhc3N3b3JkKTtcblxuICAgICAgeGhyLnNlbmQocmVxdWVzdCk7XG5cbiAgICAgIHJldHVybiB4aHI7XG5cbiAgICB9O1xuIl19
(9)
});
