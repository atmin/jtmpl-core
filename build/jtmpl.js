!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jtmpl=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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


      function wrapTagsInHTMLComments(template, options) {
        return template.replace(
          tokenizer(options, 'g'),
          function(match, match1, pos) {
            var head = template.slice(0, pos);
            var insideTag = !!head.match(RegExp('<' + consts.RE_SRC_IDENTIFIER + '[^>]*?$'));
            var insideComment = !!head.match(/<!--\s*$/);
            return insideTag || insideComment ?
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
        template = wrapTagsInHTMLComments(template, options);

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

              }

            }
            break;

        } // switch

      } // for

      return fragment;
    };
},{"./consts":2,"./default-options":3,"./rules":6,"freak":13}],2:[function(_dereq_,module,exports){
/*

## Constants

*/    
  module.exports = {

    RE_IDENTIFIER: /^[\w\.\-]+$/,

    RE_SRC_IDENTIFIER: '([\\w\\.\\-]+)',

    RE_PIPE: /^[\w\.\-]+(?:\|[\w\.\-]+)?$/,

    RE_NODE_ID: /^#[\w\.\-]+$/,

    RE_ANYTHING: '[\\s\\S]*?',

    RE_SPACE: '\\s*'

  };

},{}],3:[function(_dereq_,module,exports){
/*
  
Default options

*/
    
    module.exports = {
      delimiters: ['{{', '}}']
    };

},{}],4:[function(_dereq_,module,exports){
/*

Evaluate object from literal or CommonJS module

*/

	/* jshint evil:true */
    module.exports = function(body) {
      var result, module = { exports: {} };
      return (body.match(/^\s*{[\S\s]*}\s*$/)) ?
        // Literal
        eval('result=' + body) :
        // CommonJS module
        new Function('module', 'exports', body + ';return module.exports;')(module, module.exports);
    };

},{}],5:[function(_dereq_,module,exports){
/*
 
## Main function

*/

    function jtmpl() {
      var args = [].slice.call(arguments);
      var consts = _dereq_('./consts');
      var target, t, template, model;
  
      // jtmpl('HTTP_METHOD', url[, parameters[, callback[, options]]])?
      if (['GET', 'POST'].indexOf(args[0]) > -1) {
        return _dereq_('./xhr').apply(null, args);
      }

      // jtmpl(template, model[, options])?
      else if (
        typeof args[0] === 'string' && 
        ['object', 'function'].indexOf(typeof args[1]) > -1 &&
        ['object', 'undefined'].indexOf(typeof args[2]) > -1
      ) {
        return _dereq_('./compiler').apply(null, args);
      }

      // jtmpl(target, model[, options])?
      // else if (
      //   args[0] instanceof Node &&
      //   typeof args[1] === 'object'
      // ) {
      //   console.log('jtmpl(target, model[, options])');
      // }

      // jtmpl(target, template, model[, options])?
      else if (
        ( args[0] instanceof Node || 
          (typeof args[0] === 'string')
        ) &&

        ( args[1] instanceof Node || 
          args[1] instanceof DocumentFragment ||
          (typeof args[1] === 'string')
        ) &&

        ( typeof args[2] === 'object' ||
          typeof args[2] === 'string'
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
          typeof args[2] === 'object' ?
            args[2] :
            args[2].match(consts.RE_NODE_ID) ?
              _dereq_('./eval-object')(document.querySelector(args[2]).innerHTML) :
              undefined;

        if (target.nodeName === 'SCRIPT') {
          t = document.createElement('div');
          t.id = target.id;
          target.parentNode.replaceChild(t, target);
          target = t;
        }

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
      var targets = document.querySelectorAll('[data-template]');
      var t, m;

      for (var i = 0, len = targets.length; i < len; i++) {
        t = targets[i];
        // if (src.match(consts.RE_NODE_ID)) {
        //   return loadModel(document.querySelector(src).innerHTML);
        // }

        jtmpl(t, 
          document.querySelector(t.getAttribute('data-template')).innerHTML, 
          _dereq_('./eval-object')
            (document.querySelector(t.getAttribute('data-model')).innerHTML)
        );
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
},{"./compiler":1,"./consts":2,"./eval-object":4,"./xhr":11,"freak":13}],6:[function(_dereq_,module,exports){
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
      _dereq_('./rules/class-block'),
      _dereq_('./rules/class-var'),
      _dereq_('./rules/block'),
      _dereq_('./rules/var')
    ];













},{"./rules/block":7,"./rules/class-block":8,"./rules/class-var":9,"./rules/var":10}],7:[function(_dereq_,module,exports){
/*

### {{#block}}

Can be bound to text node

*/

    module.exports = function(tag, node, attr, model, options) {
      var compile = _dereq_('../compiler');
      var match = tag.match(new RegExp('#' + _dereq_('../consts').RE_SRC_IDENTIFIER));
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
        var val = model(prop);
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
        else if (typeof val === 'function' && !val.len) {
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

        model.on('change', prop, change);
        change();

        return {
          block: prop,

          replace: function(tmpl, parent) {
            fragment.appendChild(anchor);
            template = tmpl;
            return anchor;
          }
        };

      }
    }
},{"../compiler":1,"../consts":2}],8:[function(_dereq_,module,exports){
/*

### class="{{#ifCondition}}some-class{{/}}"

Toggles class `some-class` in sync with boolean `model.ifCondition`

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(new RegExp('#' + _dereq_('../consts').RE_SRC_IDENTIFIER));
      var prop = match && match[1];
      var klass;

      function change() {
        var val = model(prop);
        _dereq_('element-class')(node)
          [!!val && 'add' || 'remove'](klass);
      }
      
      if (attr === 'class' && match) {
        model.on('change', prop, change);
        change();

        return {
          block: prop,

          replace: function(tmpl) {
            klass = tmpl;
            return '';
          }
        };
      }
    }

},{"../consts":2,"element-class":12}],9:[function(_dereq_,module,exports){
/*

### class="{{some-class}}"

Toggles class `some-class` in sync with boolean `model['some-class']`

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(_dereq_('../consts').RE_IDENTIFIER);
      var ec = _dereq_('element-class')(node);

      function change() {
        ec[!!model(tag) && 'add' || 'remove'](klass);
      }
      
      if (attr === 'class' && match) {
        // Remove tag from class list
        ec.remove(options.delimiters[0] + tag + options.delimiters[1]);

        model.on('change', prop, change);
        change();

        return {};
      }
    }

},{"../consts":2,"element-class":12}],10:[function(_dereq_,module,exports){
/*

### {{var}}

Can be bound to text node data or attribute

*/

    module.exports = function(tag, node, attr, model, options) {
      var react, target;
      
      if (tag.match(_dereq_('../consts').RE_IDENTIFIER)) {

        // Attribute?
        if (attr) {
          model.on('change', tag,
            function() {
              var val = model(tag);
              return val ?
                node.setAttribute(attr, val) :
                node.removeAttribute(attr);
            }
          );
        }
        // Text node
        else {
          target = document.createTextNode('');

          model.on('change', tag,
            function() {
              target.data = model(tag) || '';
            }
          );
        }

        // Trigger change
        model(tag, model(tag));

        // Match found
        return {
          replace: target
        };
      }
    }

},{"../consts":2}],11:[function(_dereq_,module,exports){
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

},{}],12:[function(_dereq_,module,exports){
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

},{}],13:[function(_dereq_,module,exports){
'use strict';

function freak(obj, root, parent) {

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
    var prop = typeof arguments[1] === 'string' ? arguments[1] : null;
    var callback = 
      typeof arguments[1] === 'function' ?
        arguments[1] :
        typeof arguments[2] === 'function' ?
          arguments[2] : null;

    // Args check
    assert(['change', 'insert', 'delete'].indexOf(event) > -1);
    assert(
      (event === 'change' && prop) ||
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
          children[prop] = freak(val, root || instance, instance) :

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
      trigger('delete', 0, this.len);
      trigger('insert', 0, this.len);
      return result;
    },

    shift: function() {
      var result = [].shift.apply(obj);
      this.len = obj.length;
      trigger('delete', 0, 1);
      return result;
    },

    unshift: function() {
      var result = [].unshift.apply(obj, arguments);
      this.len = obj.length;
      trigger('insert', 0, 1);
      return result;
    },

    sort: function() {
      var result = [].sort.apply(obj, arguments);
      trigger('delete', 0, this.len);
      trigger('insert', 0, this.len);
      return result;
    },

    splice: function() {
      var result = [].splice.apply(obj, arguments);
      this.len = obj.length;
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
},{}]},{},[5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvanRtcGwvY29tcGlsZXIuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9jb25zdHMuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9kZWZhdWx0LW9wdGlvbnMuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9ldmFsLW9iamVjdC5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL2p0bXBsL21haW4uanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9ydWxlcy5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL2p0bXBsL3J1bGVzL2Jsb2NrLmpzIiwiL2hvbWUvYXRtaW4vZGV2L2p0bXBsLWNvcmUvanRtcGwvcnVsZXMvY2xhc3MtYmxvY2suanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9ydWxlcy9jbGFzcy12YXIuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC9ydWxlcy92YXIuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9qdG1wbC94aHIuanMiLCIvaG9tZS9hdG1pbi9kZXYvanRtcGwtY29yZS9ub2RlX21vZHVsZXMvZWxlbWVudC1jbGFzcy9pbmRleC5qcyIsIi9ob21lL2F0bWluL2Rldi9qdG1wbC1jb3JlL25vZGVfbW9kdWxlcy9mcmVhay9mcmVhay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLypcblxuIyMgQ29tcGlsZXJcblxuKi9cblxuXG4vKlxuXG4jIyMgY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSlcblxuUmV0dXJuIGRvY3VtZW50RnJhZ21lbnRcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwsIG9wdGlvbnMpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIC8vIFV0aWxpdHkgZnVuY3Rpb25zXG5cbiAgICAgIGZ1bmN0aW9uIGVzY2FwZVJFKHMpIHtcbiAgICAgICAgcmV0dXJuICAocyArICcnKS5yZXBsYWNlKC8oWy4/KiteJFtcXF1cXFxcKCl7fXwtXSkvZywgJ1xcXFwkMScpO1xuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIHRva2VuaXplcihvcHRpb25zLCBmbGFncykge1xuICAgICAgICByZXR1cm4gUmVnRXhwKFxuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1swXSkgKyBcbiAgICAgICAgICAnKCcgKyBjb25zdHMuUkVfQU5ZVEhJTkcgKyAnKScgK1xuICAgICAgICAgIGVzY2FwZVJFKG9wdGlvbnMuZGVsaW1pdGVyc1sxXSksXG4gICAgICAgICAgZmxhZ3NcbiAgICAgICAgKTtcbiAgICAgIH1cblxuXG4gICAgICBmdW5jdGlvbiBtYXRjaFJ1bGVzKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGksIG1hdGNoO1xuICAgICAgICB2YXIgcnVsZXMgPSByZXF1aXJlKCcuL3J1bGVzJyk7XG4gICAgICAgIHZhciBydWxlc0xlbiA9IHJ1bGVzLmxlbmd0aDtcblxuICAgICAgICAvLyBTdHJpcCBkZWxpbWl0ZXJzXG4gICAgICAgIHRhZyA9IHRhZy5zbGljZShvcHRpb25zLmRlbGltaXRlcnNbMF0ubGVuZ3RoLCAtb3B0aW9ucy5kZWxpbWl0ZXJzWzFdLmxlbmd0aCk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHJ1bGVzTGVuOyBpKyspIHtcbiAgICAgICAgICBtYXRjaCA9IHJ1bGVzW2ldKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgbWF0Y2guaW5kZXggPSBpO1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIGZ1bmN0aW9uIHdyYXBUYWdzSW5IVE1MQ29tbWVudHModGVtcGxhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAgICAgdG9rZW5pemVyKG9wdGlvbnMsICdnJyksXG4gICAgICAgICAgZnVuY3Rpb24obWF0Y2gsIG1hdGNoMSwgcG9zKSB7XG4gICAgICAgICAgICB2YXIgaGVhZCA9IHRlbXBsYXRlLnNsaWNlKDAsIHBvcyk7XG4gICAgICAgICAgICB2YXIgaW5zaWRlVGFnID0gISFoZWFkLm1hdGNoKFJlZ0V4cCgnPCcgKyBjb25zdHMuUkVfU1JDX0lERU5USUZJRVIgKyAnW14+XSo/JCcpKTtcbiAgICAgICAgICAgIHZhciBpbnNpZGVDb21tZW50ID0gISFoZWFkLm1hdGNoKC88IS0tXFxzKiQvKTtcbiAgICAgICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICAgICAgJzwhLS0nICsgbWF0Y2ggKyAnLS0+JztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cblxuICAgICAgZnVuY3Rpb24gbWF0Y2hFbmRCbG9jayhibG9jaywgdGVtcGxhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG1hdGNoID0gdGVtcGxhdGUubWF0Y2goXG4gICAgICAgICAgUmVnRXhwKFxuICAgICAgICAgICAgZXNjYXBlUkUob3B0aW9ucy5kZWxpbWl0ZXJzWzBdKSArIFxuICAgICAgICAgICAgJ1xcXFwvJyArIGNvbnN0cy5SRV9TUkNfSURFTlRJRklFUiArICc/JyArXG4gICAgICAgICAgICBlc2NhcGVSRShvcHRpb25zLmRlbGltaXRlcnNbMV0pXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gbWF0Y2ggP1xuICAgICAgICAgIGJsb2NrID09PSAnJyB8fCBtYXRjaFsxXSA9PT0gdW5kZWZpbmVkIHx8IG1hdGNoWzFdID09PSBibG9jayA6XG4gICAgICAgICAgZmFsc2U7XG4gICAgICB9XG5cblxuICAgICAgLy8gVmFyaWFibGVzXG5cbiAgICAgIHZhciBpLCBjaGlsZHJlbiwgbGVuLCBhaSwgYWxlbiwgYXR0ciwgdmFsLCBydWxlVmFsLCBidWZmZXIsIHBvcywgYmVnaW5Qb3MsIGJvZHlCZWdpblBvcywgYm9keSwgbm9kZSwgZWwsIHQsIG1hdGNoLCBydWxlLCB0b2tlbiwgYmxvY2s7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgZnJlYWsgPSByZXF1aXJlKCdmcmVhaycpO1xuXG4gICAgICAvLyBJbml0XG4gICAgICBcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHJlcXVpcmUoJy4vZGVmYXVsdC1vcHRpb25zJyk7XG5cbiAgICAgIG1vZGVsID0gXG4gICAgICAgIHR5cGVvZiBtb2RlbCA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgLy8gRnJlYWsgaW5zdGFuY2VcbiAgICAgICAgICBtb2RlbCA6XG4gICAgICAgICAgdHlwZW9mIG1vZGVsID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAvLyBXcmFwIG9iamVjdFxuICAgICAgICAgICAgZnJlYWsobW9kZWwpIDpcbiAgICAgICAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgICAgICAgZnJlYWsoeycuJzogbW9kZWx9KTtcblxuICAgICAgLy8gVGVtcGxhdGUgY2FuIGJlIGEgc3RyaW5nIG9yIERPTSBzdHJ1Y3R1cmVcbiAgICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgYm9keSA9IHRlbXBsYXRlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRlbXBsYXRlID0gd3JhcFRhZ3NJbkhUTUxDb21tZW50cyh0ZW1wbGF0ZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JvZHknKTtcbiAgICAgICAgYm9keS5pbm5lckhUTUwgPSB0ZW1wbGF0ZTtcbiAgICAgIH1cblxuICAgICAgLy8gSXRlcmF0ZSBjaGlsZCBub2Rlcy5cbiAgICAgIGZvciAoaSA9IDAsIGNoaWxkcmVuID0gYm9keS5jaGlsZE5vZGVzLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGggOyBpIDwgbGVuOyBpKyspIHtcblxuICAgICAgICBub2RlID0gY2hpbGRyZW5baV07XG5cbiAgICAgICAgLy8gU2hhbGxvdyBjb3B5IG9mIG5vZGUgYW5kIGF0dHJpYnV0ZXMgKGlmIGVsZW1lbnQpXG4gICAgICAgIGVsID0gbm9kZS5jbG9uZU5vZGUoZmFsc2UpO1xuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbCk7XG5cbiAgICAgICAgc3dpdGNoIChlbC5ub2RlVHlwZSkge1xuXG4gICAgICAgICAgLy8gRWxlbWVudCBub2RlXG4gICAgICAgICAgY2FzZSAxOlxuXG4gICAgICAgICAgICAvLyBDaGVjayBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBmb3IgKGFpID0gMCwgYWxlbiA9IGVsLmF0dHJpYnV0ZXMubGVuZ3RoOyBhaSA8IGFsZW47IGFpKyspIHtcblxuICAgICAgICAgICAgICBhdHRyID0gZWwuYXR0cmlidXRlc1thaV07XG4gICAgICAgICAgICAgIHZhbCA9IGF0dHIudmFsdWU7XG4gICAgICAgICAgICAgIHQgPSB0b2tlbml6ZXIob3B0aW9ucywgJ2cnKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoIChtYXRjaCA9IHQuZXhlYyh2YWwpKSApIHtcblxuICAgICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKG1hdGNoWzBdLCBlbCwgYXR0ci5uYW1lLCBtb2RlbCwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBpZiAocnVsZSkge1xuXG4gICAgICAgICAgICAgICAgICBpZiAocnVsZS5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrID0gbWF0Y2hbMF07XG4gICAgICAgICAgICAgICAgICAgIGJlZ2luUG9zID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGJvZHlCZWdpblBvcyA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgY2xvc2luZyB0YWdcbiAgICAgICAgICAgICAgICAgICAgZm9yICg7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgIW1hdGNoRW5kQmxvY2socnVsZS5ibG9jaywgbWF0Y2hbMF0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSB0LmV4ZWModmFsKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdVbmNsb3NlZCcgKyBibG9jaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBSZXBsYWNlIGZ1bGwgYmxvY2sgdGFnIGJvZHkgd2l0aCBydWxlIGNvbnRlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgYXR0ci52YWx1ZSA9IFxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0ci52YWx1ZS5zbGljZSgwLCBiZWdpblBvcykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgcnVsZS5yZXBsYWNlKGF0dHIudmFsdWUuc2xpY2UoYm9keUJlZ2luUG9zLCBtYXRjaC5pbmRleCkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHIudmFsdWUuc2xpY2UobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9IFxuXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICBlbC5hcHBlbmRDaGlsZChjb21waWxlKG5vZGUsIG1vZGVsLCBvcHRpb25zKSk7XG5cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgaWYgKG1hdGNoRW5kQmxvY2soJycsIGVsLmRhdGEsIG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgIHRocm93ICdqdG1wbDogVW5leHBlY3RlZCAnICsgZWwuZGF0YTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCAobWF0Y2ggPSBlbC5kYXRhLm1hdGNoKHRva2VuaXplcihvcHRpb25zKSkpICkge1xuXG4gICAgICAgICAgICAgIHJ1bGUgPSBtYXRjaFJ1bGVzKGVsLmRhdGEsIG1hdGNoWzFdLCBudWxsLCBtb2RlbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgIGlmIChydWxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBET00gcmVwbGFjZW1lbnQ/XG4gICAgICAgICAgICAgICAgaWYgKHJ1bGUucmVwbGFjZSBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHJ1bGUucmVwbGFjZSwgZWwpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEZldGNoIGJsb2NrIHRhZyBjb250ZW50cz9cbiAgICAgICAgICAgICAgICBpZiAocnVsZS5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgICBibG9jayA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICAgICAgZm9yIChpKys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAoaSA8IGxlbikgJiYgXG4gICAgICAgICAgICAgICAgICAgICAgIW1hdGNoRW5kQmxvY2socnVsZS5ibG9jaywgY2hpbGRyZW5baV0uZGF0YSB8fCAnJywgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICBpKyspIHtcblxuICAgICAgICAgICAgICAgICAgICBibG9jay5hcHBlbmRDaGlsZChjaGlsZHJlbltpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93ICdqdG1wbDogVW5jbG9zZWQgJyArIGVsLmRhdGE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gUmVwbGFjZSBgZWxgIHdpdGggYHJ1bGUucmVwbGFjZSgpYCByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQocnVsZS5yZXBsYWNlKGJsb2NrLCBlbC5wYXJlbnROb2RlKSwgZWwpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIH0gLy8gc3dpdGNoXG5cbiAgICAgIH0gLy8gZm9yXG5cbiAgICAgIHJldHVybiBmcmFnbWVudDtcbiAgICB9OyIsIi8qXG5cbiMjIENvbnN0YW50c1xuXG4qLyAgICBcbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qXG4gIFxuRGVmYXVsdCBvcHRpb25zXG5cbiovXG4gICAgXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICBkZWxpbWl0ZXJzOiBbJ3t7JywgJ319J11cbiAgICB9O1xuIiwiLypcblxuRXZhbHVhdGUgb2JqZWN0IGZyb20gbGl0ZXJhbCBvciBDb21tb25KUyBtb2R1bGVcblxuKi9cblxuXHQvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihib2R5KSB7XG4gICAgICB2YXIgcmVzdWx0LCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH07XG4gICAgICByZXR1cm4gKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSA/XG4gICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgZXZhbCgncmVzdWx0PScgKyBib2R5KSA6XG4gICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICBuZXcgRnVuY3Rpb24oJ21vZHVsZScsICdleHBvcnRzJywgYm9keSArICc7cmV0dXJuIG1vZHVsZS5leHBvcnRzOycpKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpO1xuICAgIH07XG4iLCIvKlxuIFxuIyMgTWFpbiBmdW5jdGlvblxuXG4qL1xuXG4gICAgZnVuY3Rpb24ganRtcGwoKSB7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuICAgICAgdmFyIHRhcmdldCwgdCwgdGVtcGxhdGUsIG1vZGVsO1xuICBcbiAgICAgIC8vIGp0bXBsKCdIVFRQX01FVEhPRCcsIHVybFssIHBhcmFtZXRlcnNbLCBjYWxsYmFja1ssIG9wdGlvbnNdXV0pP1xuICAgICAgaWYgKFsnR0VUJywgJ1BPU1QnXS5pbmRleE9mKGFyZ3NbMF0pID4gLTEpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJy4veGhyJykuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycgJiYgXG4gICAgICAgIFsnb2JqZWN0JywgJ2Z1bmN0aW9uJ10uaW5kZXhPZih0eXBlb2YgYXJnc1sxXSkgPiAtMSAmJlxuICAgICAgICBbJ29iamVjdCcsICd1bmRlZmluZWQnXS5pbmRleE9mKHR5cGVvZiBhcmdzWzJdKSA+IC0xXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJy4vY29tcGlsZXInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0LCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIC8vIGVsc2UgaWYgKFxuICAgICAgLy8gICBhcmdzWzBdIGluc3RhbmNlb2YgTm9kZSAmJlxuICAgICAgLy8gICB0eXBlb2YgYXJnc1sxXSA9PT0gJ29iamVjdCdcbiAgICAgIC8vICkge1xuICAgICAgLy8gICBjb25zb2xlLmxvZygnanRtcGwodGFyZ2V0LCBtb2RlbFssIG9wdGlvbnNdKScpO1xuICAgICAgLy8gfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICAoIGFyZ3NbMF0gaW5zdGFuY2VvZiBOb2RlIHx8IFxuICAgICAgICAgICh0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICAoIGFyZ3NbMV0gaW5zdGFuY2VvZiBOb2RlIHx8IFxuICAgICAgICAgIGFyZ3NbMV0gaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50IHx8XG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzFdID09PSAnc3RyaW5nJylcbiAgICAgICAgKSAmJlxuXG4gICAgICAgICggdHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnIHx8XG4gICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnXG4gICAgICAgICkgJiZcblxuICAgICAgICBhcmdzWzJdICE9PSB1bmRlZmluZWRcblxuICAgICAgKSB7XG5cbiAgICAgICAgdGFyZ2V0ID0gYXJnc1swXSBpbnN0YW5jZW9mIE5vZGUgP1xuICAgICAgICAgIGFyZ3NbMF0gOlxuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICAgICAgdGVtcGxhdGUgPSBhcmdzWzFdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgICAgIGFyZ3NbMV07XG5cbiAgICAgICAgbW9kZWwgPSBcbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgYXJnc1syXSA6XG4gICAgICAgICAgICBhcmdzWzJdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgICAgIHJlcXVpcmUoJy4vZXZhbC1vYmplY3QnKShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMl0pLmlubmVySFRNTCkgOlxuICAgICAgICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKHRhcmdldC5ub2RlTmFtZSA9PT0gJ1NDUklQVCcpIHtcbiAgICAgICAgICB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgdC5pZCA9IHRhcmdldC5pZDtcbiAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQodCwgdGFyZ2V0KTtcbiAgICAgICAgICB0YXJnZXQgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICAvLyBBc3NpZ24gY29tcGlsZWQgdGVtcGxhdGVcbiAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICAgIH1cbiAgICB9XG5cblxuXG4vKlxuXG5PbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcblxuKi9cblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdGVtcGxhdGVdJyk7XG4gICAgICB2YXIgdCwgbTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRhcmdldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdCA9IHRhcmdldHNbaV07XG4gICAgICAgIC8vIGlmIChzcmMubWF0Y2goY29uc3RzLlJFX05PREVfSUQpKSB7XG4gICAgICAgIC8vICAgcmV0dXJuIGxvYWRNb2RlbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYykuaW5uZXJIVE1MKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIGp0bXBsKHQsIFxuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGVtcGxhdGUnKSkuaW5uZXJIVE1MLCBcbiAgICAgICAgICByZXF1aXJlKCcuL2V2YWwtb2JqZWN0JylcbiAgICAgICAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJykpLmlubmVySFRNTClcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG4vKlxuXG5FeHBvc2UgZnJlYWtcblxuKi9cblxuICAgIGp0bXBsLmZyZWFrID0gcmVxdWlyZSgnZnJlYWsnKTtcblxuXG5cblxuLypcblxuRXhwb3J0XG5cbiovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBqdG1wbDsiLCIvKlxuXG4jIyBSdWxlc1xuXG5FYWNoIHJ1bGUgaXMgYSBmdW5jdGlvbiwgYXJncyB3aGVuIGNhbGxlZCBhcmU6XG4odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucylcblxudGFnOiB0ZXh0IGJldHdlZW4gZGVsaW1pdGVycywge3t0YWd9fVxubm9kZTogRE9NIG5vZGUsIHdoZXJlIHRhZyBpcyBmb3VuZFxuYXR0cjogbm9kZSBhdHRyaWJ1dGUgb3IgbnVsbCwgaWYgbm9kZSBjb250ZW50c1xubW9kZWw6IEZyZWFrIG1vZGVsXG5vcHRpb25zOiBjb25maWd1cmF0aW9uIG9wdGlvbnNcblxuSXQgbXVzdCByZXR1cm4gZWl0aGVyOlxuXG4qIGZhbHN5IHZhbHVlIC0gbm8gbWF0Y2hcblxuKiBvYmplY3QgLSBtYXRjaCBmb3VuZCwgcmV0dXJuIChhbGwgZmllbGRzIG9wdGlvbmFsKVxuXG4gICAgIHtcbiAgICAgICAvLyBQYXJzZSB1bnRpbCB7ey99fSBvciB7ey9zb21lUHJvcH19IC4uLlxuICAgICAgIGJsb2NrOiAnc29tZVByb3AnLFxuXG4gICAgICAgLy8gLi4uIHRoZW4gdGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZC5cbiAgICAgICAvLyBJdCBtdXN0IHJldHVybiBzdHJpbmcgb3IgRE9NRWxlbWVudFxuICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkgeyAuLi4gfVxuICAgICB9XG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvY2xhc3MtYmxvY2snKSxcbiAgICAgIHJlcXVpcmUoJy4vcnVsZXMvY2xhc3MtdmFyJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL2Jsb2NrJyksXG4gICAgICByZXF1aXJlKCcuL3J1bGVzL3ZhcicpXG4gICAgXTtcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIi8qXG5cbiMjIyB7eyNibG9ja319XG5cbkNhbiBiZSBib3VuZCB0byB0ZXh0IG5vZGVcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFnLCBub2RlLCBhdHRyLCBtb2RlbCwgb3B0aW9ucykge1xuICAgICAgdmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuLi9jb21waWxlcicpO1xuICAgICAgdmFyIG1hdGNoID0gdGFnLm1hdGNoKG5ldyBSZWdFeHAoJyMnICsgcmVxdWlyZSgnLi4vY29uc3RzJykuUkVfU1JDX0lERU5USUZJRVIpKTtcbiAgICAgIHZhciBwcm9wID0gbWF0Y2ggJiYgbWF0Y2hbMV07XG4gICAgICB2YXIgdGVtcGxhdGU7XG4gICAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgICAgcGFyZW50LnJlcGxhY2VDaGlsZChcbiAgICAgICAgICAgIGNvbXBpbGUodGVtcGxhdGUsIG1vZGVsKHByb3ApKGkpKSxcbiAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwocHJvcCkoaW5kZXggKyBpKSkpO1xuICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogdGVtcGxhdGUuY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4pIHtcbiAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGluc2VydCk7XG4gICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC5sZW47IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFsLm9uKCdjaGFuZ2UnLCBpLCB1cGRhdGUoaSkpO1xuICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNvbXBpbGUodGVtcGxhdGUsIHZhbChpKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmICF2YWwubGVuKSB7XG4gICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgdmFsKTtcbiAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgcmVuZGVyID0gY29tcGlsZSh0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgY2hhbmdlKCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBibG9jazogcHJvcCxcblxuICAgICAgICAgIHJlcGxhY2U6IGZ1bmN0aW9uKHRtcGwsIHBhcmVudCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAgIHRlbXBsYXRlID0gdG1wbDtcbiAgICAgICAgICAgIHJldHVybiBhbmNob3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICB9XG4gICAgfSIsIi8qXG5cbiMjIyBjbGFzcz1cInt7I2lmQ29uZGl0aW9ufX1zb21lLWNsYXNze3svfX1cIlxuXG5Ub2dnbGVzIGNsYXNzIGBzb21lLWNsYXNzYCBpbiBzeW5jIHdpdGggYm9vbGVhbiBgbW9kZWwuaWZDb25kaXRpb25gXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhZywgbm9kZSwgYXR0ciwgbW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBtYXRjaCA9IHRhZy5tYXRjaChuZXcgUmVnRXhwKCcjJyArIHJlcXVpcmUoJy4uL2NvbnN0cycpLlJFX1NSQ19JREVOVElGSUVSKSk7XG4gICAgICB2YXIgcHJvcCA9IG1hdGNoICYmIG1hdGNoWzFdO1xuICAgICAgdmFyIGtsYXNzO1xuXG4gICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgcmVxdWlyZSgnZWxlbWVudC1jbGFzcycpKG5vZGUpXG4gICAgICAgICAgWyEhdmFsICYmICdhZGQnIHx8ICdyZW1vdmUnXShrbGFzcyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChhdHRyID09PSAnY2xhc3MnICYmIG1hdGNoKSB7XG4gICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICBjaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGJsb2NrOiBwcm9wLFxuXG4gICAgICAgICAgcmVwbGFjZTogZnVuY3Rpb24odG1wbCkge1xuICAgICAgICAgICAga2xhc3MgPSB0bXBsO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4iLCIvKlxuXG4jIyMgY2xhc3M9XCJ7e3NvbWUtY2xhc3N9fVwiXG5cblRvZ2dsZXMgY2xhc3MgYHNvbWUtY2xhc3NgIGluIHN5bmMgd2l0aCBib29sZWFuIGBtb2RlbFsnc29tZS1jbGFzcyddYFxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbWF0Y2ggPSB0YWcubWF0Y2gocmVxdWlyZSgnLi4vY29uc3RzJykuUkVfSURFTlRJRklFUik7XG4gICAgICB2YXIgZWMgPSByZXF1aXJlKCdlbGVtZW50LWNsYXNzJykobm9kZSk7XG5cbiAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgZWNbISFtb2RlbCh0YWcpICYmICdhZGQnIHx8ICdyZW1vdmUnXShrbGFzcyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChhdHRyID09PSAnY2xhc3MnICYmIG1hdGNoKSB7XG4gICAgICAgIC8vIFJlbW92ZSB0YWcgZnJvbSBjbGFzcyBsaXN0XG4gICAgICAgIGVjLnJlbW92ZShvcHRpb25zLmRlbGltaXRlcnNbMF0gKyB0YWcgKyBvcHRpb25zLmRlbGltaXRlcnNbMV0pO1xuXG4gICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICBjaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4ge307XG4gICAgICB9XG4gICAgfVxuIiwiLypcblxuIyMjIHt7dmFyfX1cblxuQ2FuIGJlIGJvdW5kIHRvIHRleHQgbm9kZSBkYXRhIG9yIGF0dHJpYnV0ZVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YWcsIG5vZGUsIGF0dHIsIG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICB2YXIgcmVhY3QsIHRhcmdldDtcbiAgICAgIFxuICAgICAgaWYgKHRhZy5tYXRjaChyZXF1aXJlKCcuLi9jb25zdHMnKS5SRV9JREVOVElGSUVSKSkge1xuXG4gICAgICAgIC8vIEF0dHJpYnV0ZT9cbiAgICAgICAgaWYgKGF0dHIpIHtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgdGFnLFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciB2YWwgPSBtb2RlbCh0YWcpO1xuICAgICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyLCB2YWwpIDpcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0YXJnZXQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgdGFnLFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHRhcmdldC5kYXRhID0gbW9kZWwodGFnKSB8fCAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJpZ2dlciBjaGFuZ2VcbiAgICAgICAgbW9kZWwodGFnLCBtb2RlbCh0YWcpKTtcblxuICAgICAgICAvLyBNYXRjaCBmb3VuZFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlcGxhY2U6IHRhcmdldFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICApLmpvaW4oJyYnKSA6XG5cbiAgICAgICAgICAgIC8vIE5vIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICcnO1xuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIHJlc3A7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3AgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJlc3AgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCByZXNwLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vcGVuKGFyZ3NbMF0sIGFyZ3NbMV0sXG4gICAgICAgIChvcHRzLmFzeW5jICE9PSB1bmRlZmluZWQgPyBvcHRzLmFzeW5jIDogdHJ1ZSksIFxuICAgICAgICBvcHRzLnVzZXIsIG9wdHMucGFzc3dvcmQpO1xuXG4gICAgICB4aHIuc2VuZChyZXF1ZXN0KTtcblxuICAgIH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdHMpIHtcbiAgcmV0dXJuIG5ldyBFbGVtZW50Q2xhc3Mob3B0cylcbn1cblxuZnVuY3Rpb24gRWxlbWVudENsYXNzKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEVsZW1lbnRDbGFzcykpIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG4gIHZhciBzZWxmID0gdGhpc1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuXG4gIC8vIHNpbWlsYXIgZG9pbmcgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCBidXQgd29ya3MgaW4gSUU4XG4gIGlmIChvcHRzLm5vZGVUeXBlKSBvcHRzID0ge2VsOiBvcHRzfVxuXG4gIHRoaXMub3B0cyA9IG9wdHNcbiAgdGhpcy5lbCA9IG9wdHMuZWwgfHwgZG9jdW1lbnQuYm9keVxuICBpZiAodHlwZW9mIHRoaXMuZWwgIT09ICdvYmplY3QnKSB0aGlzLmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLmVsKVxufVxuXG5FbGVtZW50Q2xhc3MucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNsYXNzTmFtZSkge1xuICB2YXIgZWwgPSB0aGlzLmVsXG4gIGlmICghZWwpIHJldHVyblxuICBpZiAoZWwuY2xhc3NOYW1lID09PSBcIlwiKSByZXR1cm4gZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgaWYgKGNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTEpIHJldHVybiBjbGFzc2VzXG4gIGNsYXNzZXMucHVzaChjbGFzc05hbWUpXG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpXG4gIHJldHVybiBjbGFzc2VzXG59XG5cbkVsZW1lbnRDbGFzcy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oY2xhc3NOYW1lKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgaWYgKCFlbCkgcmV0dXJuXG4gIGlmIChlbC5jbGFzc05hbWUgPT09IFwiXCIpIHJldHVyblxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIHZhciBpZHggPSBjbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKVxuICBpZiAoaWR4ID4gLTEpIGNsYXNzZXMuc3BsaWNlKGlkeCwgMSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICByZXR1cm4gY2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmcmVhayhvYmosIHJvb3QsIHBhcmVudCkge1xuXG4gIHZhciBsaXN0ZW5lcnMgPSB7XG4gICAgJ2NoYW5nZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIGRlcGVuZGVudHMgPSB7fTtcbiAgdmFyIGNoaWxkcmVuID0ge307XG5cbiAgZnVuY3Rpb24gYXNzZXJ0KGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgdGhyb3cgbXNnIHx8ICdhc3NlcnRpb24gZmFpbGVkJztcbiAgICB9XG4gIH1cblxuICAvLyBNaXggcHJvcGVydGllcyBpbnRvIHRhcmdldFxuICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wZXJ0aWVzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtwcm9wc1tpXV0gPSBwcm9wZXJ0aWVzW3Byb3BzW2ldXTtcbiAgICB9XG4gIH1cblxuICAvLyBFdmVudCBmdW5jdGlvbnNcbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9IFxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG5cbiAgICAvLyBBcmdzIGNoZWNrXG4gICAgYXNzZXJ0KFsnY2hhbmdlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoZXZlbnQgPT09ICdjaGFuZ2UnICYmIHByb3ApIHx8XG4gICAgICAoKGV2ZW50ID09PSAnaW5zZXJ0JyB8fCBldmVudCA9PT0gJ2RlbGV0ZScpICYmICFwcm9wKVxuICAgICk7XG5cbiAgICAvLyBJbml0IGxpc3RlbmVycyBmb3IgcHJvcFxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICAvLyBBbHJlYWR5IHJlZ2lzdGVyZWQ/XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjaykgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID0gXG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcbiAgICB2YXIgaTtcblxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGFsbCBwcm9wZXJ0eSB3YXRjaGVycz9cbiAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdID0gW107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gUmVtb3ZlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICBpID0gbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgIGlmIChpID4gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5zcGxpY2UoaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gIH0gIFxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIChsaXN0ZW5lcnNbZXZlbnRdW2V2ZW50ID09PSAnY2hhbmdlJyA/IGEgOiBudWxsXSB8fCBbXSlcbiAgICAgIC5tYXAoZnVuY3Rpb24obGlzdGVuZXIpIHtcbiAgICAgICAgbGlzdGVuZXIuY2FsbChpbnN0YW5jZSwgYSwgYik7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIEZ1bmN0aW9uYWwgYWNjZXNzb3JcbiAgZnVuY3Rpb24gYWNjZXNzb3IocHJvcCwgYXJnLCByZWZyZXNoKSB7XG5cbiAgICB2YXIgaSwgbGVuLCBkZXAsIHJlc3VsdCwgdmFsO1xuXG4gICAgLy8gTGlmdCBhY2Nlc3NvciwgdHJhY2sgZGVwZW5kZW5jaWVzXG4gICAgZnVuY3Rpb24gZGVwZW5kZW5jeVRyYWNrZXIoX3Byb3AsIF9hcmcsIF9yZWZyZXNoKSB7XG4gICAgICBpZiAoIWRlcGVuZGVudHNbX3Byb3BdKSB7XG4gICAgICAgIGRlcGVuZGVudHNbX3Byb3BdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoZGVwZW5kZW50c1tfcHJvcF0uaW5kZXhPZihwcm9wKSA9PT0gLTEpIHtcbiAgICAgICAgZGVwZW5kZW50c1tfcHJvcF0ucHVzaChwcm9wKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhY2Nlc3NvcihfcHJvcCwgX2FyZywgX3JlZnJlc2gpO1xuICAgIH1cblxuICAgIC8vIEdldHRlcj9cbiAgICBpZiAoKGFyZyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpICYmICFyZWZyZXNoKSB7XG5cbiAgICAgIHZhbCA9IG9ialtwcm9wXTtcblxuICAgICAgcmVzdWx0ID0gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHlcbiAgICAgICAgdmFsLmNhbGwoZGVwZW5kZW5jeVRyYWNrZXIsIGFyZykgOlxuICAgICAgICAvLyBTdGF0aWMgcHJvcGVydHkgKGxlYWYgaW4gdGhlIGRlcGVuZGVuY3kgdHJlZSlcbiAgICAgICAgdmFsO1xuXG4gICAgICByZXR1cm4gdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcgPyBcblxuICAgICAgICB0eXBlb2YgY2hpbGRyZW5bcHJvcF0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGNoaWxkcmVuW3Byb3BdIDpcbiAgICAgICAgICBjaGlsZHJlbltwcm9wXSA9IGZyZWFrKHZhbCwgcm9vdCB8fCBpbnN0YW5jZSwgaW5zdGFuY2UpIDpcblxuICAgICAgICByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gU2V0dGVyXG4gICAgZWxzZSB7XG5cbiAgICAgIGlmICghcmVmcmVzaCkge1xuICAgICAgICBpZiAodHlwZW9mIG9ialtwcm9wXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5IHNldHRlclxuICAgICAgICAgIG9ialtwcm9wXS5jYWxsKGRlcGVuZGVuY3lUcmFja2VyLCBhcmcpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIFNpbXBsZSBwcm9wZXJ0eS4gYGFyZ2AgaXMgdGhlIG5ldyB2YWx1ZVxuICAgICAgICAgIG9ialtwcm9wXSA9IGFyZztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBOb3RpZnkgZGVwZW5kZW50c1xuICAgICAgZm9yIChpID0gMCwgZGVwID0gZGVwZW5kZW50c1twcm9wXSB8fCBbXSwgbGVuID0gZGVwLmxlbmd0aDtcbiAgICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgYWNjZXNzb3IoZGVwW2ldLCBhcmcsIHRydWUpO1xuICAgICAgfVxuXG4gICAgICAvLyBFbWl0IHVwZGF0ZSBldmVudFxuICAgICAgdHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG5cbiAgICB9IC8vIGlmIGdldHRlciAgICAgICAgXG5cbiAgfSAvLyBlbmQgYWNjZXNzb3JcblxuICB2YXIgYXJyYXlQcm9wZXJ0aWVzID0ge1xuICAgIC8vIEZ1bmN0aW9uIHByb3RvdHlwZSBhbHJlYWR5IGNvbnRhaW5zIGxlbmd0aFxuICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgIHBvcDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10ucG9wLmFwcGx5KG9iaik7XG4gICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIHRoaXMubGVuLCAxKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHB1c2g6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnB1c2guYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICB0cmlnZ2VyKCdpbnNlcnQnLCB0aGlzLmxlbiAtIDEsIDEpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgcmV2ZXJzZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10ucmV2ZXJzZS5hcHBseShvYmopO1xuICAgICAgdGhpcy5sZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc2hpZnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnNoaWZ0LmFwcGx5KG9iaik7XG4gICAgICB0aGlzLmxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHVuc2hpZnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdLnVuc2hpZnQuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgdGhpcy5sZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgMSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBzb3J0OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXS5zb3J0LmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW10uc3BsaWNlLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIHRoaXMubGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgfVxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzLmxlbmd0aCAtIDIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgfTtcblxuICB2YXIgaW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gYWNjZXNzb3IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICB2YXIgaW5zdGFuY2VQcm9wZXJ0aWVzID0ge1xuICAgIHZhbHVlczogb2JqLFxuICAgIHBhcmVudDogcGFyZW50IHx8IG51bGwsXG4gICAgcm9vdDogcm9vdCB8fCBpbnN0YW5jZSxcbiAgICAvLyAub24oZXZlbnRbLCBwcm9wXSwgY2FsbGJhY2spXG4gICAgb246IG9uLFxuICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICBvZmY6IG9mZlxuICB9O1xuXG4gIG1peGluKGluc3RhbmNlLCBpbnN0YW5jZVByb3BlcnRpZXMpO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICBtaXhpbihpbnN0YW5jZSwgYXJyYXlQcm9wZXJ0aWVzKTtcbiAgfVxuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ29tbW9uSlMgZXhwb3J0XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcpIG1vZHVsZS5leHBvcnRzID0gZnJlYWs7Il19
(5)
});
