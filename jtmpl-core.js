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
  var dependents = {};
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

  // Update handler: recalculate dependent properties,
  // trigger change if necessary
  function update(prop, innerProp) {
    if (!deepEqual(cache[prop], get(prop))) {
      trigger('change', prop);
    }

    // Notify dependents
    for (var i = 0, dep = dependents[prop] || [], len = dep.length;
        i < len; i++) {
      delete children[dep[i]];
      instance.trigger('update', dep[i]);
    }

    if (instance.parent) {
      // Notify computed properties, depending on parent object
      instance.parent.trigger('update', instance.prop, prop);
    }
  }

  // Proxy the accessor function to record
  // all accessed properties
  function getDependencyTracker(prop) {
    return function(_prop, _arg) {
      if (!dependents[_prop]) {
        dependents[_prop] = [];
      }
      if (dependents[_prop].indexOf(prop) === -1) {
        dependents[_prop].push(prop);
      }
      return accessor(_prop, _arg);
    }
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

  // Create freak instance
  var instance = function() {
    return accessor.apply(null, arguments);
  };

  // Attach instance properties
  mixin(instance, {
    values: obj,
    parent: parent || null,
    root: root || instance,
    prop: prop || null,
    // .on(event[, prop], callback)
    on: on,
    // .off(event[, prop][, callback])
    off: off,
    // .trigger(event[, prop])
    trigger: trigger
  });

  // Wrap mutating array method to update
  // state and notify listeners
  function wrapArrayMethod(method, func) {
    return function() {
      var result = [][method].apply(obj, arguments);
      this.len = this.values.length;
      func.apply(this, arguments);
      instance.parent.trigger('update', instance.prop);
      return result;
    };
  }

  if (Array.isArray(obj)) {
    mixin(instance, {
      // Function prototype already contains length
      // This specifies array length
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

  on('update', update);

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
          block === '' || match[1] === undefined || match[1] === block :
          false;
      }


      // Variables

      var i, children, len, ai, alen, attr, val, attrRules, ri, attrVal;
      var buffer, pos, beginPos, bodyBeginPos, body, node, el, t, match, rule, token, block;
      var fragment = document.createDocumentFragment(), frag;
      var freak = _dereq_('freak');

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

        body = document.createElement('body');
        body.innerHTML = template;
      }

      // Iterate child nodes.
      for (i = 0, children = body.childNodes, len = children.length ; i < len; i++) {

        node = children[i];

        // Shallow copy of node and attributes (if element)
        el = node.cloneNode(false);

        fragment.appendChild(el);

        switch (node.nodeType) {

          // Element node
          case 1:

            // Remember model
            fragment.__jtmpl__ = model;

            // Check attributes
            for (ai = 0, alen = el.attributes ? el.attributes.length : 0; ai < alen; ai++) {

              attr = el.attributes[ai];
              attrRules = [];
              attrVal = '';
              val = attr.value;
              t = tokenizer(options, 'g');

              while ( (match = t.exec(val)) ) {

                rule = matchRules(match[0], el, attr.name, model, options);

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
        return (body.match(/^\s*{[\S\s]*}\s*$/)) ?
          // Literal
          eval('(function(){ var result=' + body + '; return result})()' + src) :
          // CommonJS module
          // "0," is black magic for IE8, check http://stackoverflow.com/a/7202038
          eval(
            '0, (function(module, exports){' +
            body +
            ';return module.exports})' +
            src
          )(module, module.exports);
      }

      function loadModel(src, template, doc) {
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
          // Get model via XHR
          jtmpl('GET', src, function (resp) {
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
        if (!src) return;

        if (src.match(consts.RE_NODE_ID)) {
          // Template is the contents of element
          // belonging to this document
          var element = document.querySelector(src);
          loadModel(element.getAttribute('data-model'), element.innerHTML, document);
        }
        else {
          // Get template via XHR
          jtmpl('GET', src, function(resp) {
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

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(new RegExp('#' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var prop = match && match[1];
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
              [!!val && 'add' || 'remove'](klass);
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
                  inputs[i].dispatchEvent(new Event('change'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2VsZW1lbnQtY2xhc3MvaW5kZXguanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbXBpbGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29uc3RzLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29udGVudC1sb2FkZWQuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9kZWZhdWx0LW9wdGlvbnMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9sb2FkZXIuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9tYWluLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9jbGFzcy1zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3BhcnRpYWwuanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9zZWN0aW9uLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdW5lc2NhcGVkLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3ZhbHVlLXZhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3Zhci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRzKSB7XG4gIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG59XG5cbmZ1bmN0aW9uIEVsZW1lbnRDbGFzcyhvcHRzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBFbGVtZW50Q2xhc3MpKSByZXR1cm4gbmV3IEVsZW1lbnRDbGFzcyhvcHRzKVxuICB2YXIgc2VsZiA9IHRoaXNcbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cblxuICAvLyBzaW1pbGFyIGRvaW5nIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgYnV0IHdvcmtzIGluIElFOFxuICBpZiAob3B0cy5ub2RlVHlwZSkgb3B0cyA9IHtlbDogb3B0c31cblxuICB0aGlzLm9wdHMgPSBvcHRzXG4gIHRoaXMuZWwgPSBvcHRzLmVsIHx8IGRvY3VtZW50LmJvZHlcbiAgaWYgKHR5cGVvZiB0aGlzLmVsICE9PSAnb2JqZWN0JykgdGhpcy5lbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy5lbClcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZVxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIGlmIChjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xKSByZXR1cm4gY2xhc3Nlc1xuICBjbGFzc2VzLnB1c2goY2xhc3NOYW1lKVxuICBlbC5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKVxuICByZXR1cm4gY2xhc3Nlc1xufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICB2YXIgaWR4ID0gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSlcbiAgaWYgKGlkeCA+IC0xKSBjbGFzc2VzLnNwbGljZShpZHgsIDEpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgcmV0dXJuIGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTFcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnJlYWsob2JqLCByb290LCBwYXJlbnQsIHByb3ApIHtcblxuICB2YXIgbGlzdGVuZXJzID0ge1xuICAgICdjaGFuZ2UnOiB7fSxcbiAgICAndXBkYXRlJzoge30sXG4gICAgJ2luc2VydCc6IHt9LFxuICAgICdkZWxldGUnOiB7fVxuICB9O1xuICB2YXIgZGVwZW5kZW50cyA9IHt9O1xuICB2YXIgY2FjaGUgPSB7fTtcbiAgdmFyIGNoaWxkcmVuID0ge307XG5cbiAgLy8gQXNzZXJ0IGNvbmRpdGlvblxuICBmdW5jdGlvbiBhc3NlcnQoY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICB0aHJvdyBtc2cgfHwgJ2Fzc2VydGlvbiBmYWlsZWQnO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1peCBwcm9wZXJ0aWVzIGludG8gdGFyZ2V0XG4gIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BlcnRpZXMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W3Byb3BzW2ldXSA9IHByb3BlcnRpZXNbcHJvcHNbaV1dO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZXBFcXVhbCh4LCB5KSB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwgJiZcbiAgICAgICAgdHlwZW9mIHkgPT09IFwib2JqZWN0XCIgJiYgeSAhPT0gbnVsbCkge1xuXG4gICAgICBpZiAoT2JqZWN0LmtleXMoeCkubGVuZ3RoICE9PSBPYmplY3Qua2V5cyh5KS5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBwcm9wIGluIHgpIHtcbiAgICAgICAgaWYgKHkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh4W3Byb3BdLCB5W3Byb3BdKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHggIT09IHkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIEV2ZW50IGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBvbigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSBbJ3N0cmluZycsICdudW1iZXInXS5pbmRleE9mKHR5cGVvZiBhcmd1bWVudHNbMV0pID4gLTEgP1xuICAgICAgYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG5cbiAgICAvLyBBcmdzIGNoZWNrXG4gICAgYXNzZXJ0KFsnY2hhbmdlJywgJ3VwZGF0ZScsICdpbnNlcnQnLCAnZGVsZXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSk7XG4gICAgYXNzZXJ0KFxuICAgICAgKFsnY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wICE9PSBudWxsKSB8fFxuICAgICAgKFsnaW5zZXJ0JywgJ2RlbGV0ZScsICd1cGRhdGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgPT09IG51bGwpXG4gICAgKTtcblxuICAgIC8vIEluaXQgbGlzdGVuZXJzIGZvciBwcm9wXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIC8vIEFscmVhZHkgcmVnaXN0ZXJlZD9cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCBvciBzcGVjaWZpZWQgbGlzdGVuZXJzIGdpdmVuIGV2ZW50IGFuZCBwcm9wZXJ0eVxuICBmdW5jdGlvbiBvZmYoKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcbiAgICB2YXIgaTtcblxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwcm9wZXJ0eSB3YXRjaGVycz9cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gUmVtb3ZlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICBpID0gbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgIGlmIChpID4gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH1cblxuICAvLyB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCdpbnNlcnQnIG9yICdkZWxldGUnLCBpbmRleCwgY291bnQpXG4gIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGEsIGIpIHtcbiAgICAobGlzdGVuZXJzW2V2ZW50XVtbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgPyBhIDogbnVsbF0gfHwgW10pXG4gICAgICAubWFwKGZ1bmN0aW9uKGxpc3RlbmVyKSB7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBVcGRhdGUgaGFuZGxlcjogcmVjYWxjdWxhdGUgZGVwZW5kZW50IHByb3BlcnRpZXMsXG4gIC8vIHRyaWdnZXIgY2hhbmdlIGlmIG5lY2Vzc2FyeVxuICBmdW5jdGlvbiB1cGRhdGUocHJvcCwgaW5uZXJQcm9wKSB7XG4gICAgaWYgKCFkZWVwRXF1YWwoY2FjaGVbcHJvcF0sIGdldChwcm9wKSkpIHtcbiAgICAgIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApO1xuICAgIH1cblxuICAgIC8vIE5vdGlmeSBkZXBlbmRlbnRzXG4gICAgZm9yICh2YXIgaSA9IDAsIGRlcCA9IGRlcGVuZGVudHNbcHJvcF0gfHwgW10sIGxlbiA9IGRlcC5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgZGVsZXRlIGNoaWxkcmVuW2RlcFtpXV07XG4gICAgICBpbnN0YW5jZS50cmlnZ2VyKCd1cGRhdGUnLCBkZXBbaV0pO1xuICAgIH1cblxuICAgIGlmIChpbnN0YW5jZS5wYXJlbnQpIHtcbiAgICAgIC8vIE5vdGlmeSBjb21wdXRlZCBwcm9wZXJ0aWVzLCBkZXBlbmRpbmcgb24gcGFyZW50IG9iamVjdFxuICAgICAgaW5zdGFuY2UucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIGluc3RhbmNlLnByb3AsIHByb3ApO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByb3h5IHRoZSBhY2Nlc3NvciBmdW5jdGlvbiB0byByZWNvcmRcbiAgLy8gYWxsIGFjY2Vzc2VkIHByb3BlcnRpZXNcbiAgZnVuY3Rpb24gZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCkge1xuICAgIHJldHVybiBmdW5jdGlvbihfcHJvcCwgX2FyZykge1xuICAgICAgaWYgKCFkZXBlbmRlbnRzW19wcm9wXSkge1xuICAgICAgICBkZXBlbmRlbnRzW19wcm9wXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKGRlcGVuZGVudHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgIGRlcGVuZGVudHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjZXNzb3IoX3Byb3AsIF9hcmcpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEdldHRlciBmb3IgcHJvcCwgaWYgY2FsbGJhY2sgaXMgZ2l2ZW5cbiAgLy8gY2FuIHJldHVybiBhc3luYyB2YWx1ZVxuICBmdW5jdGlvbiBnZXQocHJvcCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuXG4gICAgcmV0dXJuIGNhY2hlW3Byb3BdID0gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpID9cbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICB2YWwuY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgY2FsbGJhY2spIDpcbiAgICAgIC8vIFN0YXRpYyBwcm9wZXJ0eSAobGVhZiBub2RlIGluIHRoZSBkZXBlbmRlbmN5IGdyYXBoKVxuICAgICAgdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldChwcm9wLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gcmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnID9cbiAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICBjaGlsZHJlbltwcm9wXSA/XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdIDpcbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gPSBmcmVhayhyZXN1bHQsIHJvb3QgfHwgaW5zdGFuY2UsIGluc3RhbmNlLCBwcm9wKSA6XG4gICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFNldCBwcm9wIHRvIHZhbFxuICBmdW5jdGlvbiBzZXR0ZXIocHJvcCwgdmFsKSB7XG4gICAgdmFyIG9sZFZhbCA9IGdldChwcm9wKTtcblxuICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eSBzZXR0ZXJcbiAgICAgIG9ialtwcm9wXS5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCB2YWwpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFNpbXBsZSBwcm9wZXJ0eVxuICAgICAgb2JqW3Byb3BdID0gdmFsO1xuICAgICAgaWYgKHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgICBkZWxldGUgY2FjaGVbcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9sZFZhbCAhPT0gdmFsKSB7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yLCB1bmlmeSBnZXR0ZXIgYW5kIHNldHRlclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgZ2V0dGVyIDogc2V0dGVyXG4gICAgKShwcm9wLCBhcmcpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGZyZWFrIGluc3RhbmNlXG4gIHZhciBpbnN0YW5jZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBhY2Nlc3Nvci5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICB9O1xuXG4gIC8vIEF0dGFjaCBpbnN0YW5jZSBwcm9wZXJ0aWVzXG4gIG1peGluKGluc3RhbmNlLCB7XG4gICAgdmFsdWVzOiBvYmosXG4gICAgcGFyZW50OiBwYXJlbnQgfHwgbnVsbCxcbiAgICByb290OiByb290IHx8IGluc3RhbmNlLFxuICAgIHByb3A6IHByb3AgfHwgbnVsbCxcbiAgICAvLyAub24oZXZlbnRbLCBwcm9wXSwgY2FsbGJhY2spXG4gICAgb246IG9uLFxuICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICBvZmY6IG9mZixcbiAgICAvLyAudHJpZ2dlcihldmVudFssIHByb3BdKVxuICAgIHRyaWdnZXI6IHRyaWdnZXJcbiAgfSk7XG5cbiAgLy8gV3JhcCBtdXRhdGluZyBhcnJheSBtZXRob2QgdG8gdXBkYXRlXG4gIC8vIHN0YXRlIGFuZCBub3RpZnkgbGlzdGVuZXJzXG4gIGZ1bmN0aW9uIHdyYXBBcnJheU1ldGhvZChtZXRob2QsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW11bbWV0aG9kXS5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIGluc3RhbmNlLnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCBpbnN0YW5jZS5wcm9wKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICBtaXhpbihpbnN0YW5jZSwge1xuICAgICAgLy8gRnVuY3Rpb24gcHJvdG90eXBlIGFscmVhZHkgY29udGFpbnMgbGVuZ3RoXG4gICAgICAvLyBUaGlzIHNwZWNpZmllcyBhcnJheSBsZW5ndGhcbiAgICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgICAgcG9wOiB3cmFwQXJyYXlNZXRob2QoJ3BvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCB0aGlzLmxlbiwgMSk7XG4gICAgICB9KSxcblxuICAgICAgcHVzaDogd3JhcEFycmF5TWV0aG9kKCdwdXNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIHRoaXMubGVuIC0gMSwgMSk7XG4gICAgICB9KSxcblxuICAgICAgcmV2ZXJzZTogd3JhcEFycmF5TWV0aG9kKCdyZXZlcnNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgfSksXG5cbiAgICAgIHNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3NoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIDEpO1xuICAgICAgfSksXG5cbiAgICAgIHVuc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgndW5zaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgIH0pLFxuXG4gICAgICBzb3J0OiB3cmFwQXJyYXlNZXRob2QoJ3NvcnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICB9KSxcblxuICAgICAgc3BsaWNlOiB3cmFwQXJyYXlNZXRob2QoJ3NwbGljZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzLmxlbmd0aCAtIDIpO1xuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgfSk7XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwiLypcblxuIyMgQ29tcGlsZXJcblxuKi9cblxuXG4vKlxuXG4jIyMgY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSlcblxuUmV0dXJuIGRvY3VtZW50RnJhZ21lbnRcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwsIG9wdGlvbnMpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIC8vIFV0aWxpdHkgZnVuY3Rpb25zXG5cbiAgICAgIGZ1bmN0aW9uIGVzY2FwZVJFKHMpIHtcbiAgICAgICAgcmV0dXJuICAocyArICcnKS5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXFxcKCl7fXwtXSkvZywgJ1xcXFwkMScpO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIHRva2VuaXplcihvcHRpb25zLCBmbGFncykge1xuICAgICAgICByZXR1cm4gUmVnRXhwKFxuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgK1xuICAgICAgICAgICcoJyArIGNvbnN0cy5SRV9BTllUSElORyArICcpJyArXG4gICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKSxcbiAgICAgICAgICBmbGFnc1xuICAgICAgICApO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIG1hdGNoUnVsZXModGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICB2YXIgaSwgbWF0Y2g7XG4gICAgICAgIHZhciBydWxlcyA9IHJlcXVpcmUoJy4vcnVsZXMnKTtcbiAgICAgICAgdmFyIHJ1bGVzTGVuID0gcnVsZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vIFN0cmlwIGRlbGltaXRlcnNcbiAgICAgICAgdGFnID0gdGFnLnNsaWNlKG9wdGlvbnMuZGVsaW1pdGVyc1swXS5sZW5ndGgsIC1vcHRpb25zLmRlbGltaXRlcnNbMV0ubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcnVsZXNMZW47IGkrKykge1xuICAgICAgICAgIG1hdGNoID0gcnVsZXNbaV0odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucyk7XG5cbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIG1hdGNoLmluZGV4ID0gaTtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICAgIC8vIHJlcGxhY2Uge3t7dGFnfX19IHdpdGgge3smdGFnfX1cbiAgICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgICAgIFJlZ0V4cChcbiAgICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICd7JykgK1xuICAgICAgICAgICAgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICtcbiAgICAgICAgICAgIGVzY2FwZVJFKCd9JyArIG9wdGlvbnMuZGVsaW1pdGVyc1sxXSksXG4gICAgICAgICAgICAnZydcbiAgICAgICAgICApLFxuICAgICAgICAgIG9wdGlvbnMuZGVsaW1pdGVyc1swXSArICcmJDEnICsgb3B0aW9ucy5kZWxpbWl0ZXJzWzFdXG4gICAgICAgICk7XG4gICAgICAgIC8vIHdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiBIVE1MIGNvbW1lbnQsXG4gICAgICAgIC8vIHJlbW92ZSBNdXN0YWNoZSBjb21tZW50cyxcbiAgICAgICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgICAgIHRva2VuaXplcihvcHRpb25zLCAnZycpLFxuICAgICAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICAgICAgdmFyIGhlYWQgPSB0ZW1wbGF0ZS5zbGljZSgwLCBwb3MpO1xuICAgICAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaChSZWdFeHAoJzwnICsgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICsgJ1tePl0qPyQnKSk7XG4gICAgICAgICAgICB2YXIgaW5zaWRlQ29tbWVudCA9ICEhaGVhZC5tYXRjaCgvPCEtLVxccyokLyk7XG4gICAgICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zaWRlVGFnIHx8IGluc2lkZUNvbW1lbnQgP1xuICAgICAgICAgICAgICBpc011c3RhY2hlQ29tbWVudCA/XG4gICAgICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICAgICAgJzwhLS0nICsgbWF0Y2ggKyAnLS0+JztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBtYXRjaEVuZEJsb2NrKGJsb2NrLCB0ZW1wbGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgbWF0Y2ggPSB0ZW1wbGF0ZS5tYXRjaChcbiAgICAgICAgICBSZWdFeHAoXG4gICAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICtcbiAgICAgICAgICAgICdcXFxcLycgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnPycgK1xuICAgICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIG1hdGNoID9cbiAgICAgICAgICBibG9jayA9PT0gJycgfHwgbWF0Y2hbMV0gPT09IHVuZGVmaW5lZCB8fCBtYXRjaFsxXSA9PT0gYmxvY2sgOlxuICAgICAgICAgIGZhbHNlO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIFZhcmlhYmxlc1xuXG4gICAgICB2YXIgaSwgY2hpbGRyZW4sIGxlbiwgYWksIGFsZW4sIGF0dHIsIHZhbCwgYXR0clJ1bGVzLCByaSwgYXR0clZhbDtcbiAgICAgIHZhciBidWZmZXIsIHBvcywgYmVnaW5Qb3MsIGJvZHlCZWdpblBvcywgYm9keSwgbm9kZSwgZWwsIHQsIG1hdGNoLCBydWxlLCB0b2tlbiwgYmxvY2s7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIGZyYWc7XG4gICAgICB2YXIgZnJlYWsgPSByZXF1aXJlKCdmcmVhaycpO1xuXG4gICAgICAvLyBJbml0XG5cbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHJlcXVpcmUoJy4vZGVmYXVsdC1vcHRpb25zJyk7XG5cbiAgICAgIG1vZGVsID1cbiAgICAgICAgdHlwZW9mIG1vZGVsID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAvLyBGcmVhayBpbnN0YW5jZVxuICAgICAgICAgIG1vZGVsIDpcbiAgICAgICAgICB0eXBlb2YgbW9kZWwgPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICAgICAgICBmcmVhayhtb2RlbCkgOlxuICAgICAgICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICAgICAgICBmcmVhayh7Jy4nOiBtb2RlbH0pO1xuXG4gICAgICAvLyBUZW1wbGF0ZSBjYW4gYmUgYSBzdHJpbmcgb3IgRE9NIHN0cnVjdHVyZVxuICAgICAgaWYgKHRlbXBsYXRlLm5vZGVUeXBlKSB7XG4gICAgICAgIGJvZHkgPSB0ZW1wbGF0ZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUsIG9wdGlvbnMpO1xuXG4gICAgICAgIGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgIGJvZHkuaW5uZXJIVE1MID0gdGVtcGxhdGU7XG4gICAgICB9XG5cbiAgICAgIC8vIEl0ZXJhdGUgY2hpbGQgbm9kZXMuXG4gICAgICBmb3IgKGkgPSAwLCBjaGlsZHJlbiA9IGJvZHkuY2hpbGROb2RlcywgbGVuID0gY2hpbGRyZW4ubGVuZ3RoIDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgbm9kZSA9IGNoaWxkcmVuW2ldO1xuXG4gICAgICAgIC8vIFNoYWxsb3cgY29weSBvZiBub2RlIGFuZCBhdHRyaWJ1dGVzIChpZiBlbGVtZW50KVxuICAgICAgICBlbCA9IG5vZGUuY2xvbmVOb2RlKGZhbHNlKTtcblxuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbCk7XG5cbiAgICAgICAgc3dpdGNoIChub2RlLm5vZGVUeXBlKSB7XG5cbiAgICAgICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgICAgICBjYXNlIDE6XG5cbiAgICAgICAgICAgIC8vIFJlbWVtYmVyIG1vZGVsXG4gICAgICAgICAgICBmcmFnbWVudC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlc1xuICAgICAgICAgICAgZm9yIChhaSA9IDAsIGFsZW4gPSBlbC5hdHRyaWJ1dGVzID8gZWwuYXR0cmlidXRlcy5sZW5ndGggOiAwOyBhaSA8IGFsZW47IGFpKyspIHtcblxuICAgICAgICAgICAgICBhdHRyID0gZWwuYXR0cmlidXRlc1thaV07XG4gICAgICAgICAgICAgIGF0dHJSdWxlcyA9IFtdO1xuICAgICAgICAgICAgICBhdHRyVmFsID0gJyc7XG4gICAgICAgICAgICAgIHZhbCA9IGF0dHIudmFsdWU7XG4gICAgICAgICAgICAgIHQgPSB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoIChtYXRjaCA9IHQuZXhlYyh2YWwpKSApIHtcblxuICAgICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKG1hdGNoWzBdLCBlbCwgYXR0ci5uYW1lLCBtb2RlbCwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZSkge1xuXG4gICAgICAgICAgICAgICAgICBhdHRyUnVsZXMucHVzaChydWxlKTtcblxuICAgICAgICAgICAgICAgICAgaWYgKHJ1bGUuYmxvY2spIHtcblxuICAgICAgICAgICAgICAgICAgICBibG9jayA9IG1hdGNoWzBdO1xuICAgICAgICAgICAgICAgICAgICBiZWdpblBvcyA9IG1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICAgICAgICBib2R5QmVnaW5Qb3MgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGNsb3NpbmcgdGFnXG4gICAgICAgICAgICAgICAgICAgIGZvciAoO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIG1hdGNoWzBdLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoID0gdC5leGVjKHZhbCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0aHJvdyAnVW5jbG9zZWQnICsgYmxvY2s7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gUmVwbGFjZSBmdWxsIGJsb2NrIHRhZyBib2R5IHdpdGggcnVsZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgIGF0dHJWYWwgKz1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbC5zbGljZSgwLCBiZWdpblBvcykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgcnVsZS5yZXBsYWNlKGF0dHIudmFsdWUuc2xpY2UoYm9keUJlZ2luUG9zLCBtYXRjaC5pbmRleCkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbC5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKCFydWxlLmJsb2NrICYmIHJ1bGUucmVwbGFjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dHIudmFsdWUgPSBydWxlLnJlcGxhY2U7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBSdWxlIGNoYW5nZXMgY2FuIG11dGF0ZSBhdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAvLyBzbyBwcm9jZXNzIGluIGFub3RoZXIgcGFzc1xuICAgICAgICAgICAgICBpZiAoYXR0clJ1bGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGF0dHIudmFsdWUgPSBhdHRyVmFsO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAocmkgPSAwOyByaSA8IGF0dHJSdWxlcy5sZW5ndGg7IHJpKyspIHtcbiAgICAgICAgICAgICAgICBydWxlID0gYXR0clJ1bGVzW3JpXTtcbiAgICAgICAgICAgICAgICBpZiAocnVsZS5jaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBydWxlLmJsb2NrIHx8IHJ1bGUucHJvcCwgcnVsZS5jaGFuZ2UpO1xuICAgICAgICAgICAgICAgICAgcnVsZS5jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICBmcmFnID0gY29tcGlsZShub2RlLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICBpZiAoZnJhZy5jaGlsZE5vZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGZyYWcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgODpcbiAgICAgICAgICAgIGlmIChtYXRjaEVuZEJsb2NrKCcnLCBlbC5kYXRhLCBvcHRpb25zKSkge1xuICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuZXhwZWN0ZWQgJyArIGVsLmRhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggKG1hdGNoID0gZWwuZGF0YS5tYXRjaCh0b2tlbml6ZXIob3B0aW9ucykpKSApIHtcblxuICAgICAgICAgICAgICBydWxlID0gbWF0Y2hSdWxlcyhlbC5kYXRhLCBub2RlLCBudWxsLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBET00gcmVwbGFjZW1lbnQ/XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucmVwbGFjZS5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlLCBlbCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGFnIGNvbnRlbnRzP1xuICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkrKztcblxuICAgICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIGNoaWxkcmVuW2ldLmRhdGEgfHwgJycsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGRyZW5baV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBlbC5kYXRhO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgYGVsYCB3aXRoIGBydWxlLnJlcGxhY2UoKWAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHJ1bGUucmVwbGFjZShibG9jaywgZWwucGFyZW50Tm9kZSksIGVsKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5wcm9wICYmIHJ1bGUuY2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcnVsZS5wcm9wLCBydWxlLmNoYW5nZSk7XG4gICAgICAgICAgICAgICAgICBydWxlLmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgfSAvLyBzd2l0Y2hcblxuICAgICAgfSAvLyBmb3JcblxuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH07XG4iLCIvKlxuXG4jIyBDb25zdGFudHNcblxuKi9cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJlLXF1b3RlZFwiXG4gICAgUkVfUEFSVElBTDogLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8sXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0VORFNfV0lUSF9OT0RFX0lEOiAvLisoI1tcXHdcXC5cXC1dKykkLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qIVxuICogY29udGVudGxvYWRlZC5qc1xuICpcbiAqIEF1dGhvcjogRGllZ28gUGVyaW5pIChkaWVnby5wZXJpbmkgYXQgZ21haWwuY29tKVxuICogU3VtbWFyeTogY3Jvc3MtYnJvd3NlciB3cmFwcGVyIGZvciBET01Db250ZW50TG9hZGVkXG4gKiBVcGRhdGVkOiAyMDEwMTAyMFxuICogTGljZW5zZTogTUlUXG4gKiBWZXJzaW9uOiAxLjJcbiAqXG4gKiBVUkw6XG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9cbiAqIGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9Db250ZW50TG9hZGVkL01JVC1MSUNFTlNFXG4gKlxuICovXG5cbi8vIEB3aW4gd2luZG93IHJlZmVyZW5jZVxuLy8gQGZuIGZ1bmN0aW9uIHJlZmVyZW5jZVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb250ZW50TG9hZGVkKHdpbiwgZm4pIHtcblxuXHR2YXIgZG9uZSA9IGZhbHNlLCB0b3AgPSB0cnVlLFxuXG5cdGRvYyA9IHdpbi5kb2N1bWVudCxcblx0cm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQsXG5cdG1vZGVybiA9IGRvYy5hZGRFdmVudExpc3RlbmVyLFxuXG5cdGFkZCA9IG1vZGVybiA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCcsXG5cdHJlbSA9IG1vZGVybiA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdkZXRhY2hFdmVudCcsXG5cdHByZSA9IG1vZGVybiA/ICcnIDogJ29uJyxcblxuXHRpbml0ID0gZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLnR5cGUgPT0gJ3JlYWR5c3RhdGVjaGFuZ2UnICYmIGRvYy5yZWFkeVN0YXRlICE9ICdjb21wbGV0ZScpIHJldHVybjtcblx0XHQoZS50eXBlID09ICdsb2FkJyA/IHdpbiA6IGRvYylbcmVtXShwcmUgKyBlLnR5cGUsIGluaXQsIGZhbHNlKTtcblx0XHRpZiAoIWRvbmUgJiYgKGRvbmUgPSB0cnVlKSkgZm4uY2FsbCh3aW4sIGUudHlwZSB8fCBlKTtcblx0fSxcblxuXHRwb2xsID0gZnVuY3Rpb24oKSB7XG5cdFx0dHJ5IHsgcm9vdC5kb1Njcm9sbCgnbGVmdCcpOyB9IGNhdGNoKGUpIHsgc2V0VGltZW91dChwb2xsLCA1MCk7IHJldHVybjsgfVxuXHRcdGluaXQoJ3BvbGwnKTtcblx0fTtcblxuXHRpZiAoZG9jLnJlYWR5U3RhdGUgPT0gJ2NvbXBsZXRlJykgZm4uY2FsbCh3aW4sICdsYXp5Jyk7XG5cdGVsc2Uge1xuXHRcdGlmICghbW9kZXJuICYmIHJvb3QuZG9TY3JvbGwpIHtcblx0XHRcdHRyeSB7IHRvcCA9ICF3aW4uZnJhbWVFbGVtZW50OyB9IGNhdGNoKGUpIHsgfVxuXHRcdFx0aWYgKHRvcCkgcG9sbCgpO1xuXHRcdH1cblx0XHRkb2NbYWRkXShwcmUgKyAnRE9NQ29udGVudExvYWRlZCcsIGluaXQsIGZhbHNlKTtcblx0XHRkb2NbYWRkXShwcmUgKyAncmVhZHlzdGF0ZWNoYW5nZScsIGluaXQsIGZhbHNlKTtcblx0XHR3aW5bYWRkXShwcmUgKyAnbG9hZCcsIGluaXQsIGZhbHNlKTtcblx0fVxuXG59XG4iLCIvKlxuICBcbkRlZmF1bHQgb3B0aW9uc1xuXG4qL1xuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgZGVsaW1pdGVyczogWyd7eycsICd9fSddXG4gICAgfTtcbiIsIi8qXG5cbkV2YWx1YXRlIG9iamVjdCBmcm9tIGxpdGVyYWwgb3IgQ29tbW9uSlMgbW9kdWxlXG5cbiovXG5cbiAgICAvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYywgbW9kZWwpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIG1vZGVsID0gbW9kZWwgfHwge307XG4gICAgICBpZiAodHlwZW9mIG1vZGVsICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG1vZGVsID0ganRtcGwuZnJlYWsobW9kZWwpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgaWYgKC8vIFBsdWdpblxuICAgICAgICAgICAgICAocHJvcC5pbmRleE9mKCdfXycpID09PSAwICYmXG4gICAgICAgICAgICAgICAgcHJvcC5sYXN0SW5kZXhPZignX18nKSA9PT0gcHJvcC5sZW5ndGggLSAyKSB8fFxuICAgICAgICAgICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eVxuICAgICAgICAgICAgICB0eXBlb2YgcHJvcGVydGllc1twcm9wXSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgaWYgKHRhcmdldC52YWx1ZXNbcHJvcF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQudmFsdWVzW3Byb3BdID0gcHJvcGVydGllc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBUYXJnZXQgZG9lc24ndCBhbHJlYWR5IGhhdmUgcHJvcD9cbiAgICAgICAgICAgIGlmICh0YXJnZXQocHJvcCkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQocHJvcCwgcHJvcGVydGllc1twcm9wXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGFwcGx5UGx1Z2lucygpIHtcbiAgICAgICAgdmFyIHByb3AsIGFyZztcbiAgICAgICAgZm9yIChwcm9wIGluIGp0bXBsLnBsdWdpbnMpIHtcbiAgICAgICAgICBwbHVnaW4gPSBqdG1wbC5wbHVnaW5zW3Byb3BdO1xuICAgICAgICAgIGFyZyA9IG1vZGVsLnZhbHVlc1snX18nICsgcHJvcCArICdfXyddO1xuICAgICAgICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSAnZnVuY3Rpb24nICYmIGFyZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBwbHVnaW4uY2FsbChtb2RlbCwgYXJnLCB0YXJnZXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBldmFsT2JqZWN0KGJvZHksIHNyYykge1xuICAgICAgICB2YXIgcmVzdWx0LCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH07XG4gICAgICAgIHNyYyA9IHNyYyA/XG4gICAgICAgICAgJ1xcbi8vQCBzb3VyY2VVUkw9JyArIHNyYyArXG4gICAgICAgICAgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNyYyA6XG4gICAgICAgICAgJyc7XG4gICAgICAgIHJldHVybiAoYm9keS5tYXRjaCgvXlxccyp7W1xcU1xcc10qfVxccyokLykpID9cbiAgICAgICAgICAvLyBMaXRlcmFsXG4gICAgICAgICAgZXZhbCgnKGZ1bmN0aW9uKCl7IHZhciByZXN1bHQ9JyArIGJvZHkgKyAnOyByZXR1cm4gcmVzdWx0fSkoKScgKyBzcmMpIDpcbiAgICAgICAgICAvLyBDb21tb25KUyBtb2R1bGVcbiAgICAgICAgICAvLyBcIjAsXCIgaXMgYmxhY2sgbWFnaWMgZm9yIElFOCwgY2hlY2sgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvNzIwMjAzOFxuICAgICAgICAgIGV2YWwoXG4gICAgICAgICAgICAnMCwgKGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cyl7JyArXG4gICAgICAgICAgICBib2R5ICtcbiAgICAgICAgICAgICc7cmV0dXJuIG1vZHVsZS5leHBvcnRzfSknICtcbiAgICAgICAgICAgIHNyY1xuICAgICAgICAgICkobW9kdWxlLCBtb2R1bGUuZXhwb3J0cyk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIEVsZW1lbnQgaW4gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jLnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChlbGVtZW50LmlubmVySFRNTCwgc3JjKSk7XG4gICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIEdldCBtb2RlbCB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIHNyYywgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChjb25zdHMuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAgICAgLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJylcbiAgICAgICAgICAgICAgLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuICAgICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QobWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsIHNyYykpO1xuICAgICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKCkge1xuICAgICAgICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gICAgICAgIGlmIChzcmMubWF0Y2goY29uc3RzLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gVGVtcGxhdGUgaXMgdGhlIGNvbnRlbnRzIG9mIGVsZW1lbnRcbiAgICAgICAgICAvLyBiZWxvbmdpbmcgdG8gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIGxvYWRNb2RlbChlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbCcpLCBlbGVtZW50LmlubmVySFRNTCwgZG9jdW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIEdldCB0ZW1wbGF0ZSB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIHNyYywgZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGNvbnN0cy5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICB2YXIgZG9jO1xuICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgIGRvYyA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnJyk7XG4gICAgICAgICAgICAgIGRvYy5kb2N1bWVudEVsZW1lbnQuaW5uZXJIVE1MID0gcmVzcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBkb2MgPSBkb2N1bWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgZG9jLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuXG4gICAgICAgICAgICBsb2FkTW9kZWwoXG4gICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSA6ICcnLFxuICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCxcbiAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvYWRUZW1wbGF0ZSgpO1xuICAgIH07XG4iLCIvKlxuXG4jIyBNYWluIGZ1bmN0aW9uXG5cbiovXG4gICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICBmdW5jdGlvbiBqdG1wbCgpIHtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgdmFyIHRhcmdldCwgdCwgdGVtcGxhdGUsIG1vZGVsO1xuXG4gICAgICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgICAgIGlmIChbJ0dFVCcsICdQT1NUJ10uaW5kZXhPZihhcmdzWzBdKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKCcuL3hocicpLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQpP1xuICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIHJldHVybiBtb2RlbFxuICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKS5fX2p0bXBsX187XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsWywgb3B0aW9uc10pP1xuICAgICAgZWxzZSBpZiAoXG4gICAgICAgICggYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlIHx8XG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgICggKGFyZ3NbMV0gJiYgdHlwZW9mIGFyZ3NbMV0uYXBwZW5kQ2hpbGQgPT09ICdmdW5jdGlvbicpIHx8XG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzFdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgIGFyZ3NbMl0gIT09IHVuZGVmaW5lZFxuXG4gICAgICApIHtcblxuICAgICAgICB0YXJnZXQgPSBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgID9cbiAgICAgICAgICBhcmdzWzBdIDpcbiAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMF0pO1xuXG4gICAgICAgIHRlbXBsYXRlID0gYXJnc1sxXS5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1sxXSkuaW5uZXJIVE1MIDpcbiAgICAgICAgICBhcmdzWzFdO1xuXG4gICAgICAgIG1vZGVsID1cbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAvLyBhbHJlYWR5IHdyYXBwZWRcbiAgICAgICAgICAgIGFyZ3NbMl0gOlxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHdyYXBcbiAgICAgICAgICAgIGp0bXBsLmZyZWFrKFxuICAgICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgIC8vIG9iamVjdFxuICAgICAgICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMl0ubWF0Y2goY29uc3RzLlJFX05PREVfSUQpID9cbiAgICAgICAgICAgICAgICAgIC8vIHNyYywgbG9hZCBpdFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZSgnLi9sb2FkZXInKVxuICAgICAgICAgICAgICAgICAgICAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzJdKS5pbm5lckhUTUwpIDpcblxuICAgICAgICAgICAgICAgICAgLy8gc2ltcGxlIHZhbHVlLCBib3ggaXRcbiAgICAgICAgICAgICAgICAgIHsnLic6IGFyZ3NbMl19XG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGlmICh0YXJnZXQubm9kZU5hbWUgPT09ICdTQ1JJUFQnKSB7XG4gICAgICAgICAgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIHQuaWQgPSB0YXJnZXQuaWQ7XG4gICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHQsIHRhcmdldCk7XG4gICAgICAgICAgdGFyZ2V0ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc29jaWF0ZSB0YXJnZXQgYW5kIG1vZGVsXG4gICAgICAgIHRhcmdldC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgICAgICAvLyBFbXB0eSB0YXJnZXRcbiAgICAgICAgdGFyZ2V0LmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQocmVxdWlyZSgnLi9jb21waWxlcicpKHRlbXBsYXRlLCBtb2RlbCwgYXJnc1szXSkpO1xuICAgICAgfVxuICAgIH1cblxuXG5cbi8qXG5cbk9uIHBhZ2UgcmVhZHksIHByb2Nlc3MganRtcGwgdGFyZ2V0c1xuXG4qL1xuXG4gICAgcmVxdWlyZSgnLi9jb250ZW50LWxvYWRlZCcpKHdpbmRvdywgZnVuY3Rpb24oKSB7XG5cbiAgICAgIHZhciBsb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xuICAgICAgdmFyIHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qdG1wbF0nKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRhcmdldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgbG9hZGVyKHRhcmdldHNbaV0sIHRhcmdldHNbaV0uZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJykpO1xuICAgICAgfVxuICAgIH0pO1xuXG5cbi8qXG5cbkV4cG9zZSBmcmVha1xuXG4qL1xuXG4gICAganRtcGwuZnJlYWsgPSByZXF1aXJlKCdmcmVhaycpO1xuXG5cblxuLypcblxuUGx1Z2luc1xuXG4qL1xuXG4gICAganRtcGwucGx1Z2lucyA9IHtcbiAgICAgIGluaXQ6IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGFyZy5jYWxsKHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuXG4vKlxuXG5FeHBvcnRcblxuKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGp0bXBsO1xuIiwiLypcblxuIyMgUnVsZXNcblxuRWFjaCBydWxlIGlzIGEgZnVuY3Rpb24sIGFyZ3Mgd2hlbiBjYWxsZWQgYXJlOlxuKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpXG5cbnRhZzogdGV4dCBiZXR3ZWVuIGRlbGltaXRlcnMsIHt7dGFnfX1cbm5vZGU6IERPTSBub2RlLCB3aGVyZSB0YWcgaXMgZm91bmRcbmF0dHI6IG5vZGUgYXR0cmlidXRlIG9yIG51bGwsIGlmIG5vZGUgY29udGVudHNcbm1vZGVsOiBGcmVhayBtb2RlbFxub3B0aW9uczogY29uZmlndXJhdGlvbiBvcHRpb25zXG5cbkl0IG11c3QgcmV0dXJuIGVpdGhlcjpcblxuKiBmYWxzeSB2YWx1ZSAtIG5vIG1hdGNoXG5cbiogb2JqZWN0IC0gbWF0Y2ggZm91bmQsIHJldHVybiAoYWxsIGZpZWxkcyBvcHRpb25hbClcblxuICAgICB7XG4gICAgICAgLy8gUGFyc2UgdW50aWwge3svfX0gb3Ige3svc29tZVByb3B9fSAuLi5cbiAgICAgICBibG9jazogJ3NvbWVQcm9wJyxcblxuICAgICAgIC8vIC4uLiB0aGVuIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQuXG4gICAgICAgLy8gSXQgbXVzdCByZXR1cm4gc3RyaW5nIG9yIERPTUVsZW1lbnRcbiAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHsgLi4uIH1cbiAgICAgfVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3ZhbHVlLXZhcicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9jbGFzcy1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3NlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9wYXJ0aWFsJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3VuZXNjYXBlZC12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdmFyJylcbiAgICBdO1xuIiwiLypcblxuIyMjIGNsYXNzPVwie3sjaWZDb25kaXRpb259fXNvbWUtY2xhc3N7ey99fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIGBtb2RlbC5pZkNvbmRpdGlvbmBcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJyMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIga2xhc3M7XG5cblxuICAgICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgbWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgICAgIFshIXZhbCAmJiAnYWRkJyB8fCAncmVtb3ZlJ10oa2xhc3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3teaW52ZXJ0ZWQtc2VjdGlvbn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ15cXFxcXicgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciB0ZW1wbGF0ZTtcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGNoYW5nZSk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCB2YWwoaSkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG4gICAgICAgICAgICByZXR1cm4gYW5jaG9yO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfSIsIi8qXG5cbiMjIyBQYXJ0aWFsXG5cbioge3s+XCIjaWRcIn19XG4qIHt7PlwidXJsXCJ9fVxuKiB7ez5cInVybCNpZFwifX1cbioge3s+cGFydGlhbFNyY319XG5cblJlcGxhY2VzIHBhcmVudCB0YWcgY29udGVudHMsIGFsd2F5cyB3cmFwIGluIGEgdGFnXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuLi9jb25zdHMnKTtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChjb25zdHMuUkVfUEFSVElBTCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgdGFyZ2V0O1xuXG4gICAgICB2YXIgbG9hZGVyID0gbWF0Y2ggJiZcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXF1aXJlKCcuLi9sb2FkZXInKShcbiAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgIG1hdGNoWzFdID9cbiAgICAgICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICAgICAgbW9kZWwobWF0Y2hbMV0pIDpcbiAgICAgICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgICAgICBtYXRjaFsyXSB8fCBtYXRjaFszXSxcbiAgICAgICAgICAgIG1vZGVsXG4gICAgICAgICAgKVxuICAgICAgICB9O1xuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICBpZiAobWF0Y2hbMV0pIHtcbiAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBtYXRjaFsxXSwgbG9hZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIExvYWQgYXN5bmNcbiAgICAgICAgc2V0VGltZW91dChsb2FkZXIsIDApO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVwbGFjZTogYW5jaG9yXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7I3NlY3Rpb259fVxuXG5DYW4gYmUgYm91bmQgdG8gdGV4dCBub2RlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjb21waWxlID0gcmVxdWlyZSgnLi4vY29tcGlsZXInKTtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChuZXcgUmVnRXhwKCdeIycgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciB0ZW1wbGF0ZTtcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBmdW5jdGlvbiB1cGRhdGUoaSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgICBwYXJlbnQucmVwbGFjZUNoaWxkKFxuICAgICAgICAgICAgY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaSkpLFxuICAgICAgICAgICAgcGFyZW50LmNoaWxkTm9kZXNbcG9zXVxuICAgICAgICAgICk7XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGluc2VydChpbmRleCwgY291bnQpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBzaXplID0gY291bnQgKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgdmFyIGksIGZyYWdtZW50O1xuXG4gICAgICAgIGZvciAoaSA9IDAsIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCBtb2RlbChwcm9wKShpbmRleCArIGkpKSk7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGZyYWdtZW50LCBwYXJlbnQuY2hpbGROb2Rlc1twb3NdKTtcbiAgICAgICAgbGVuZ3RoID0gbGVuZ3RoICsgc2l6ZTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZGVsKGluZGV4LCBjb3VudCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiB0ZW1wbGF0ZS5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgIGxlbmd0aCA9IGxlbmd0aCAtIHNpemU7XG5cbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChwYXJlbnQuY2hpbGROb2Rlc1twb3NdKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gdmFsLmxlbjsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YWwub24oJ2NoYW5nZScsIGksIHVwZGF0ZShpKSk7XG4gICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKGkpKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPYmplY3Q/XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKTtcbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoISF2YWwpIHtcbiAgICAgICAgICAgIHJlbmRlciA9IGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cblxuICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwcm9wOiBwcm9wLFxuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCwgcGFyZW50KSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgICAgdGVtcGxhdGUgPSB0bXBsO1xuXG4gICAgICAgICAgICByZXR1cm4gYW5jaG9yO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7JnZhcn19XG5cbihge3t7dmFyfX19YCBpcyByZXBsYWNlZCBvbiBwcmVwcm9jZXNzaW5nIHN0ZXApXG5cbkNhbiBiZSBib3VuZCB0byBub2RlIGlubmVySFRNTFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiYnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgaWYgKG1hdGNoICYmICFhdHRyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiBhbmNob3IsXG4gICAgICAgICAgY2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgICAgIHZhciBpO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHZhbHVlXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbC5jaGlsZE5vZGVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShmcmFnbWVudCwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjICh2YWx1ZSB8IGNoZWNrZWQgfCBzZWxlY3RlZCk9XCJ7e3ZhbH19XCJcblxuSGFuZGxlIFwidmFsdWVcIiwgXCJjaGVja2VkXCIgYW5kIFwic2VsZWN0ZWRcIiBhdHRyaWJ1dGVzXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWF0Y2ggJiYgWyd2YWx1ZScsICdjaGVja2VkJywgJ3NlbGVjdGVkJ10uaW5kZXhPZihhdHRyKSA+IC0xKSB7XG4gICAgICAgIC8vIDxzZWxlY3Q+IG9wdGlvbj9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgLy8gQXR0YWNoIGFzeW5jLCBhcyBwYXJlbnROb2RlIGlzIHN0aWxsIGRvY3VtZW50RnJhZ21lbnRcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUgJiYgbm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAobW9kZWwocHJvcCkgIT09IG5vZGUuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuc2VsZWN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGVbYXR0cl0pIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsXG4gICAgICAgICAgICAgICAgICBpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFt0eXBlPXJhZGlvXVtuYW1lPScgKyBub2RlLm5hbWUgKyAnXScpLFxuICAgICAgICAgICAgICAgICAgbGVuID0gaW5wdXRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgIGkgPCBsZW47XG4gICAgICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXRzW2ldICE9PSBub2RlKSB7XG4gICAgICAgICAgICAgICAgICBpbnB1dHNbaV0uZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGV4dCBpbnB1dD9cbiAgICAgICAgdmFyIGV2ZW50VHlwZSA9IFsndGV4dCcsICdwYXNzd29yZCddLmluZGV4T2Yobm9kZS50eXBlKSA+IC0xID9cbiAgICAgICAgICAnaW5wdXQnIDogJ2NoYW5nZSc7XG5cbiAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgbW9kZWwocHJvcCwgbm9kZVthdHRyXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcHJvcDogcHJvcCxcbiAgICAgICAgICByZXBsYWNlOiAnJyxcbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7e3Zhcn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGUgZGF0YSBvciBhdHRyaWJ1dGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIHJlYWN0LCB0YXJnZXQsIGNoYW5nZTtcblxuICAgICAgZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICB2YXIgdmFsID0gbW9kZWwodGFnKTtcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkodmFsLnZhbHVlcykgOlxuICAgICAgICAgIHZhbDtcbiAgICAgIH1cblxuICAgICAgaWYgKHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKSkge1xuXG4gICAgICAgIGlmIChhdHRyKSB7XG4gICAgICAgICAgLy8gQXR0cmlidXRlXG4gICAgICAgICAgY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gZ2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKSA6XG4gICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gVGV4dCBub2RlXG4gICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGFyZ2V0LmRhdGEgPSBnZXQoKSB8fCAnJztcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWF0Y2ggZm91bmRcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwcm9wOiB0YWcsXG4gICAgICAgICAgcmVwbGFjZTogdGFyZ2V0LFxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuUmVxdWVzdHMgQVBJXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGxlbiwgcHJvcCwgcHJvcHMsIHJlcXVlc3Q7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAvLyBMYXN0IGZ1bmN0aW9uIGFyZ3VtZW50XG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnJlZHVjZShcbiAgICAgICAgZnVuY3Rpb24gKHByZXYsIGN1cnIpIHtcbiAgICAgICAgICByZXR1cm4gdHlwZW9mIGN1cnIgPT09ICdmdW5jdGlvbicgPyBjdXJyIDogcHJldjtcbiAgICAgICAgfSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcblxuICAgICAgdmFyIG9wdHMgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0cyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9wdHMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHByb3AgPSBwcm9wc1tpXTtcbiAgICAgICAgeGhyW3Byb3BdID0gb3B0c1twcm9wXTtcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdCA9XG4gICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycpID9cblxuICAgICAgICAgIC8vIFN0cmluZyBwYXJhbWV0ZXJzXG4gICAgICAgICAgYXJnc1syXSA6XG5cbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnKSA/XG5cbiAgICAgICAgICAgIC8vIE9iamVjdCBwYXJhbWV0ZXJzLiBTZXJpYWxpemUgdG8gVVJJXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhhcmdzWzJdKS5tYXAoXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geCArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChhcmdzWzJdW3hdKTtcbiAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSwgXG4gICAgICAgIG9wdHMudXNlciwgb3B0cy5wYXNzd29yZCk7XG5cbiAgICAgIHhoci5zZW5kKHJlcXVlc3QpO1xuXG4gICAgfTtcbiJdfQ==
(8)
});
