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

              rule = matchRules(el.data, node, null, model, options);
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
},{"./compiler":3,"./consts":4,"./loader":6,"./xhr":16,"freak":2}],8:[function(_dereq_,module,exports){
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

},{"./rules/class-section":9,"./rules/inverted-section":10,"./rules/partial":11,"./rules/section":12,"./rules/unescaped-var":13,"./rules/value-var":14,"./rules/var":15}],9:[function(_dereq_,module,exports){
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

      var loader = match && 
        function() {
          _dereq_('../loader')(
            anchor.parentNode,
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

            el.innerHTML = model(prop);
            length = el.childNodes.length;
            for (i = 0; i < length; i++) {
              fragment.appendChild(el.childNodes[0]);
            }
            anchor.parentNode.insertBefore(fragment, anchor);
          }
        };
      }
    }

},{"../consts":4}],14:[function(_dereq_,module,exports){
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

},{"../consts":4}],15:[function(_dereq_,module,exports){
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

},{"../consts":4}],16:[function(_dereq_,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9ub2RlX21vZHVsZXMvZWxlbWVudC1jbGFzcy9pbmRleC5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9jb21waWxlci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9jb25zdHMuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvZGVmYXVsdC1vcHRpb25zLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL2xvYWRlci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9tYWluLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL2NsYXNzLXNlY3Rpb24uanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbi5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy9wYXJ0aWFsLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3J1bGVzL3NlY3Rpb24uanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdW5lc2NhcGVkLXZhci5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL3NyYy9ydWxlcy92YWx1ZS12YXIuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9zcmMvcnVsZXMvdmFyLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0cykge1xuICByZXR1cm4gbmV3IEVsZW1lbnRDbGFzcyhvcHRzKVxufVxuXG5mdW5jdGlvbiBFbGVtZW50Q2xhc3Mob3B0cykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRWxlbWVudENsYXNzKSkgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG5cbiAgLy8gc2ltaWxhciBkb2luZyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50IGJ1dCB3b3JrcyBpbiBJRThcbiAgaWYgKG9wdHMubm9kZVR5cGUpIG9wdHMgPSB7ZWw6IG9wdHN9XG5cbiAgdGhpcy5vcHRzID0gb3B0c1xuICB0aGlzLmVsID0gb3B0cy5lbCB8fCBkb2N1bWVudC5ib2R5XG4gIGlmICh0eXBlb2YgdGhpcy5lbCAhPT0gJ29iamVjdCcpIHRoaXMuZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMuZWwpXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVybiBlbC5jbGFzc05hbWUgPSBjbGFzc05hbWVcbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICBpZiAoY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMSkgcmV0dXJuIGNsYXNzZXNcbiAgY2xhc3Nlcy5wdXNoKGNsYXNzTmFtZSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgdmFyIGlkeCA9IGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpXG4gIGlmIChpZHggPiAtMSkgY2xhc3Nlcy5zcGxpY2UoaWR4LCAxKVxuICBlbC5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKVxuICByZXR1cm4gY2xhc3Nlc1xufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHJldHVybiBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ2luc2VydCc6IHt9LFxuICAgICdkZWxldGUnOiB7fVxuICB9O1xuICB2YXIgZGVwZW5kZW50cyA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICBmdW5jdGlvbiBhc3NlcnQoY29uZCwgbXNnKSB7XG4gICAgaWYgKCFjb25kKSB7XG4gICAgICB0aHJvdyBtc2cgfHwgJ2Fzc2VydGlvbiBmYWlsZWQnO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1peCBwcm9wZXJ0aWVzIGludG8gdGFyZ2V0XG4gIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgIGZvciAodmFyIGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3BlcnRpZXMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W3Byb3BzW2ldXSA9IHByb3BlcnRpZXNbcHJvcHNbaV1dO1xuICAgIH1cbiAgfVxuXG4gIC8vIEV2ZW50IGZ1bmN0aW9uc1xuICBmdW5jdGlvbiBvbigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSBbJ3N0cmluZycsICdudW1iZXInXS5pbmRleE9mKHR5cGVvZiBhcmd1bWVudHNbMV0pID4gLTEgPyBcbiAgICAgIGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID0gXG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAnaW5zZXJ0JywgJ2RlbGV0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEpO1xuICAgIGFzc2VydChcbiAgICAgIChldmVudCA9PT0gJ2NoYW5nZScgJiYgcHJvcCAhPT0gbnVsbCkgfHxcbiAgICAgICgoZXZlbnQgPT09ICdpbnNlcnQnIHx8IGV2ZW50ID09PSAnZGVsZXRlJykgJiYgIXByb3ApXG4gICAgKTtcblxuICAgIC8vIEluaXQgbGlzdGVuZXJzIGZvciBwcm9wXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIC8vIEFscmVhZHkgcmVnaXN0ZXJlZD9cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb2ZmKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdzdHJpbmcnID8gYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPSBcbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSAgXG5cbiAgLy8gdHJpZ2dlcignY2hhbmdlJywgcHJvcClcbiAgLy8gdHJpZ2dlcignaW5zZXJ0JyBvciAnZGVsZXRlJywgaW5kZXgsIGNvdW50KVxuICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBhLCBiKSB7XG4gICAgKGxpc3RlbmVyc1tldmVudF1bZXZlbnQgPT09ICdjaGFuZ2UnID8gYSA6IG51bGxdIHx8IFtdKVxuICAgICAgLm1hcChmdW5jdGlvbihsaXN0ZW5lcikge1xuICAgICAgICBsaXN0ZW5lci5jYWxsKGluc3RhbmNlLCBhLCBiKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gRnVuY3Rpb25hbCBhY2Nlc3NvclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcsIHJlZnJlc2gpIHtcblxuICAgIHZhciBpLCBsZW4sIGRlcCwgcmVzdWx0LCB2YWw7XG5cbiAgICAvLyBMaWZ0IGFjY2Vzc29yLCB0cmFjayBkZXBlbmRlbmNpZXNcbiAgICBmdW5jdGlvbiBkZXBlbmRlbmN5VHJhY2tlcihfcHJvcCwgX2FyZywgX3JlZnJlc2gpIHtcbiAgICAgIGlmICghZGVwZW5kZW50c1tfcHJvcF0pIHtcbiAgICAgICAgZGVwZW5kZW50c1tfcHJvcF0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmIChkZXBlbmRlbnRzW19wcm9wXS5pbmRleE9mKHByb3ApID09PSAtMSkge1xuICAgICAgICBkZXBlbmRlbnRzW19wcm9wXS5wdXNoKHByb3ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFjY2Vzc29yKF9wcm9wLCBfYXJnLCBfcmVmcmVzaCk7XG4gICAgfVxuXG4gICAgLy8gR2V0dGVyP1xuICAgIGlmICgoYXJnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykgJiYgIXJlZnJlc2gpIHtcblxuICAgICAgdmFsID0gb2JqW3Byb3BdO1xuXG4gICAgICByZXN1bHQgPSAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eVxuICAgICAgICB2YWwuY2FsbChkZXBlbmRlbmN5VHJhY2tlciwgYXJnKSA6XG4gICAgICAgIC8vIFN0YXRpYyBwcm9wZXJ0eSAobGVhZiBpbiB0aGUgZGVwZW5kZW5jeSB0cmVlKVxuICAgICAgICB2YWw7XG5cbiAgICAgIHJldHVybiB0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0JyA/IFxuXG4gICAgICAgIHR5cGVvZiBjaGlsZHJlbltwcm9wXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgY2hpbGRyZW5bcHJvcF0gOlxuICAgICAgICAgIGNoaWxkcmVuW3Byb3BdID0gZnJlYWsodmFsLCByb290IHx8IGluc3RhbmNlLCBpbnN0YW5jZSwgcHJvcCkgOlxuXG4gICAgICAgIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBTZXR0ZXJcbiAgICBlbHNlIHtcblxuICAgICAgaWYgKCFyZWZyZXNoKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHkgc2V0dGVyXG4gICAgICAgICAgb2JqW3Byb3BdLmNhbGwoZGVwZW5kZW5jeVRyYWNrZXIsIGFyZyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gU2ltcGxlIHByb3BlcnR5LiBgYXJnYCBpcyB0aGUgbmV3IHZhbHVlXG4gICAgICAgICAgb2JqW3Byb3BdID0gYXJnO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGlmeSBkZXBlbmRlbnRzXG4gICAgICBmb3IgKGkgPSAwLCBkZXAgPSBkZXBlbmRlbnRzW3Byb3BdIHx8IFtdLCBsZW4gPSBkZXAubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBhY2Nlc3NvcihkZXBbaV0sIGFyZywgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEVtaXQgdXBkYXRlIGV2ZW50XG4gICAgICB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcblxuICAgIH0gLy8gaWYgZ2V0dGVyICAgICAgICBcblxuICB9IC8vIGVuZCBhY2Nlc3NvclxuXG4gIHZhciBhcnJheVByb3BlcnRpZXMgPSB7XG4gICAgLy8gRnVuY3Rpb24gcHJvdG90eXBlIGFscmVhZHkgY29udGFpbnMgbGVuZ3RoXG4gICAgbGVuOiBvYmoubGVuZ3RoLFxuXG4gICAgcG9wOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS5wb3AuYXBwbHkob2JqKTtcbiAgICAgIHRoaXMubGVuID0gdGhpcy52YWx1ZXMubGVuZ3RoO1xuICAgICAgdHJpZ2dlcignZGVsZXRlJywgdGhpcy5sZW4sIDEpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgcHVzaDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10ucHVzaC5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgIHRyaWdnZXIoJ2luc2VydCcsIHRoaXMubGVuIC0gMSwgMSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICByZXZlcnNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS5yZXZlcnNlLmFwcGx5KG9iaik7XG4gICAgICB0aGlzLmxlbiA9IG9iai5sZW5ndGg7XG4gICAgICBjaGlsZHJlbiA9IHt9O1xuICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc2hpZnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnNoaWZ0LmFwcGx5KG9iaik7XG4gICAgICB0aGlzLmxlbiA9IG9iai5sZW5ndGg7XG4gICAgICBjaGlsZHJlbiA9IHt9O1xuICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgMSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICB1bnNoaWZ0OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS51bnNoaWZ0LmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIHRoaXMubGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHNvcnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnNvcnQuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10uc3BsaWNlLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIHRoaXMubGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgIH1cbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50cy5sZW5ndGggLSAyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gIH07XG5cbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgdmFyIGluc3RhbmNlUHJvcGVydGllcyA9IHtcbiAgICB2YWx1ZXM6IG9iaixcbiAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgIHJvb3Q6IHJvb3QgfHwgaW5zdGFuY2UsXG4gICAgcHJvcDogcHJvcCB8fCBudWxsLFxuICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICBvbjogb24sXG4gICAgLy8gLm9mZihldmVudFssIHByb3BdWywgY2FsbGJhY2tdKVxuICAgIG9mZjogb2ZmXG4gIH07XG5cbiAgbWl4aW4oaW5zdGFuY2UsIGluc3RhbmNlUHJvcGVydGllcyk7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIG1peGluKGluc3RhbmNlLCBhcnJheVByb3BlcnRpZXMpO1xuICB9XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDb21tb25KUyBleHBvcnRcbmlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JykgbW9kdWxlLmV4cG9ydHMgPSBmcmVhazsiLCIvKlxuXG4jIyBDb21waWxlclxuXG4qL1xuXG5cbi8qXG5cbiMjIyBjb21waWxlKHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKVxuXG5SZXR1cm4gZG9jdW1lbnRGcmFnbWVudFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb21waWxlKHRlbXBsYXRlLCBtb2RlbCwgb3B0aW9ucykge1xuXG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgICAgLy8gVXRpbGl0eSBmdW5jdGlvbnNcblxuICAgICAgZnVuY3Rpb24gZXNjYXBlUkUocykge1xuICAgICAgICByZXR1cm4gIChzICsgJycpLnJlcGxhY2UoLyhbLj8qK14kW1xcXVxcXFwoKXt9fC1dKS9nLCAnXFxcXCQxJyk7XG4gICAgICB9XG5cblxuICAgICAgZnVuY3Rpb24gdG9rZW5pemVyKG9wdGlvbnMsIGZsYWdzKSB7XG4gICAgICAgIHJldHVybiBSZWdFeHAoXG4gICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzBdKSArIFxuICAgICAgICAgICcoJyArIGNvbnN0cy5SRV9BTllUSElORyArICcpJyArXG4gICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKSxcbiAgICAgICAgICBmbGFnc1xuICAgICAgICApO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIG1hdGNoUnVsZXModGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgICB2YXIgaSwgbWF0Y2g7XG4gICAgICAgIHZhciBydWxlcyA9IHJlcXVpcmUoJy4vcnVsZXMnKTtcbiAgICAgICAgdmFyIHJ1bGVzTGVuID0gcnVsZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vIFN0cmlwIGRlbGltaXRlcnNcbiAgICAgICAgdGFnID0gdGFnLnNsaWNlKG9wdGlvbnMuZGVsaW1pdGVyc1swXS5sZW5ndGgsIC1vcHRpb25zLmRlbGltaXRlcnNbMV0ubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcnVsZXNMZW47IGkrKykge1xuICAgICAgICAgIG1hdGNoID0gcnVsZXNbaV0odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBtYXRjaC5pbmRleCA9IGk7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cblxuICAgICAgZnVuY3Rpb24gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSwgb3B0aW9ucykge1xuICAgICAgICAvLyByZXBsYWNlIHt7e3RhZ319fSB3aXRoIHt7JnRhZ319XG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgICBSZWdFeHAoXG4gICAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMF0gKyAneycpICtcbiAgICAgICAgICAgIGNvbnN0cy5SRV9TUkNfSURFTlRJRklFUiArXG4gICAgICAgICAgICBlc2NhcGVSRSgnfScgKyBvcHRpb25zLmRlbGltaXRlcnNbMV0pLFxuICAgICAgICAgICAgJ2cnXG4gICAgICAgICAgKSxcbiAgICAgICAgICBvcHRpb25zLmRlbGltaXRlcnNbMF0gKyAnJiQxJyArIG9wdGlvbnMuZGVsaW1pdGVyc1sxXVxuICAgICAgICApO1xuICAgICAgICAvLyB3cmFwIGVhY2ggbm9uLWF0dHJpYnV0ZSB0YWcgaW4gSFRNTCBjb21tZW50LFxuICAgICAgICAvLyByZW1vdmUgTXVzdGFjaGUgY29tbWVudHMsXG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgICAgICB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKSxcbiAgICAgICAgICBmdW5jdGlvbihtYXRjaCwgbWF0Y2gxLCBwb3MpIHtcbiAgICAgICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgICAgIHZhciBpbnNpZGVUYWcgPSAhIWhlYWQubWF0Y2goUmVnRXhwKCc8JyArIGNvbnN0cy5SRV9TUkNfSURFTlRJRklFUiArICdbXj5dKj8kJykpO1xuICAgICAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICAgICAgcmV0dXJuIGluc2lkZVRhZyB8fCBpbnNpZGVDb21tZW50ID9cbiAgICAgICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgPyBcbiAgICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgICAnPCEtLScgKyBtYXRjaCArICctLT4nO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIG1hdGNoRW5kQmxvY2soYmxvY2ssIHRlbXBsYXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBtYXRjaCA9IHRlbXBsYXRlLm1hdGNoKFxuICAgICAgICAgIFJlZ0V4cChcbiAgICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgKyBcbiAgICAgICAgICAgICdcXFxcLycgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnPycgK1xuICAgICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzFdKVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIG1hdGNoID9cbiAgICAgICAgICBibG9jayA9PT0gJycgfHwgbWF0Y2hbMV0gPT09IHVuZGVmaW5lZCB8fCBtYXRjaFsxXSA9PT0gYmxvY2sgOlxuICAgICAgICAgIGZhbHNlO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIFZhcmlhYmxlc1xuXG4gICAgICB2YXIgaSwgY2hpbGRyZW4sIGxlbiwgYWksIGFsZW4sIGF0dHIsIHZhbCwgcnVsZVZhbCwgYnVmZmVyLCBwb3MsIGJlZ2luUG9zLCBib2R5QmVnaW5Qb3MsIGJvZHksIG5vZGUsIGVsLCB0LCBtYXRjaCwgcnVsZSwgdG9rZW4sIGJsb2NrO1xuICAgICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgdmFyIGZyZWFrID0gcmVxdWlyZSgnZnJlYWsnKTtcblxuICAgICAgLy8gSW5pdFxuICAgICAgXG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCByZXF1aXJlKCcuL2RlZmF1bHQtb3B0aW9ucycpO1xuXG4gICAgICBtb2RlbCA9IFxuICAgICAgICB0eXBlb2YgbW9kZWwgPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIC8vIEZyZWFrIGluc3RhbmNlXG4gICAgICAgICAgbW9kZWwgOlxuICAgICAgICAgIHR5cGVvZiBtb2RlbCA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgICAgICAgIGZyZWFrKG1vZGVsKSA6XG4gICAgICAgICAgICAvLyBTaW1wbGUgdmFsdWVcbiAgICAgICAgICAgIGZyZWFrKHsnLic6IG1vZGVsfSk7XG5cbiAgICAgIC8vIFRlbXBsYXRlIGNhbiBiZSBhIHN0cmluZyBvciBET00gc3RydWN0dXJlXG4gICAgICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgIGJvZHkgPSB0ZW1wbGF0ZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUsIG9wdGlvbnMpO1xuXG4gICAgICAgIGJvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgIGJvZHkuaW5uZXJIVE1MID0gdGVtcGxhdGU7XG4gICAgICB9XG5cbiAgICAgIC8vIEl0ZXJhdGUgY2hpbGQgbm9kZXMuXG4gICAgICBmb3IgKGkgPSAwLCBjaGlsZHJlbiA9IGJvZHkuY2hpbGROb2RlcywgbGVuID0gY2hpbGRyZW4ubGVuZ3RoIDsgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICAgICAgbm9kZSA9IGNoaWxkcmVuW2ldO1xuXG4gICAgICAgIC8vIFNoYWxsb3cgY29weSBvZiBub2RlIGFuZCBhdHRyaWJ1dGVzIChpZiBlbGVtZW50KVxuICAgICAgICBlbCA9IG5vZGUuY2xvbmVOb2RlKGZhbHNlKTtcbiAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWwpO1xuXG4gICAgICAgIHN3aXRjaCAoZWwubm9kZVR5cGUpIHtcblxuICAgICAgICAgIC8vIEVsZW1lbnQgbm9kZVxuICAgICAgICAgIGNhc2UgMTpcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlc1xuICAgICAgICAgICAgZm9yIChhaSA9IDAsIGFsZW4gPSBlbC5hdHRyaWJ1dGVzLmxlbmd0aDsgYWkgPCBhbGVuOyBhaSsrKSB7XG5cbiAgICAgICAgICAgICAgYXR0ciA9IGVsLmF0dHJpYnV0ZXNbYWldO1xuICAgICAgICAgICAgICB2YWwgPSBhdHRyLnZhbHVlO1xuICAgICAgICAgICAgICB0ID0gdG9rZW5pemVyKG9wdGlvbnMsICdnJyk7XG5cbiAgICAgICAgICAgICAgd2hpbGUgKCAobWF0Y2ggPSB0LmV4ZWModmFsKSkgKSB7XG5cbiAgICAgICAgICAgICAgICBydWxlID0gbWF0Y2hSdWxlcyhtYXRjaFswXSwgZWwsIGF0dHIubmFtZSwgbW9kZWwsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUpIHtcblxuICAgICAgICAgICAgICAgICAgaWYgKHJ1bGUuYmxvY2spIHtcblxuICAgICAgICAgICAgICAgICAgICBibG9jayA9IG1hdGNoWzBdO1xuICAgICAgICAgICAgICAgICAgICBiZWdpblBvcyA9IG1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICAgICAgICBib2R5QmVnaW5Qb3MgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGNsb3NpbmcgdGFnXG4gICAgICAgICAgICAgICAgICAgIGZvciAoO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICFtYXRjaEVuZEJsb2NrKHJ1bGUuYmxvY2ssIG1hdGNoWzBdLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoID0gdC5leGVjKHZhbCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0aHJvdyAnVW5jbG9zZWQnICsgYmxvY2s7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gUmVwbGFjZSBmdWxsIGJsb2NrIHRhZyBib2R5IHdpdGggcnVsZSBjb250ZW50c1xuICAgICAgICAgICAgICAgICAgICAgIGF0dHIudmFsdWUgPSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHIudmFsdWUuc2xpY2UoMCwgYmVnaW5Qb3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGUucmVwbGFjZShhdHRyLnZhbHVlLnNsaWNlKGJvZHlCZWdpblBvcywgbWF0Y2guaW5kZXgpKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyLnZhbHVlLnNsaWNlKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAocnVsZS5jaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHJ1bGUuYmxvY2sgfHwgcnVsZS5wcm9wLCBydWxlLmNoYW5nZSk7XG4gICAgICAgICAgICAgICAgICAgIHJ1bGUuY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9IFxuXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICBlbC5hcHBlbmRDaGlsZChjb21waWxlKG5vZGUsIG1vZGVsLCBvcHRpb25zKSk7XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgaWYgKG1hdGNoRW5kQmxvY2soJycsIGVsLmRhdGEsIG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgIHRocm93ICdqdG1wbDogVW5leHBlY3RlZCAnICsgZWwuZGF0YTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCAobWF0Y2ggPSBlbC5kYXRhLm1hdGNoKHRva2VuaXplcihvcHRpb25zKSkpICkge1xuXG4gICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKGVsLmRhdGEsIG5vZGUsIG51bGwsIG1vZGVsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgaWYgKHJ1bGUpIHtcblxuICAgICAgICAgICAgICAgIC8vIERPTSByZXBsYWNlbWVudD9cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5yZXBsYWNlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlLCBlbCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGFnIGNvbnRlbnRzP1xuICAgICAgICAgICAgICAgIGlmIChydWxlLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkrKztcblxuICAgICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAhbWF0Y2hFbmRCbG9jayhydWxlLmJsb2NrLCBjaGlsZHJlbltpXS5kYXRhIHx8ICcnLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgICAgICAgICAgIGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrLmFwcGVuZENoaWxkKGNoaWxkcmVuW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChpID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgZWwuZGF0YTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZXBsYWNlIGBlbGAgd2l0aCBgcnVsZS5yZXBsYWNlKClgIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICBlbC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChydWxlLnJlcGxhY2UoYmxvY2ssIGVsLnBhcmVudE5vZGUpLCBlbCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucHJvcCAmJiBydWxlLmNoYW5nZSkge1xuICAgICAgICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHJ1bGUucHJvcCwgcnVsZS5jaGFuZ2UpO1xuICAgICAgICAgICAgICAgICAgcnVsZS5jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIH0gLy8gc3dpdGNoXG5cbiAgICAgIH0gLy8gZm9yXG5cbiAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICB9OyIsIi8qXG5cbiMjIENvbnN0YW50c1xuXG4qLyAgICBcbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJlLXF1b3RlZFwiXG4gICAgUkVfUEFSVElBTDogLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8sXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0VORFNfV0lUSF9OT0RFX0lEOiAvLisoI1tcXHdcXC5cXC1dKykkLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qXG4gIFxuRGVmYXVsdCBvcHRpb25zXG5cbiovXG4gICAgXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICBkZWxpbWl0ZXJzOiBbJ3t7JywgJ319J11cbiAgICB9O1xuIiwiLypcblxuRXZhbHVhdGUgb2JqZWN0IGZyb20gbGl0ZXJhbCBvciBDb21tb25KUyBtb2R1bGVcblxuKi9cblxuICBcdC8qIGpzaGludCBldmlsOnRydWUgKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgc3JjLCBtb2RlbCkge1xuXG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgICAgbW9kZWwgPSBtb2RlbCB8fCB7fTtcbiAgICAgIGlmICh0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbW9kZWwgPSBqdG1wbC5mcmVhayhtb2RlbCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAvLyBUYXJnZXQgZG9lc24ndCBhbHJlYWR5IGhhdmUgcHJvcD9cbiAgICAgICAgICBpZiAodGFyZ2V0KHByb3ApID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRhcmdldChwcm9wLCBwcm9wZXJ0aWVzW3Byb3BdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZXZhbE9iamVjdChib2R5KSB7XG4gICAgICAgIHZhciByZXN1bHQsIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcbiAgICAgICAgcmV0dXJuIChib2R5Lm1hdGNoKC9eXFxzKntbXFxTXFxzXSp9XFxzKiQvKSkgP1xuICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICBldmFsKCdyZXN1bHQ9JyArIGJvZHkpIDpcbiAgICAgICAgICAvLyBDb21tb25KUyBtb2R1bGVcbiAgICAgICAgICBuZXcgRnVuY3Rpb24oJ21vZHVsZScsICdleHBvcnRzJywgYm9keSArICc7cmV0dXJuIG1vZHVsZS5leHBvcnRzOycpXG4gICAgICAgICAgICAobW9kdWxlLCBtb2R1bGUuZXhwb3J0cyk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIEVsZW1lbnQgaW4gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jLnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChlbGVtZW50LmlubmVySFRNTCkpO1xuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBHZXQgbW9kZWwgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBzcmMsIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgbmV3IERPTVBhcnNlcigpXG4gICAgICAgICAgICAgIC5wYXJzZUZyb21TdHJpbmcocmVzcCwgJ3RleHQvaHRtbCcpXG4gICAgICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcbiAgICAgICAgICAgIG1peGluKG1vZGVsLCBtYXRjaCA/IGV2YWxPYmplY3QoZWxlbWVudC5pbm5lckhUTUwpIDoge30pO1xuICAgICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRUZW1wbGF0ZSgpIHtcbiAgICAgICAgaWYgKHNyYy5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSBpcyB0aGUgY29udGVudHMgb2YgZWxlbWVudFxuICAgICAgICAgIC8vIGJlbG9uZ2luZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbG9hZE1vZGVsKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJyksIGVsZW1lbnQuaW5uZXJIVE1MLCBkb2N1bWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gR2V0IHRlbXBsYXRlIHZpYSBYSFJcbiAgICAgICAgICBqdG1wbCgnR0VUJywgc3JjLCBmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgIHZhciBkb2MgPSBtYXRjaCA/IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcocmVzcCwgJ3RleHQvaHRtbCcpIDogZG9jdW1lbnQ7XG4gICAgICAgICAgICB2YXIgZWxlbWVudCA9IG1hdGNoICYmIGRvYy5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcblxuICAgICAgICAgICAgbG9hZE1vZGVsKFxuICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJykgOiAnJyxcbiAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsXG4gICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2FkVGVtcGxhdGUoKTtcbiAgICB9O1xuIiwiLypcbiBcbiMjIE1haW4gZnVuY3Rpb25cblxuKi9cbiAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgIGZ1bmN0aW9uIGp0bXBsKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgdGFyZ2V0LCB0LCB0ZW1wbGF0ZSwgbW9kZWw7XG4gIFxuICAgICAgLy8ganRtcGwoJ0hUVFBfTUVUSE9EJywgdXJsWywgcGFyYW1ldGVyc1ssIGNhbGxiYWNrWywgb3B0aW9uc11dXSk/XG4gICAgICBpZiAoWydHRVQnLCAnUE9TVCddLmluZGV4T2YoYXJnc1swXSkgPiAtMSkge1xuICAgICAgICByZXR1cm4gcmVxdWlyZSgnLi94aHInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0KT9cbiAgICAgIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyByZXR1cm4gbW9kZWxcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSkuX19qdG1wbF9fO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gICAgICBlbHNlIGlmIChcbiAgICAgICAgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnICYmIFxuICAgICAgICBbJ29iamVjdCcsICdmdW5jdGlvbiddLmluZGV4T2YodHlwZW9mIGFyZ3NbMV0pID4gLTEgJiZcbiAgICAgICAgWydvYmplY3QnLCAndW5kZWZpbmVkJ10uaW5kZXhPZih0eXBlb2YgYXJnc1syXSkgPiAtMVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKCcuL2NvbXBpbGVyJykuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsWywgb3B0aW9uc10pP1xuICAgICAgZWxzZSBpZiAoXG4gICAgICAgICggYXJnc1swXSBpbnN0YW5jZW9mIE5vZGUgfHwgXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgICggYXJnc1sxXSBpbnN0YW5jZW9mIE5vZGUgfHwgXG4gICAgICAgICAgYXJnc1sxXSBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQgfHxcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgYXJnc1syXSAhPT0gdW5kZWZpbmVkXG5cbiAgICAgICkge1xuXG4gICAgICAgIHRhcmdldCA9IGFyZ3NbMF0gaW5zdGFuY2VvZiBOb2RlID9cbiAgICAgICAgICBhcmdzWzBdIDpcbiAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMF0pO1xuXG4gICAgICAgIHRlbXBsYXRlID0gYXJnc1sxXS5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1sxXSkuaW5uZXJIVE1MIDpcbiAgICAgICAgICBhcmdzWzFdO1xuXG4gICAgICAgIG1vZGVsID0gXG4gICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICAgICAgICBhcmdzWzJdIDpcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSB3cmFwXG4gICAgICAgICAgICBqdG1wbC5mcmVhayhcbiAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgICAgICAvLyBvYmplY3RcbiAgICAgICAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJyAmJiBhcmdzWzJdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgICAgICAgICAvLyBzcmMsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgIHJlcXVpcmUoJy4vbG9hZGVyJylcbiAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1syXSkuaW5uZXJIVE1MKSA6XG5cbiAgICAgICAgICAgICAgICAgIC8vIHNpbXBsZSB2YWx1ZSwgYm94IGl0XG4gICAgICAgICAgICAgICAgICB7Jy4nOiBhcmdzWzJdfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBpZiAodGFyZ2V0Lm5vZGVOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgICAgIHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICB0LmlkID0gdGFyZ2V0LmlkO1xuICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0LCB0YXJnZXQpO1xuICAgICAgICAgIHRhcmdldCA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NvY2lhdGUgdGFyZ2V0IGFuZCBtb2RlbFxuICAgICAgICB0YXJnZXQuX19qdG1wbF9fID0gbW9kZWw7XG5cbiAgICAgICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICAvLyBBc3NpZ24gY29tcGlsZWQgdGVtcGxhdGVcbiAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICAgIH1cbiAgICB9XG5cblxuXG4vKlxuXG5PbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcblxuKi9cblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBmdW5jdGlvbigpIHtcblxuICAgICAgdmFyIGxvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG4gICAgICB2YXIgdGFyZ2V0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWp0bXBsXScpO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGFyZ2V0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBsb2FkZXIodGFyZ2V0c1tpXSwgdGFyZ2V0c1tpXS5nZXRBdHRyaWJ1dGUoJ2RhdGEtanRtcGwnKSk7XG4gICAgICB9XG4gICAgfSk7XG5cblxuLypcblxuRXhwb3NlIGZyZWFrXG5cbiovXG5cbiAgICBqdG1wbC5mcmVhayA9IHJlcXVpcmUoJ2ZyZWFrJyk7XG5cblxuXG5cbi8qXG5cbkV4cG9ydFxuXG4qL1xuICAgIG1vZHVsZS5leHBvcnRzID0ganRtcGw7IiwiLypcblxuIyMgUnVsZXNcblxuRWFjaCBydWxlIGlzIGEgZnVuY3Rpb24sIGFyZ3Mgd2hlbiBjYWxsZWQgYXJlOlxuKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpXG5cbnRhZzogdGV4dCBiZXR3ZWVuIGRlbGltaXRlcnMsIHt7dGFnfX1cbm5vZGU6IERPTSBub2RlLCB3aGVyZSB0YWcgaXMgZm91bmRcbmF0dHI6IG5vZGUgYXR0cmlidXRlIG9yIG51bGwsIGlmIG5vZGUgY29udGVudHNcbm1vZGVsOiBGcmVhayBtb2RlbFxub3B0aW9uczogY29uZmlndXJhdGlvbiBvcHRpb25zXG5cbkl0IG11c3QgcmV0dXJuIGVpdGhlcjpcblxuKiBmYWxzeSB2YWx1ZSAtIG5vIG1hdGNoXG5cbiogb2JqZWN0IC0gbWF0Y2ggZm91bmQsIHJldHVybiAoYWxsIGZpZWxkcyBvcHRpb25hbClcblxuICAgICB7XG4gICAgICAgLy8gUGFyc2UgdW50aWwge3svfX0gb3Ige3svc29tZVByb3B9fSAuLi5cbiAgICAgICBibG9jazogJ3NvbWVQcm9wJyxcblxuICAgICAgIC8vIC4uLiB0aGVuIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQuXG4gICAgICAgLy8gSXQgbXVzdCByZXR1cm4gc3RyaW5nIG9yIERPTUVsZW1lbnRcbiAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHsgLi4uIH1cbiAgICAgfVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3ZhbHVlLXZhcicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9jbGFzcy1zZWN0aW9uJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3NlY3Rpb24nKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvaW52ZXJ0ZWQtc2VjdGlvbicpLFxuICAgICAgcmVxdWlyZSgnLi9ydWxlcy9wYXJ0aWFsJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3VuZXNjYXBlZC12YXInKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvdmFyJylcbiAgICBdO1xuIiwiLypcblxuIyMjIGNsYXNzPVwie3sjaWZDb25kaXRpb259fXNvbWUtY2xhc3N7ey99fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIGBtb2RlbC5pZkNvbmRpdGlvbmBcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJyMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIga2xhc3M7XG5cbiAgICAgIFxuICAgICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgbWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgICAgIFshIXZhbCAmJiAnYWRkJyB8fCAncmVtb3ZlJ10oa2xhc3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMge3teaW52ZXJ0ZWQtc2VjdGlvbn19XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ15cXFxcXicgKyByZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9TUkNfSURFTlRJRklFUikpO1xuICAgICAgdmFyIHByb3AgPSBtYXRjaCAmJiBtYXRjaFsxXTtcbiAgICAgIHZhciB0ZW1wbGF0ZTtcbiAgICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGNoYW5nZSk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjb21waWxlKHRlbXBsYXRlLCB2YWwoaSkpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG4gICAgICAgICAgICByZXR1cm4gYW5jaG9yO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBjaGFuZ2U6IGNoYW5nZVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfSIsIi8qXG5cbiMjIyBQYXJ0aWFsIFxuXG4qIHt7PlwiI2lkXCJ9fVxuKiB7ez5cInVybFwifX1cbioge3s+XCJ1cmwjaWRcIn19XG4qIHt7PnBhcnRpYWxTcmN9fVxuXG5SZXBsYWNlcyBwYXJlbnQgdGFnIGNvbnRlbnRzLCBhbHdheXMgd3JhcCBpbiBhIHRhZ1xuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2goY29uc3RzLlJFX1BBUlRJQUwpO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuXG4gICAgICB2YXIgbG9hZGVyID0gbWF0Y2ggJiYgXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlcXVpcmUoJy4uL2xvYWRlcicpKFxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUsXG4gICAgICAgICAgICBtYXRjaFsxXSA/XG4gICAgICAgICAgICAgIC8vIFZhcmlhYmxlXG4gICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICAgICAgbWF0Y2hbMl0gfHwgbWF0Y2hbM10sXG4gICAgICAgICAgICBtb2RlbFxuICAgICAgICAgIClcbiAgICAgICAgfTtcblxuICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgbWF0Y2hbMV0sIGxvYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBMb2FkIGFzeW5jXG4gICAgICAgIHNldFRpbWVvdXQobG9hZGVyLCAwKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlcGxhY2U6IGFuY2hvclxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyB7eyNzZWN0aW9ufX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJyk7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gobmV3IFJlZ0V4cCgnXiMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgdGVtcGxhdGU7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgcGFyZW50LnJlcGxhY2VDaGlsZChcbiAgICAgICAgICAgIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGkpKSxcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaW5kZXggKyBpKSkpO1xuICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbikge1xuICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gdmFsLmxlbjsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YWwub24oJ2NoYW5nZScsIGksIHVwZGF0ZShpKSk7XG4gICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKGkpKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPYmplY3Q/XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKTtcbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgYmxvY2s6IHByb3AsXG5cbiAgICAgICAgICByZXBsYWNlOiBmdW5jdGlvbih0bXBsLCBwYXJlbnQpIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRtcGw7XG5cbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG5cbiAgICAgIH1cbiAgICB9IiwiLypcblxuIyMjIHt7JnZhcn19IFxuXG4oYHt7e3Zhcn19fWAgaXMgcmVwbGFjZWQgb24gcHJlcHJvY2Vzc2luZyBzdGVwKVxuXG5DYW4gYmUgYm91bmQgdG8gbm9kZSBpbm5lckhUTUxcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJ14mJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzFdO1xuICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgdmFyIGxlbmd0aCA9IDA7XG4gICAgICBcbiAgICAgIGlmIChtYXRjaCAmJiAhYXR0cikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHByb3A6IHByb3AsXG4gICAgICAgICAgcmVwbGFjZTogYW5jaG9yLFxuICAgICAgICAgIGNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgICAgICB2YXIgaTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCB2YWx1ZVxuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgbGVuZ3RoID0gZWwuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWwuY2hpbGROb2Rlc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIGFuY2hvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cbiMjIyAodmFsdWUgfCBjaGVja2VkIHwgc2VsZWN0ZWQpPVwie3t2YWx9fVwiXG5cbkhhbmRsZSBcInZhbHVlXCIsIFwiY2hlY2tlZFwiIGFuZCBcInNlbGVjdGVkXCIgYXR0cmlidXRlc1xuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUik7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzBdO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgaWYgKG5vZGVbYXR0cl0gIT09IHZhbCkge1xuICAgICAgICAgIG5vZGVbYXR0cl0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKG1hdGNoICYmIFsndmFsdWUnLCAnY2hlY2tlZCcsICdzZWxlY3RlZCddLmluZGV4T2YoYXR0cikgPiAtMSkge1xuICAgICAgICAvLyA8c2VsZWN0PiBvcHRpb24/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuICAgICAgICAgIC8vIEF0dGFjaCBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgaWYgKG1vZGVsKHByb3ApICE9PSBub2RlLnNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZS5zZWxlY3RlZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmFkaW8gZ3JvdXA/XG4gICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChub2RlW2F0dHJdKSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBcbiAgICAgICAgICAgICAgICAgIGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W3R5cGU9cmFkaW9dW25hbWU9JyArIG5vZGUubmFtZSArICddJyksXG4gICAgICAgICAgICAgICAgICBsZW4gPSBpbnB1dHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgaSA8IGxlbjtcbiAgICAgICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dHNbaV0gIT09IG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGlucHV0c1tpXS5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZVthdHRyXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZXh0IGlucHV0P1xuICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICdpbnB1dCcgOiAnY2hhbmdlJztcblxuICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwcm9wOiBwcm9wLFxuICAgICAgICAgIHJlcGxhY2U6ICcnLFxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7dmFyfX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZSBkYXRhIG9yIGF0dHJpYnV0ZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgcmVhY3QsIHRhcmdldCwgY2hhbmdlO1xuICAgICAgXG4gICAgICBpZiAodGFnLm1hdGNoKHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX0lERU5USUZJRVIpKSB7XG5cbiAgICAgICAgaWYgKGF0dHIpIHtcbiAgICAgICAgICAvLyBBdHRyaWJ1dGVcbiAgICAgICAgICBjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBtb2RlbCh0YWcpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbCA/XG4gICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbCkgOlxuICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgICAgICAgICBjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRhcmdldC5kYXRhID0gbW9kZWwodGFnKSB8fCAnJztcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWF0Y2ggZm91bmRcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwcm9wOiB0YWcsXG4gICAgICAgICAgcmVwbGFjZTogdGFyZ2V0LFxuICAgICAgICAgIGNoYW5nZTogY2hhbmdlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuUmVxdWVzdHMgQVBJXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGxlbiwgcHJvcCwgcHJvcHMsIHJlcXVlc3Q7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAvLyBMYXN0IGZ1bmN0aW9uIGFyZ3VtZW50XG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnJlZHVjZShcbiAgICAgICAgZnVuY3Rpb24gKHByZXYsIGN1cnIpIHtcbiAgICAgICAgICByZXR1cm4gdHlwZW9mIGN1cnIgPT09ICdmdW5jdGlvbicgPyBjdXJyIDogcHJldjtcbiAgICAgICAgfSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcblxuICAgICAgdmFyIG9wdHMgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0cyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9wdHMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHByb3AgPSBwcm9wc1tpXTtcbiAgICAgICAgeGhyW3Byb3BdID0gb3B0c1twcm9wXTtcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdCA9XG4gICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycpID9cblxuICAgICAgICAgIC8vIFN0cmluZyBwYXJhbWV0ZXJzXG4gICAgICAgICAgYXJnc1syXSA6XG5cbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnKSA/XG5cbiAgICAgICAgICAgIC8vIE9iamVjdCBwYXJhbWV0ZXJzLiBTZXJpYWxpemUgdG8gVVJJXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhhcmdzWzJdKS5tYXAoXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geCArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChhcmdzWzJdW3hdKTtcbiAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSwgXG4gICAgICAgIG9wdHMudXNlciwgb3B0cy5wYXNzd29yZCk7XG5cbiAgICAgIHhoci5zZW5kKHJlcXVlc3QpO1xuXG4gICAgfTtcbiJdfQ==
(7)
});
