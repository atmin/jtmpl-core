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
    'insert': {},
    'delete': {}
  };
  var dependents = {};
  var children = {};

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
    assert(['change', 'insert', 'delete'].indexOf(event) > -1);
    assert(
      (event === 'change' && prop !== null) ||
      ((event === 'insert' || event === 'delete') && !prop)
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
  // trigger('insert' or 'delete', index, count)
  function trigger(event, a, b) {
    (listeners[event][event === 'change' ? a : null] || [])
      .map(function(listener) {
        listener.call(instance, a, b);
      });
  }

  // Functional accessor
  function accessor(prop, arg, refresh) {

    var i, len, dep, result, val;

    // Lift accessor, track dependencies
    function dependencyTracker(_prop, _arg, _refresh) {
      if (!dependents[_prop]) {
        dependents[_prop] = [];
      }
      if (dependents[_prop].indexOf(prop) === -1) {
        dependents[_prop].push(prop);
      }
      return accessor(_prop, _arg, _refresh);
    }

    // Getter?
    if ((arg === undefined || typeof arg === 'function') && !refresh) {

      val = obj[prop];

      result = (typeof val === 'function') ?
        // Computed property
        val.call(dependencyTracker, arg) :
        // Static property (leaf in the dependency tree)
        val;

      return typeof result === 'object' ? 

        typeof children[prop] === 'function' ?
          children[prop] :
          children[prop] = freak(val, root || instance, instance, prop) :

        result;
    }

    // Setter
    else {

      if (!refresh) {
        if (typeof obj[prop] === 'function') {
          // Computed property setter
          obj[prop].call(dependencyTracker, arg);
        }
        else {
          // Simple property. `arg` is the new value
          obj[prop] = arg;
        }
      }

      // Notify dependents
      for (i = 0, dep = dependents[prop] || [], len = dep.length;
          i < len; i++) {
        accessor(dep[i], arg, true);
      }

      // Emit update event
      trigger('change', prop);

    } // if getter        

  } // end accessor

  var arrayProperties = {
    // Function prototype already contains length
    len: obj.length,

    pop: function() {
      var result = [].pop.apply(obj);
      this.len = this.values.length;
      trigger('delete', this.len, 1);
      return result;
    },

    push: function() {
      var result = [].push.apply(obj, arguments);
      this.len = this.values.length;
      trigger('insert', this.len - 1, 1);
      return result;
    },

    reverse: function() {
      var result = [].reverse.apply(obj);
      this.len = obj.length;
      children = {};
      trigger('delete', 0, this.len);
      trigger('insert', 0, this.len);
      return result;
    },

    shift: function() {
      var result = [].shift.apply(obj);
      this.len = obj.length;
      children = {};
      trigger('delete', 0, 1);
      return result;
    },

    unshift: function() {
      var result = [].unshift.apply(obj, arguments);
      this.len = obj.length;
      children = {};
      trigger('insert', 0, 1);
      return result;
    },

    sort: function() {
      var result = [].sort.apply(obj, arguments);
      children = {};
      trigger('delete', 0, this.len);
      trigger('insert', 0, this.len);
      return result;
    },

    splice: function() {
      var result = [].splice.apply(obj, arguments);
      this.len = obj.length;
      children = {};
      if (arguments[1]) {
        trigger('delete', arguments[0], arguments[1]);
      }
      if (arguments.length > 2) {
        trigger('insert', arguments[0], arguments.length - 2);
      }
      return result;
    }

  };

  var instance = function() {
    return accessor.apply(null, arguments);
  };

  var instanceProperties = {
    values: obj,
    parent: parent || null,
    root: root || instance,
    prop: prop || null,
    // .on(event[, prop], callback)
    on: on,
    // .off(event[, prop][, callback])
    off: off
  };

  mixin(instance, instanceProperties);

  if (Array.isArray(obj)) {
    mixin(instance, arrayProperties);
  }

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
        // Wrap each non-attribute tag in HTML comment,
        // remove Mustache comments
        return template.replace(
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

      var i, children, len, ai, alen, attr, val, ruleVal, buffer, pos, beginPos, bodyBeginPos, body, node, el, t, match, rule, token, block;
      var fragment = document.createDocumentFragment();
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
      if (template instanceof Node) {
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

        switch (el.nodeType) {

          // Element node
          case 1:

            // Check attributes
            for (ai = 0, alen = el.attributes.length; ai < alen; ai++) {

              attr = el.attributes[ai];
              val = attr.value;
              t = tokenizer(options, 'g');

              while ( (match = t.exec(val)) ) {

                rule = matchRules(match[0], el, attr.name, model, options);

                if (rule) {

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
                      attr.value = 
                        attr.value.slice(0, beginPos) +
                        rule.replace(attr.value.slice(bodyBeginPos, match.index)) +
                        attr.value.slice(match.index + match[0].length);
                    }
                  }

                  if (rule.change) {
                    model.on('change', rule.block || rule.prop, rule.change);
                    rule.change();
                  }

                } 

              }

            }

            // Recursively compile
            el.appendChild(compile(node, model, options));

            break;

          // Comment node
          case 8:
            if (matchEndBlock('', el.data, options)) {
              throw 'jtmpl: Unexpected ' + el.data;
            }

            if ( (match = el.data.match(tokenizer(options))) ) {

              rule = matchRules(el.data, match[1], null, model, options);
              if (rule) {

                // DOM replacement?
                if (rule.replace instanceof Node) {
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
},{"./consts":4,"./default-options":5,"./rules":8,"freak":2}],4:[function(_dereq_,module,exports){
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
/*
  
Default options

*/
    
    module.exports = {
      delimiters: ['{{', '}}']
    };

},{}],6:[function(_dereq_,module,exports){
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
          // Target doesn't already have prop?
          if (target(prop) === undefined) {
            target(prop, properties[prop]);
          }
        }
      }

      function evalObject(body) {
        var result, module = { exports: {} };
        return (body.match(/^\s*{[\S\s]*}\s*$/)) ?
          // Literal
          eval('result=' + body) :
          // CommonJS module
          new Function('module', 'exports', body + ';return module.exports;')
            (module, module.exports);
      }

      function loadModel(src, template, doc) {
        if (!src) {
          // No source
          jtmpl(target, template, model);
        }
        else if (src.match(consts.RE_NODE_ID)) {
          // Element in this document
          var element = doc.querySelector(src);
          mixin(model, evalObject(element.innerHTML));
          jtmpl(target, template, model);
        }
        else {
          // Get model via XHR
          jtmpl('GET', src, function (resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var element = match && new DOMParser()
              .parseFromString(resp, 'text/html')
              .querySelector(match[1]);
            mixin(model, match ? evalObject(element.innerHTML) : {});
            jtmpl(target, template, model);
          });
        }
      }

      function loadTemplate() {
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
            var doc = match ? new DOMParser().parseFromString(resp, 'text/html') : document;
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

},{"./consts":4}],7:[function(_dereq_,module,exports){
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

      // jtmpl(template, model[, options])?
      else if (
        typeof args[0] === 'string' && 
        ['object', 'function'].indexOf(typeof args[1]) > -1 &&
        ['object', 'undefined'].indexOf(typeof args[2]) > -1
      ) {
        return _dereq_('./compiler').apply(null, args);
      }

      // jtmpl(target, template, model[, options])?
      else if (
        ( args[0] instanceof Node || 
          (typeof args[0] === 'string')
        ) &&

        ( args[1] instanceof Node || 
          args[1] instanceof DocumentFragment ||
          (typeof args[1] === 'string')
        ) &&

        args[2] !== undefined

      ) {

        target = args[0] instanceof Node ?
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

    document.addEventListener('DOMContentLoaded', function() {

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

Export

*/
    module.exports = jtmpl;
},{"./compiler":3,"./consts":4,"./loader":6,"./xhr":15,"freak":2}],8:[function(_dereq_,module,exports){
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
      _dereq_('./rules/var')
    ];













},{"./rules/class-section":9,"./rules/inverted-section":10,"./rules/partial":11,"./rules/section":12,"./rules/value-var":13,"./rules/var":14}],9:[function(_dereq_,module,exports){
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

},{"../consts":4,"element-class":1}],10:[function(_dereq_,module,exports){
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
},{"../compiler":3,"../consts":4}],11:[function(_dereq_,module,exports){
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

      if (match) {

        return {
          prop: match[1],

          replace: anchor,
          
          change: function() {
            _dereq_('../loader')(
              anchor.parentNode,
              match[1] ?
                // Variable
                model(match[1]) :
                // Literal
                match[2] || match[3],
              model
            )
          }
        };

      }
    }

},{"../consts":4,"../loader":6}],12:[function(_dereq_,module,exports){
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
        if (typeof val === 'function' && val.len) {
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
},{"../compiler":3,"../consts":4}],13:[function(_dereq_,module,exports){
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
          node[attr] = val;
        }
      }
      
      if (match && ['value', 'checked', 'selected'].indexOf(attr) > -1) {
        // <select> option?
        if (node.nodeName === 'OPTION') {
          // Attach async, as parentNode is still documentFragment
          setTimeout(function() {
            node.parentNode.addEventListener('change', function() {
              if (model(prop) !== node.selected) {
                model(prop, node.selected);
              }
            });
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

},{"../consts":4}],14:[function(_dereq_,module,exports){
/*

### {{var}}

Can be bound to text node data or attribute

*/

    module.exports = function(tag, node, attr, model, options) {
      var react, target, change;
      
      if (tag.match(_dereq_('../consts').RE_IDENTIFIER)) {

        if (attr) {
          // Attribute
          change = function() {
            var val = model(tag);
            return val ?
              node.setAttribute(attr, val) :
              node.removeAttribute(attr);
          };
        }
        else {
          // Text node
          target = document.createTextNode('');
          change = function() {
            target.data = model(tag) || '';
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

},{"../consts":4}],15:[function(_dereq_,module,exports){
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

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9ub2RlX21vZHVsZXMvZWxlbWVudC1jbGFzcy9pbmRleC5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9jb21waWxlci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9jb25zdHMuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvZGVmYXVsdC1vcHRpb25zLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL2xvYWRlci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9tYWluLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL2NsYXNzLXNlY3Rpb24uanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbi5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9wYXJ0aWFsLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3NlY3Rpb24uanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdmFsdWUtdmFyLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3Zhci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy94aHIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRzKSB7XG4gIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG59XG5cbmZ1bmN0aW9uIEVsZW1lbnRDbGFzcyhvcHRzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBFbGVtZW50Q2xhc3MpKSByZXR1cm4gbmV3IEVsZW1lbnRDbGFzcyhvcHRzKVxuICB2YXIgc2VsZiA9IHRoaXNcbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cblxuICAvLyBzaW1pbGFyIGRvaW5nIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgYnV0IHdvcmtzIGluIElFOFxuICBpZiAob3B0cy5ub2RlVHlwZSkgb3B0cyA9IHtlbDogb3B0c31cblxuICB0aGlzLm9wdHMgPSBvcHRzXG4gIHRoaXMuZWwgPSBvcHRzLmVsIHx8IGRvY3VtZW50LmJvZHlcbiAgaWYgKHR5cGVvZiB0aGlzLmVsICE9PSAnb2JqZWN0JykgdGhpcy5lbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy5lbClcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZVxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIGlmIChjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xKSByZXR1cm4gY2xhc3Nlc1xuICBjbGFzc2VzLnB1c2goY2xhc3NOYW1lKVxuICBlbC5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKVxuICByZXR1cm4gY2xhc3Nlc1xufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICB2YXIgaWR4ID0gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSlcbiAgaWYgKGlkeCA+IC0xKSBjbGFzc2VzLnNwbGljZShpZHgsIDEpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgcmV0dXJuIGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTFcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnJlYWsob2JqLCByb290LCBwYXJlbnQsIHByb3ApIHtcblxuICB2YXIgbGlzdGVuZXJzID0ge1xuICAgICdjaGFuZ2UnOiB7fSxcbiAgICAnaW5zZXJ0Jzoge30sXG4gICAgJ2RlbGV0ZSc6IHt9XG4gIH07XG4gIHZhciBkZXBlbmRlbnRzID0ge307XG4gIHZhciBjaGlsZHJlbiA9IHt9O1xuXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/IFxuICAgICAgYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPSBcbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuXG4gICAgLy8gQXJncyBjaGVja1xuICAgIGFzc2VydChbJ2NoYW5nZScsICdpbnNlcnQnLCAnZGVsZXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSk7XG4gICAgYXNzZXJ0KFxuICAgICAgKGV2ZW50ID09PSAnY2hhbmdlJyAmJiBwcm9wICE9PSBudWxsKSB8fFxuICAgICAgKChldmVudCA9PT0gJ2luc2VydCcgfHwgZXZlbnQgPT09ICdkZWxldGUnKSAmJiAhcHJvcClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvZmYoKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9IFxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG4gICAgdmFyIGk7XG5cbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBhbGwgcHJvcGVydHkgd2F0Y2hlcnM/XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFJlbW92ZSBzcGVjaWZpYyBjYWxsYmFja1xuICAgICAgaSA9IGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICBpZiAoaSA+IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0uc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICB9ICBcblxuICAvLyB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKVxuICAvLyB0cmlnZ2VyKCdpbnNlcnQnIG9yICdkZWxldGUnLCBpbmRleCwgY291bnQpXG4gIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGEsIGIpIHtcbiAgICAobGlzdGVuZXJzW2V2ZW50XVtldmVudCA9PT0gJ2NoYW5nZScgPyBhIDogbnVsbF0gfHwgW10pXG4gICAgICAubWFwKGZ1bmN0aW9uKGxpc3RlbmVyKSB7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yXG4gIGZ1bmN0aW9uIGFjY2Vzc29yKHByb3AsIGFyZywgcmVmcmVzaCkge1xuXG4gICAgdmFyIGksIGxlbiwgZGVwLCByZXN1bHQsIHZhbDtcblxuICAgIC8vIExpZnQgYWNjZXNzb3IsIHRyYWNrIGRlcGVuZGVuY2llc1xuICAgIGZ1bmN0aW9uIGRlcGVuZGVuY3lUcmFja2VyKF9wcm9wLCBfYXJnLCBfcmVmcmVzaCkge1xuICAgICAgaWYgKCFkZXBlbmRlbnRzW19wcm9wXSkge1xuICAgICAgICBkZXBlbmRlbnRzW19wcm9wXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKGRlcGVuZGVudHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgIGRlcGVuZGVudHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjZXNzb3IoX3Byb3AsIF9hcmcsIF9yZWZyZXNoKTtcbiAgICB9XG5cbiAgICAvLyBHZXR0ZXI/XG4gICAgaWYgKChhcmcgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSAmJiAhcmVmcmVzaCkge1xuXG4gICAgICB2YWwgPSBvYmpbcHJvcF07XG5cbiAgICAgIHJlc3VsdCA9ICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICAgIHZhbC5jYWxsKGRlcGVuZGVuY3lUcmFja2VyLCBhcmcpIDpcbiAgICAgICAgLy8gU3RhdGljIHByb3BlcnR5IChsZWFmIGluIHRoZSBkZXBlbmRlbmN5IHRyZWUpXG4gICAgICAgIHZhbDtcblxuICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnID8gXG5cbiAgICAgICAgdHlwZW9mIGNoaWxkcmVuW3Byb3BdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBjaGlsZHJlbltwcm9wXSA6XG4gICAgICAgICAgY2hpbGRyZW5bcHJvcF0gPSBmcmVhayh2YWwsIHJvb3QgfHwgaW5zdGFuY2UsIGluc3RhbmNlLCBwcm9wKSA6XG5cbiAgICAgICAgcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIFNldHRlclxuICAgIGVsc2Uge1xuXG4gICAgICBpZiAoIXJlZnJlc2gpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eSBzZXR0ZXJcbiAgICAgICAgICBvYmpbcHJvcF0uY2FsbChkZXBlbmRlbmN5VHJhY2tlciwgYXJnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBTaW1wbGUgcHJvcGVydHkuIGBhcmdgIGlzIHRoZSBuZXcgdmFsdWVcbiAgICAgICAgICBvYmpbcHJvcF0gPSBhcmc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gTm90aWZ5IGRlcGVuZGVudHNcbiAgICAgIGZvciAoaSA9IDAsIGRlcCA9IGRlcGVuZGVudHNbcHJvcF0gfHwgW10sIGxlbiA9IGRlcC5sZW5ndGg7XG4gICAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGFjY2Vzc29yKGRlcFtpXSwgYXJnLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgLy8gRW1pdCB1cGRhdGUgZXZlbnRcbiAgICAgIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApO1xuXG4gICAgfSAvLyBpZiBnZXR0ZXIgICAgICAgIFxuXG4gIH0gLy8gZW5kIGFjY2Vzc29yXG5cbiAgdmFyIGFycmF5UHJvcGVydGllcyA9IHtcbiAgICAvLyBGdW5jdGlvbiBwcm90b3R5cGUgYWxyZWFkeSBjb250YWlucyBsZW5ndGhcbiAgICBsZW46IG9iai5sZW5ndGgsXG5cbiAgICBwb3A6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnBvcC5hcHBseShvYmopO1xuICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICB0cmlnZ2VyKCdkZWxldGUnLCB0aGlzLmxlbiwgMSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBwdXNoOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS5wdXNoLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIHRoaXMubGVuID0gdGhpcy52YWx1ZXMubGVuZ3RoO1xuICAgICAgdHJpZ2dlcignaW5zZXJ0JywgdGhpcy5sZW4gLSAxLCAxKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHJldmVyc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnJldmVyc2UuYXBwbHkob2JqKTtcbiAgICAgIHRoaXMubGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBzaGlmdDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10uc2hpZnQuYXBwbHkob2JqKTtcbiAgICAgIHRoaXMubGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHVuc2hpZnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnVuc2hpZnQuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgdGhpcy5sZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIDEpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc29ydDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10uc29ydC5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICBjaGlsZHJlbiA9IHt9O1xuICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc3BsaWNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS5zcGxpY2UuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgdGhpcy5sZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgfVxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzLmxlbmd0aCAtIDIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgfTtcblxuICB2YXIgaW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gYWNjZXNzb3IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICB2YXIgaW5zdGFuY2VQcm9wZXJ0aWVzID0ge1xuICAgIHZhbHVlczogb2JqLFxuICAgIHBhcmVudDogcGFyZW50IHx8IG51bGwsXG4gICAgcm9vdDogcm9vdCB8fCBpbnN0YW5jZSxcbiAgICBwcm9wOiBwcm9wIHx8IG51bGwsXG4gICAgLy8gLm9uKGV2ZW50WywgcHJvcF0sIGNhbGxiYWNrKVxuICAgIG9uOiBvbixcbiAgICAvLyAub2ZmKGV2ZW50WywgcHJvcF1bLCBjYWxsYmFja10pXG4gICAgb2ZmOiBvZmZcbiAgfTtcblxuICBtaXhpbihpbnN0YW5jZSwgaW5zdGFuY2VQcm9wZXJ0aWVzKTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgbWl4aW4oaW5zdGFuY2UsIGFycmF5UHJvcGVydGllcyk7XG4gIH1cblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrOyIsIi8qXG5cbiMjIENvbXBpbGVyXG5cbiovXG5cblxuLypcblxuIyMjIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsWywgb3B0aW9uc10pXG5cblJldHVybiBkb2N1bWVudEZyYWdtZW50XG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsLCBvcHRpb25zKSB7XG5cbiAgICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuXG4gICAgICAvLyBVdGlsaXR5IGZ1bmN0aW9uc1xuXG4gICAgICBmdW5jdGlvbiBlc2NhcGVSRShzKSB7XG4gICAgICAgIHJldHVybiAgKHMgKyAnJykucmVwbGFjZSgvKFsuPyorXiRbXFxdXFxcXCgpe318LV0pL2csICdcXFxcJDEnKTtcbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiB0b2tlbml6ZXIob3B0aW9ucywgZmxhZ3MpIHtcbiAgICAgICAgcmV0dXJuIFJlZ0V4cChcbiAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICsgXG4gICAgICAgICAgJygnICsgY29uc3RzLlJFX0FOWVRISU5HICsgJyknICtcbiAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMV0pLFxuICAgICAgICAgIGZsYWdzXG4gICAgICAgICk7XG4gICAgICB9XG5cblxuICAgICAgZnVuY3Rpb24gbWF0Y2hSdWxlcyh0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBpLCBtYXRjaDtcbiAgICAgICAgdmFyIHJ1bGVzID0gcmVxdWlyZSgnLi9ydWxlcycpO1xuICAgICAgICB2YXIgcnVsZXNMZW4gPSBydWxlcy5sZW5ndGg7XG5cbiAgICAgICAgLy8gU3RyaXAgZGVsaW1pdGVyc1xuICAgICAgICB0YWcgPSB0YWcuc2xpY2Uob3B0aW9ucy5kZWxpbWl0ZXJzWzBdLmxlbmd0aCwgLW9wdGlvbnMuZGVsaW1pdGVyc1sxXS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBydWxlc0xlbjsgaSsrKSB7XG4gICAgICAgICAgbWF0Y2ggPSBydWxlc1tpXSh0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIG1hdGNoLmluZGV4ID0gaTtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICAgIC8vIFdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiBIVE1MIGNvbW1lbnQsXG4gICAgICAgIC8vIHJlbW92ZSBNdXN0YWNoZSBjb21tZW50c1xuICAgICAgICByZXR1cm4gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgICB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKSxcbiAgICAgICAgICBmdW5jdGlvbihtYXRjaCwgbWF0Y2gxLCBwb3MpIHtcbiAgICAgICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgICAgIHZhciBpbnNpZGVUYWcgPSAhIWhlYWQubWF0Y2goUmVnRXhwKCc8JyArIGNvbnN0cy5SRV9TUkNfSURFTlRJRklFUiArICdbXj5dKj8kJykpO1xuICAgICAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICAgICAgcmV0dXJuIGluc2lkZVRhZyB8fCBpbnNpZGVDb21tZW50ID9cbiAgICAgICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgPyBcbiAgICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgICAnPCEtLScgKyBtYXRjaCArICctLT4nO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBtYXRjaEVuZEJsb2NrKGJsb2NrLCB0ZW1wbGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgbWF0Y2ggPSB0ZW1wbGF0ZS5tYXRjaChcbiAgICAgICAgICBSZWdFeHAoXG4gICAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0pICsgXG4gICAgICAgICAgICAnXFxcXC8nICsgY29uc3RzLlJFX1NSQ19JREVOVElGSUVSICsgJz8nICtcbiAgICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1sxXSlcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBtYXRjaCA/XG4gICAgICAgICAgYmxvY2sgPT09ICcnIHx8IG1hdGNoWzFdID09PSB1bmRlZmluZWQgfHwgbWF0Y2hbMV0gPT09IGJsb2NrIDpcbiAgICAgICAgICBmYWxzZTtcbiAgICAgIH1cblxuXG4gICAgICAvLyBWYXJpYWJsZXNcblxuICAgICAgdmFyIGksIGNoaWxkcmVuLCBsZW4sIGFpLCBhbGVuLCBhdHRyLCB2YWwsIHJ1bGVWYWwsIGJ1ZmZlciwgcG9zLCBiZWdpblBvcywgYm9keUJlZ2luUG9zLCBib2R5LCBub2RlLCBlbCwgdCwgbWF0Y2gsIHJ1bGUsIHRva2VuLCBibG9jaztcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBmcmVhayA9IHJlcXVpcmUoJ2ZyZWFrJyk7XG5cbiAgICAgIC8vIEluaXRcbiAgICAgIFxuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgcmVxdWlyZSgnLi9kZWZhdWx0LW9wdGlvbnMnKTtcblxuICAgICAgbW9kZWwgPSBcbiAgICAgICAgdHlwZW9mIG1vZGVsID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAvLyBGcmVhayBpbnN0YW5jZVxuICAgICAgICAgIG1vZGVsIDpcbiAgICAgICAgICB0eXBlb2YgbW9kZWwgPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgIC8vIFdyYXAgb2JqZWN0XG4gICAgICAgICAgICBmcmVhayhtb2RlbCkgOlxuICAgICAgICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICAgICAgICBmcmVhayh7Jy4nOiBtb2RlbH0pO1xuXG4gICAgICAvLyBUZW1wbGF0ZSBjYW4gYmUgYSBzdHJpbmcgb3IgRE9NIHN0cnVjdHVyZVxuICAgICAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICBib2R5ID0gdGVtcGxhdGU7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGVtcGxhdGUgPSBwcmVwcm9jZXNzKHRlbXBsYXRlLCBvcHRpb25zKTtcblxuICAgICAgICBib2R5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICBib2R5LmlubmVySFRNTCA9IHRlbXBsYXRlO1xuICAgICAgfVxuXG4gICAgICAvLyBJdGVyYXRlIGNoaWxkIG5vZGVzLlxuICAgICAgZm9yIChpID0gMCwgY2hpbGRyZW4gPSBib2R5LmNoaWxkTm9kZXMsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aCA7IGkgPCBsZW47IGkrKykge1xuXG4gICAgICAgIG5vZGUgPSBjaGlsZHJlbltpXTtcblxuICAgICAgICAvLyBTaGFsbG93IGNvcHkgb2Ygbm9kZSBhbmQgYXR0cmlidXRlcyAoaWYgZWxlbWVudClcbiAgICAgICAgZWwgPSBub2RlLmNsb25lTm9kZShmYWxzZSk7XG4gICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGVsKTtcblxuICAgICAgICBzd2l0Y2ggKGVsLm5vZGVUeXBlKSB7XG5cbiAgICAgICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgICAgICBjYXNlIDE6XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGZvciAoYWkgPSAwLCBhbGVuID0gZWwuYXR0cmlidXRlcy5sZW5ndGg7IGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICAgIGF0dHIgPSBlbC5hdHRyaWJ1dGVzW2FpXTtcbiAgICAgICAgICAgICAgdmFsID0gYXR0ci52YWx1ZTtcbiAgICAgICAgICAgICAgdCA9IHRva2VuaXplcihvcHRpb25zLCAnZycpO1xuXG4gICAgICAgICAgICAgIHdoaWxlICggKG1hdGNoID0gdC5leGVjKHZhbCkpICkge1xuXG4gICAgICAgICAgICAgICAgcnVsZSA9IG1hdGNoUnVsZXMobWF0Y2hbMF0sIGVsLCBhdHRyLm5hbWUsIG1vZGVsLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2sgPSBtYXRjaFswXTtcbiAgICAgICAgICAgICAgICAgICAgYmVnaW5Qb3MgPSBtYXRjaC5pbmRleDtcbiAgICAgICAgICAgICAgICAgICAgYm9keUJlZ2luUG9zID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBjbG9zaW5nIHRhZ1xuICAgICAgICAgICAgICAgICAgICBmb3IgKDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAhbWF0Y2hFbmRCbG9jayhydWxlLmJsb2NrLCBtYXRjaFswXSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IHQuZXhlYyh2YWwpKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1VuY2xvc2VkJyArIGJsb2NrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgZnVsbCBibG9jayB0YWcgYm9keSB3aXRoIHJ1bGUgY29udGVudHNcbiAgICAgICAgICAgICAgICAgICAgICBhdHRyLnZhbHVlID0gXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyLnZhbHVlLnNsaWNlKDAsIGJlZ2luUG9zKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBydWxlLnJlcGxhY2UoYXR0ci52YWx1ZS5zbGljZShib2R5QmVnaW5Qb3MsIG1hdGNoLmluZGV4KSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYXR0ci52YWx1ZS5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKHJ1bGUuY2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBydWxlLmJsb2NrIHx8IHJ1bGUucHJvcCwgcnVsZS5jaGFuZ2UpO1xuICAgICAgICAgICAgICAgICAgICBydWxlLmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSBcblxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVjdXJzaXZlbHkgY29tcGlsZVxuICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoY29tcGlsZShub2RlLCBtb2RlbCwgb3B0aW9ucykpO1xuXG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgODpcbiAgICAgICAgICAgIGlmIChtYXRjaEVuZEJsb2NrKCcnLCBlbC5kYXRhLCBvcHRpb25zKSkge1xuICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuZXhwZWN0ZWQgJyArIGVsLmRhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggKG1hdGNoID0gZWwuZGF0YS5tYXRjaCh0b2tlbml6ZXIob3B0aW9ucykpKSApIHtcblxuICAgICAgICAgICAgICBydWxlID0gbWF0Y2hSdWxlcyhlbC5kYXRhLCBtYXRjaFsxXSwgbnVsbCwgbW9kZWwsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICBpZiAocnVsZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gRE9NIHJlcGxhY2VtZW50P1xuICAgICAgICAgICAgICAgIGlmIChydWxlLnJlcGxhY2UgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgICAgICAgICAgICBlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChydWxlLnJlcGxhY2UsIGVsKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBGZXRjaCBibG9jayB0YWcgY29udGVudHM/XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUuYmxvY2spIHtcblxuICAgICAgICAgICAgICAgICAgYmxvY2sgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgICAgIGZvciAoaSsrO1xuXG4gICAgICAgICAgICAgICAgICAgICAgKGkgPCBsZW4pICYmIFxuICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIGNoaWxkcmVuW2ldLmRhdGEgfHwgJycsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGRyZW5baV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBlbC5kYXRhO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlcGxhY2UgYGVsYCB3aXRoIGBydWxlLnJlcGxhY2UoKWAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHJ1bGUucmVwbGFjZShibG9jaywgZWwucGFyZW50Tm9kZSksIGVsKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5wcm9wICYmIHJ1bGUuY2hhbmdlKSB7XG4gICAgICAgICAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcnVsZS5wcm9wLCBydWxlLmNoYW5nZSk7XG4gICAgICAgICAgICAgICAgICBydWxlLmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgfSAvLyBzd2l0Y2hcblxuICAgICAgfSAvLyBmb3JcblxuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH07IiwiLypcblxuIyMgQ29uc3RhbnRzXG5cbiovICAgIFxuICBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIFJFX0lERU5USUZJRVI6IC9eW1xcd1xcLlxcLV0rJC8sXG5cbiAgICBSRV9TUkNfSURFTlRJRklFUjogJyhbXFxcXHdcXFxcLlxcXFwtXSspJyxcblxuICAgIC8vIG1hdGNoOiBbMV09dmFyX25hbWUsIFsyXT0nc2luZ2xlLXF1b3RlZCcgWzNdPVwiZG91YmUtcXVvdGVkXCJcbiAgICBSRV9QQVJUSUFMOiAvPihbXFx3XFwuXFwtXSspfCcoW15cXCddKilcXCd8XCIoW15cIl0qKVwiLyxcblxuICAgIFJFX1BJUEU6IC9eW1xcd1xcLlxcLV0rKD86XFx8W1xcd1xcLlxcLV0rKT8kLyxcblxuICAgIFJFX05PREVfSUQ6IC9eI1tcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfRU5EU19XSVRIX05PREVfSUQ6IC8uKygjW1xcd1xcLlxcLV0rKSQvLFxuXG4gICAgUkVfQU5ZVEhJTkc6ICdbXFxcXHNcXFxcU10qPycsXG5cbiAgICBSRV9TUEFDRTogJ1xcXFxzKidcblxuICB9O1xuIiwiLypcbiAgXG5EZWZhdWx0IG9wdGlvbnNcblxuKi9cbiAgICBcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgIGRlbGltaXRlcnM6IFsne3snLCAnfX0nXVxuICAgIH07XG4iLCIvKlxuXG5FdmFsdWF0ZSBvYmplY3QgZnJvbSBsaXRlcmFsIG9yIENvbW1vbkpTIG1vZHVsZVxuXG4qL1xuXG4gIFx0LyoganNoaW50IGV2aWw6dHJ1ZSAqL1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBzcmMsIG1vZGVsKSB7XG5cbiAgICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuXG4gICAgICBtb2RlbCA9IG1vZGVsIHx8IHt9O1xuICAgICAgaWYgKHR5cGVvZiBtb2RlbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBtb2RlbCA9IGp0bXBsLmZyZWFrKG1vZGVsKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgIC8vIFRhcmdldCBkb2Vzbid0IGFscmVhZHkgaGF2ZSBwcm9wP1xuICAgICAgICAgIGlmICh0YXJnZXQocHJvcCkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGFyZ2V0KHByb3AsIHByb3BlcnRpZXNbcHJvcF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBldmFsT2JqZWN0KGJvZHkpIHtcbiAgICAgICAgdmFyIHJlc3VsdCwgbW9kdWxlID0geyBleHBvcnRzOiB7fSB9O1xuICAgICAgICByZXR1cm4gKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSA/XG4gICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgIGV2YWwoJ3Jlc3VsdD0nICsgYm9keSkgOlxuICAgICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICAgIG5ldyBGdW5jdGlvbignbW9kdWxlJywgJ2V4cG9ydHMnLCBib2R5ICsgJztyZXR1cm4gbW9kdWxlLmV4cG9ydHM7JylcbiAgICAgICAgICAgIChtb2R1bGUsIG1vZHVsZS5leHBvcnRzKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZE1vZGVsKHNyYywgdGVtcGxhdGUsIGRvYykge1xuICAgICAgICBpZiAoIXNyYykge1xuICAgICAgICAgIC8vIE5vIHNvdXJjZVxuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzcmMubWF0Y2goY29uc3RzLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gRWxlbWVudCBpbiB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KGVsZW1lbnQuaW5uZXJIVE1MKSk7XG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIEdldCBtb2RlbCB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIHNyYywgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChjb25zdHMuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAgICAgLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJylcbiAgICAgICAgICAgICAgLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuICAgICAgICAgICAgbWl4aW4obW9kZWwsIG1hdGNoID8gZXZhbE9iamVjdChlbGVtZW50LmlubmVySFRNTCkgOiB7fSk7XG4gICAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKCkge1xuICAgICAgICBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIGlzIHRoZSBjb250ZW50cyBvZiBlbGVtZW50XG4gICAgICAgICAgLy8gYmVsb25naW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBsb2FkTW9kZWwoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSwgZWxlbWVudC5pbm5lckhUTUwsIGRvY3VtZW50KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBHZXQgdGVtcGxhdGUgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBzcmMsIGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChjb25zdHMuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgdmFyIGRvYyA9IG1hdGNoID8gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJykgOiBkb2N1bWVudDtcbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgZG9jLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuXG4gICAgICAgICAgICBsb2FkTW9kZWwoXG4gICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSA6ICcnLFxuICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCxcbiAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvYWRUZW1wbGF0ZSgpO1xuICAgIH07XG4iLCIvKlxuIFxuIyMgTWFpbiBmdW5jdGlvblxuXG4qL1xuICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuXG4gICAgZnVuY3Rpb24ganRtcGwoKSB7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIHZhciB0YXJnZXQsIHQsIHRlbXBsYXRlLCBtb2RlbDtcbiAgXG4gICAgICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgICAgIGlmIChbJ0dFVCcsICdQT1NUJ10uaW5kZXhPZihhcmdzWzBdKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKCcuL3hocicpLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQpP1xuICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIHJldHVybiBtb2RlbFxuICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKS5fX2p0bXBsX187XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgIFsnb2JqZWN0JywgJ2Z1bmN0aW9uJ10uaW5kZXhPZih0eXBlb2YgYXJnc1sxXSkgPiAtMSAmJlxuICAgICAgICBbJ29iamVjdCcsICd1bmRlZmluZWQnXS5pbmRleE9mKHR5cGVvZiBhcmdzWzJdKSA+IC0xXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJy4vY29tcGlsZXInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gICAgICBlbHNlIGlmIChcbiAgICAgICAgKCBhcmdzWzBdIGluc3RhbmNlb2YgTm9kZSB8fCBcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgKCBhcmdzWzFdIGluc3RhbmNlb2YgTm9kZSB8fCBcbiAgICAgICAgICBhcmdzWzFdIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCB8fFxuICAgICAgICAgICh0eXBlb2YgYXJnc1sxXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICBhcmdzWzJdICE9PSB1bmRlZmluZWRcblxuICAgICAgKSB7XG5cbiAgICAgICAgdGFyZ2V0ID0gYXJnc1swXSBpbnN0YW5jZW9mIE5vZGUgP1xuICAgICAgICAgIGFyZ3NbMF0gOlxuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICAgICAgdGVtcGxhdGUgPSBhcmdzWzFdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgICAgIGFyZ3NbMV07XG5cbiAgICAgICAgbW9kZWwgPSBcbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAvLyBhbHJlYWR5IHdyYXBwZWRcbiAgICAgICAgICAgIGFyZ3NbMl0gOlxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHdyYXBcbiAgICAgICAgICAgIGp0bXBsLmZyZWFrKFxuICAgICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgIC8vIG9iamVjdFxuICAgICAgICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMl0ubWF0Y2goY29uc3RzLlJFX05PREVfSUQpID9cbiAgICAgICAgICAgICAgICAgIC8vIHNyYywgbG9hZCBpdFxuICAgICAgICAgICAgICAgICAgcmVxdWlyZSgnLi9sb2FkZXInKVxuICAgICAgICAgICAgICAgICAgICAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzJdKS5pbm5lckhUTUwpIDpcblxuICAgICAgICAgICAgICAgICAgLy8gc2ltcGxlIHZhbHVlLCBib3ggaXRcbiAgICAgICAgICAgICAgICAgIHsnLic6IGFyZ3NbMl19XG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGlmICh0YXJnZXQubm9kZU5hbWUgPT09ICdTQ1JJUFQnKSB7XG4gICAgICAgICAgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIHQuaWQgPSB0YXJnZXQuaWQ7XG4gICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHQsIHRhcmdldCk7XG4gICAgICAgICAgdGFyZ2V0ID0gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc29jaWF0ZSB0YXJnZXQgYW5kIG1vZGVsXG4gICAgICAgIHRhcmdldC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgICAgICAvLyBFbXB0eSB0YXJnZXRcbiAgICAgICAgdGFyZ2V0LmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQocmVxdWlyZSgnLi9jb21waWxlcicpKHRlbXBsYXRlLCBtb2RlbCwgYXJnc1szXSkpO1xuICAgICAgfVxuICAgIH1cblxuXG5cbi8qXG5cbk9uIHBhZ2UgcmVhZHksIHByb2Nlc3MganRtcGwgdGFyZ2V0c1xuXG4qL1xuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uKCkge1xuXG4gICAgICB2YXIgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbiAgICAgIHZhciB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtanRtcGxdJyk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0YXJnZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGxvYWRlcih0YXJnZXRzW2ldLCB0YXJnZXRzW2ldLmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4vKlxuXG5FeHBvc2UgZnJlYWtcblxuKi9cblxuICAgIGp0bXBsLmZyZWFrID0gcmVxdWlyZSgnZnJlYWsnKTtcblxuXG5cblxuLypcblxuRXhwb3J0XG5cbiovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBqdG1wbDsiLCIvKlxuXG4jIyBSdWxlc1xuXG5FYWNoIHJ1bGUgaXMgYSBmdW5jdGlvbiwgYXJncyB3aGVuIGNhbGxlZCBhcmU6XG4odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucylcblxudGFnOiB0ZXh0IGJldHdlZW4gZGVsaW1pdGVycywge3t0YWd9fVxubm9kZTogRE9NIG5vZGUsIHdoZXJlIHRhZyBpcyBmb3VuZFxuYXR0cjogbm9kZSBhdHRyaWJ1dGUgb3IgbnVsbCwgaWYgbm9kZSBjb250ZW50c1xubW9kZWw6IEZyZWFrIG1vZGVsXG5vcHRpb25zOiBjb25maWd1cmF0aW9uIG9wdGlvbnNcblxuSXQgbXVzdCByZXR1cm4gZWl0aGVyOlxuXG4qIGZhbHN5IHZhbHVlIC0gbm8gbWF0Y2hcblxuKiBvYmplY3QgLSBtYXRjaCBmb3VuZCwgcmV0dXJuIChhbGwgZmllbGRzIG9wdGlvbmFsKVxuXG4gICAgIHtcbiAgICAgICAvLyBQYXJzZSB1bnRpbCB7ey99fSBvciB7ey9zb21lUHJvcH19IC4uLlxuICAgICAgIGJsb2NrOiAnc29tZVByb3AnLFxuXG4gICAgICAgLy8gLi4uIHRoZW4gdGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZC5cbiAgICAgICAvLyBJdCBtdXN0IHJldHVybiBzdHJpbmcgb3IgRE9NRWxlbWVudFxuICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkgeyAuLi4gfVxuICAgICB9XG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdmFsdWUtdmFyJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL2NsYXNzLXNlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9pbnZlcnRlZC1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3BhcnRpYWwnKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdmFyJylcbiAgICBdO1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwiLypcblxuIyMjIGNsYXNzPVwie3sjaWZDb25kaXRpb259fXNvbWUtY2xhc3N7ey99fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIGBtb2RlbC5pZkNvbmRpdGlvbmBcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJyMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIga2xhc3M7XG5cbiAgICAgIFxuICAgICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgbWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgICAgIFshIXZhbCAmJiAnYWRkJyB8fCAncmVtb3ZlJ10oa2xhc3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3teaW52ZXJ0ZWQtc2VjdGlvbn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ15cXFxcXicgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciB0ZW1wbGF0ZTtcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGNoYW5nZSk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCB2YWwoaSkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG4gICAgICAgICAgICByZXR1cm4gYW5jaG9yO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfSIsIi8qXG5cbiMjIyBQYXJ0aWFsIFxuXG4qIHt7PlwiI2lkXCJ9fVxuKiB7ez5cInVybFwifX1cbioge3s+XCJ1cmwjaWRcIn19XG4qIHt7PnBhcnRpYWxTcmN9fVxuXG5SZXBsYWNlcyBwYXJlbnQgdGFnIGNvbnRlbnRzLCBhbHdheXMgd3JhcCBpbiBhIHRhZ1xuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2goY29uc3RzLlJFX1BBUlRJQUwpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgICAgcmVwbGFjZTogYW5jaG9yLFxuICAgICAgICAgIFxuICAgICAgICAgIGNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXF1aXJlKCcuLi9sb2FkZXInKShcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUsXG4gICAgICAgICAgICAgIG1hdGNoWzFdID9cbiAgICAgICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgICAgICAgIG1hdGNoWzJdIHx8IG1hdGNoWzNdLFxuICAgICAgICAgICAgICBtb2RlbFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7eyNzZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgdGVtcGxhdGU7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgcGFyZW50LnJlcGxhY2VDaGlsZChcbiAgICAgICAgICAgIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGkpKSxcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaW5kZXggKyBpKSkpO1xuICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbikge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gdmFsLmxlbjsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YWwub24oJ2NoYW5nZScsIGksIHVwZGF0ZShpKSk7XG4gICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKGkpKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPYmplY3Q/XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKTtcbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG5cbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG5cbiAgICAgIH1cbiAgICB9IiwiLypcblxuIyMjICh2YWx1ZSB8IGNoZWNrZWQgfCBzZWxlY3RlZCk9XCJ7e3ZhbH19XCJcblxuSGFuZGxlIFwidmFsdWVcIiwgXCJjaGVja2VkXCIgYW5kIFwic2VsZWN0ZWRcIiBhdHRyaWJ1dGVzXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgbm9kZVthdHRyXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAobWF0Y2ggJiYgWyd2YWx1ZScsICdjaGVja2VkJywgJ3NlbGVjdGVkJ10uaW5kZXhPZihhdHRyKSA+IC0xKSB7XG4gICAgICAgIC8vIDxzZWxlY3Q+IG9wdGlvbj9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgLy8gQXR0YWNoIGFzeW5jLCBhcyBwYXJlbnROb2RlIGlzIHN0aWxsIGRvY3VtZW50RnJhZ21lbnRcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBpZiAobW9kZWwocHJvcCkgIT09IG5vZGUuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlLnNlbGVjdGVkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGVbYXR0cl0pIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIFxuICAgICAgICAgICAgICAgICAgaW5wdXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaW5wdXRbdHlwZT1yYWRpb11bbmFtZT0nICsgbm9kZS5uYW1lICsgJ10nKSxcbiAgICAgICAgICAgICAgICAgIGxlbiA9IGlucHV0cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICBpIDwgbGVuO1xuICAgICAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0c1tpXSAhPT0gbm9kZSkge1xuICAgICAgICAgICAgICAgICAgaW5wdXRzW2ldLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRleHQgaW5wdXQ/XG4gICAgICAgIHZhciBldmVudFR5cGUgPSBbJ3RleHQnLCAncGFzc3dvcmQnXS5pbmRleE9mKG5vZGUudHlwZSkgPiAtMSA/XG4gICAgICAgICAgJ2lucHV0JyA6ICdjaGFuZ2UnO1xuXG4gICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogJycsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3t2YXJ9fVxuXG5DYW4gYmUgYm91bmQgdG8gdGV4dCBub2RlIGRhdGEgb3IgYXR0cmlidXRlXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciByZWFjdCwgdGFyZ2V0LCBjaGFuZ2U7XG4gICAgICBcbiAgICAgIGlmICh0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUikpIHtcblxuICAgICAgICBpZiAoYXR0cikge1xuICAgICAgICAgIC8vIEF0dHJpYnV0ZVxuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHRhZyk7XG4gICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKSA6XG4gICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gVGV4dCBub2RlXG4gICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgICAgIGNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGFyZ2V0LmRhdGEgPSBtb2RlbCh0YWcpIHx8ICcnO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNYXRjaCBmb3VuZFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHRhZyxcbiAgICAgICAgICByZXBsYWNlOiB0YXJnZXQsXG4gICAgICAgICAgY2hhbmdlOiBjaGFuZ2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG5SZXF1ZXN0cyBBUElcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGVuLCBwcm9wLCBwcm9wcywgcmVxdWVzdDtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIC8vIExhc3QgZnVuY3Rpb24gYXJndW1lbnRcbiAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucmVkdWNlKFxuICAgICAgICBmdW5jdGlvbiAocHJldiwgY3Vycikge1xuICAgICAgICAgIHJldHVybiB0eXBlb2YgY3VyciA9PT0gJ2Z1bmN0aW9uJyA/IGN1cnIgOiBwcmV2O1xuICAgICAgICB9LFxuICAgICAgICBudWxsXG4gICAgICApO1xuXG4gICAgICB2YXIgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcblxuICAgICAgaWYgKHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIGZvciAoaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3B0cyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgcHJvcCA9IHByb3BzW2ldO1xuICAgICAgICB4aHJbcHJvcF0gPSBvcHRzW3Byb3BdO1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0ID1cbiAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJykgP1xuXG4gICAgICAgICAgLy8gU3RyaW5nIHBhcmFtZXRlcnNcbiAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcpID9cblxuICAgICAgICAgICAgLy8gT2JqZWN0IHBhcmFtZXRlcnMuIFNlcmlhbGl6ZSB0byBVUklcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGFyZ3NbMl0pLm1hcChcbiAgICAgICAgICAgICAgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3NbMl1beF0pO1xuICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgKS5qb2luKCcmJykgOlxuXG4gICAgICAgICAgICAvLyBObyBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAnJztcblxuICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHZhciByZXNwO1xuXG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXNwID0gdGhpcy5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgcmVzcCwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB4aHIub3BlbihhcmdzWzBdLCBhcmdzWzFdLFxuICAgICAgICAob3B0cy5hc3luYyAhPT0gdW5kZWZpbmVkID8gb3B0cy5hc3luYyA6IHRydWUpLCBcbiAgICAgICAgb3B0cy51c2VyLCBvcHRzLnBhc3N3b3JkKTtcblxuICAgICAgeGhyLnNlbmQocmVxdWVzdCk7XG5cbiAgICB9O1xuIl19
(7)
});
