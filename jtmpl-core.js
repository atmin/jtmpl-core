!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jtmpl=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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

},{}],2:[function(_dereq_,module,exports){
var RE_DELIMITED_VAR = /^\{\{([\w\.\-]+)\}\}$/;


/*
 * Attribute rules
 *
 */
module.exports = [

  /**
   * value="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'value' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            var val = jtmpl.get(model, prop);
            if (node[attr] !== val) {
              node[attr] = val || '';
            }
          }

          // text input?
          var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
            'keyup' : 'change'; // IE9 incorectly reports it supports input event

          node.addEventListener(eventType, function() {
            model(prop, node[attr]);
          });

          model.on('change', prop, change);
          change();

        }
      };
    }
  },




  /**
   * selected="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'jtmpl-selected' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            if (node.nodeName === 'OPTION') {
              var i = selects.indexOf(node.parentNode);
              if (selectsUpdating[i]) {
                return;
              }
              for (var j = 0, len = selectOptions[i].length; j < len; j++) {
                selectOptions[i][j].selected = selectOptionsContexts[i][j](prop);
              }
            }
            else {
              node.selected = model(prop);
            }
          }

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
                  selectsUpdating[i] = true;
                  for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
                    selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
                  }
                  selectsUpdating[i] = false;
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


          model.on('change', prop, change);
          setTimeout(change);
        }
      };
    }
  },




  /**
   * checked="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (attr === 'jtmpl-checked' && match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            if (node.name) {
              if (radioGroupsUpdating[node.name]) {
                return;
              }
              for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                radioGroups[node.name][0][i].checked = radioGroups[node.name][1][i](prop);
              }
            }
            else {
              node.checked = model(prop);
            }
          }

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
              radioGroupsUpdating[node.name] = true;
              // Update all inputs from the group
              for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                radioGroups[node.name][1][i](prop, radioGroups[node.name][0][i].checked);
              }
              radioGroupsUpdating[node.name] = false;
            }
            else {
              // Update current input only
              model(prop, node.checked);
            }
          });

          model.on('change', prop, change);
          setTimeout(change);
        }

      };
    }
  },




  /**
   * class="{{#cond1}}class1{{/}} {{^cond2}}class2{{/}} ..."
   */
  function(node, attr) {
    if (attr !== 'class') {
      return;
    }
    var val = node.getAttribute(attr);
    var match;
    var reCond = /\{\{#([\w\.\-]+)\}\}([\S\s]+?)\{\{\/([\w\.\-]*?)\}\}/g;
    var cond = [];
    var reNegCond = /\{\{\^([\w\.\-]+)\}\}([\S\s]+?)\{\{\/([\w\.\-]*?)\}\}/g;
    var negCond = [];

    while ((match = reCond.exec(val))) {
      cond.push(match);
    }
    while ((match = reNegCond.exec(val))) {
      negCond.push(match);
    }

    console.log(cond);
    console.log(negCond);
  },




  /**
   * style="{{var}}"
   */
  function(node, attr) {

  },




  /**
   * attribute="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            var val = jtmpl.get(model, prop);
            return val ?
              node.setAttribute(attr, val) :
              node.removeAttribute(attr);
          }

          model.on('change', prop, change);
          change();
        }
      };
    }
  },




  /*
   * Fallback rule, copy the attribute
   * Strip jtmpl- prefix
   */
  function(node, attr) {
    return {
      prop: node.getAttribute(attr),
      rule: function(node, attr, model, prop) {
        node.setAttribute(attr.replace('jtmpl-', ''), prop);
      }
    };
  }

];

},{}],3:[function(_dereq_,module,exports){
/*
 * Node rules
 *
 */
module.exports = [

  /* jshint evil: true */




  /**
   * {{var}}
   */
  function(node) {
    if (node.innerHTML.match(/^[\w\.\-]+$/)) {

      return {

        prop: node.innerHTML,

        rule: function(fragment, model, prop) {
          var textNode = document.createTextNode(model(prop) || '');
          fragment.appendChild(textNode);
          model.on('change', prop, function() {
            textNode.data = jtmpl.get(model, prop) || '';
          });
        }
      };
    }
  },




  /**
   * {{&var}}
   */
  function(node) {
    var match = node.innerHTML.match(/^&([\w\.\-]+)$/);
    if (match) {
      return {

        prop: match[1],

        rule: function(fragment, model, prop) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
          var length = 0;

          function change() {
            var frag = document.createDocumentFragment();
            var el = document.createElement('body');
            var i;

            // Delete old rendering
            while (length) {
              anchor.parentNode.removeChild(anchor.previousSibling);
              length--;
            }

            el.innerHTML = model(prop) || '';
            length = el.childNodes.length;
            for (i = 0; i < length; i++) {
              frag.appendChild(el.childNodes[0]);
            }
            anchor.parentNode.insertBefore(frag, anchor);
          }

          fragment.appendChild(anchor);
          model.on('change', prop, change);
          change();
        }

      };
    }
  },




  /**
   * {{>partial}}
   */
  function(node) {
    // match: [1]=var_name, [2]='single-quoted' [3]="double-quoted"
    if (node.innerHTML.match(/>([\w\.\-]+)|'([^\']*)\'|"([^"]*)"/)) {
    }
  },




  /**
   * {{#section}}
   */
  function(node) {
    var match = node.innerHTML.match(/^#([\w\.\-]+)$/);

    if (match) {

      return {

        block: match[1],

        rule: function(fragment, model, prop, template) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
          var length = 0;
          // How many childNodes in one section item
          var chunkSize;

          function update(i) {
            return function() {
              var parent = anchor.parentNode;
              var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
              var pos = anchorIndex - length + i * chunkSize;
              var size = chunkSize;

              while (size--) {
                parent.removeChild(parent.childNodes[pos - 1]);
              }
              parent.insertBefore(
                eval(template + '(model(prop)(i))'),
                parent.childNodes[pos]
              );
            };
          }

          function insert(index, count) {
            var parent = anchor.parentNode;
            var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
            var pos = anchorIndex - length + index * chunkSize;
            var size = count * chunkSize;
            var i, fragment;

            for (i = 0, fragment = document.createDocumentFragment();
                i < count; i++) {
              fragment.appendChild(eval(template + '(model(prop)(index + i))'));
            }

            parent.insertBefore(fragment, parent.childNodes[pos]);
            length = length + size;
          }

          function del(index, count) {
            var parent = anchor.parentNode;
            var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
            var pos = anchorIndex - length + index * chunkSize;
            var size = count * chunkSize;

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

              //console.log('rendering ' + val.len + ' values');
              var func = eval(template);
              var child, childModel;
              for (i = 0, len = val.values.length; i < len; i++) {
                // TODO: implement event delegation for array indexes
                // Also, using val.values[i] instead of val[i]
                // saves A LOT of heap memory. Figure out how to do
                // on demand model creation.
                val.on('change', i, update(i));
                //render.appendChild(eval(template + '(val(i))'));
                //render.appendChild(func(val.values[i]));
                childModel = val(i);
                child = func(childModel);
                child.__jtmpl__ = childModel;
                render.appendChild(child);
              }

              length = render.childNodes.length;
              chunkSize = ~~(length / len);
              anchor.parentNode.insertBefore(render, anchor);
            }

            // Object?
            else if (typeof val === 'function' && val.len === undefined) {
              render = eval(template + '(val)');
              length = render.childNodes.length;
              chunkSize = length;
              anchor.parentNode.insertBefore(render, anchor);
              anchor.parentNode.__jtmpl__ = model;
            }

            // Cast to boolean
            else {
              if (!!val) {
                render = eval(template + '(model)');
                length = render.childNodes.length;
                chunkSize = length;
                anchor.parentNode.insertBefore(render, anchor);
              }
            }
          }

          fragment.appendChild(anchor);
          change();
          model.on('change', prop, change);
        }
      };
    }
  },





  /**
   * {{^inverted_section}}
   */
  function(node) {
    var match = node.innerHTML.match(/^\^([\w\.\-]+)$/);

    if (match) {

      return {

        block: match[1],

        rule: function(fragment, model, prop, template) {

          // Anchor node for keeping section location
          var anchor = document.createComment('');
          // Number of rendered nodes
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
                render.appendChild(eval(template + '(val(i))'));
              }

              length = render.childNodes.length;
              anchor.parentNode.insertBefore(render, anchor);
            }
            // Cast to boolean
            else {
              if (!val) {
                render = eval(template + '(model)');
                length = render.childNodes.length;
                anchor.parentNode.insertBefore(render, anchor);
              }
            }
          }

          fragment.appendChild(anchor);
          change();
          model.on('change', prop, change);
        }


      };
    }
  },



  /*
   * Fallback rule, not recognized jtmpl tag
   */
  function(node) {
    return {
      rule: function(fragment) {
        fragment.appendChild(document.createTextNode('REMOVEMELATER'));
      }
    };
  }
];

},{}],4:[function(_dereq_,module,exports){
/**
 * Compile a template, parsed by @see parse
 *
 * @param {documentFragment} template
 * @param {string|undefined} sourceURL - include sourceURL to aid debugging
 *
 * @returns {string} - Function body, accepting Freak instance parameter, suitable for eval()
 */
function compile(template, sourceURL, depth) {

  var ri, rules, rlen;
  var match, block;

  // Generate dynamic function body
  var func = '(function(model) {\n' +
    'var frag = document.createDocumentFragment(), node;\n\n';

  if (!depth) {
    // Global bookkeeping
    func +=
      'var radioGroups = {};\n' +
      'var radioGroupsUpdating = {};\n' +
      'var selects = [];\n' +
      'var selectsUpdating = [];\n' +
      'var selectOptions = [];\n' +
      'var selectOptionsContexts = [];\n\n';
  }

  // Wrap model in a Freak instance, if necessary
  func += 'model = typeof model === "function" ?' +
    'model : ' +
    'typeof model === "object" ?' +
      'jtmpl(model) :' +
      'jtmpl({".": model});\n\n';

  // Iterate childNodes
  for (var i = 0, childNodes = template.childNodes, len = childNodes.length, node;
       i < len; i++) {

    node = childNodes[i];

    switch (node.nodeType) {

      // Element node
      case 1:

        // jtmpl tag?
        if (node.nodeName === 'SCRIPT' && node.type === 'text/jtmpl-tag') {

          for (ri = 0, rules = _dereq_('./compile-rules-node'), rlen = rules.length;
              ri < rlen; ri++) {

            match = rules[ri](node);

            // Rule found?
            if (match) {

              // Block tag?
              if (match.block) {

                // Fetch block template
                block = document.createDocumentFragment();
                for (i++;
                    (i < len) && !matchEndBlock(match.block, childNodes[i].innerHTML || '');
                    i++) {
                  block.appendChild(childNodes[i].cloneNode(true));
                }

                if (i === len) {
                  throw 'jtmpl: Unclosed ' + match.block;
                }
                else {
                  func += '(' + match.rule.toString() + ')' +
                    '(frag, model, ' +
                    JSON.stringify(match.block) + ', ' +   // prop
                    JSON.stringify(
                      // template
                      compile(
                        block,
                        sourceURL && (sourceURL + '-' + node.innerHTML + '[' + i + ']'),
                        (depth || 0) + 1
                      )
                    ) + ');';
                }

              }
              // Inline tag
              else {
                func += '(' + match.rule.toString() + ')' +
                  '(frag, model, ' + JSON.stringify(match.prop) + ');\n';
              }

              // Skip remaining rules
              break;
            }
          } // end iterating node rules
        }

        else {
          // Create element
          func += 'node = document.createElement("' + node.nodeName + '");\n';

          // Process attributes
          for (var ai = 0, attributes = node.attributes, alen = attributes.length;
               ai < alen; ai++) {

            for (ri = 0, rules = _dereq_('./compile-rules-attr'), rlen = rules.length;
                ri < rlen; ri++) {

              match = rules[ri](node, attributes[ai].name.toLowerCase());

              if (match) {

                // Match found, append rule to func
                func += '(' + match.rule.toString() + ')' +
                  '(node, ' +
                  JSON.stringify(attributes[ai].name) + // attr
                  ', model, ' +
                  JSON.stringify(match.prop) +          // prop
                  ');\n';

                // Skip other attribute rules
                break;
              }
            }
          }

          // Recursively compile
          func += 'node.appendChild(' +
            compile(
              node,
              sourceURL && (sourceURL + '-' + node.nodeName + '[' + i + ']'),
              (depth || 0) + 1
            ) + '(model));\n';

          // Append to fragment
          func += 'frag.appendChild(node);\n';
        }

        break;


      // Text node
      case 3:
        func += 'frag.appendChild(document.createTextNode(' +
          JSON.stringify(node.data) + '));\n';
        break;


      // Comment node
      case 8:
        func += 'frag.appendChild(document.createComment(' +
          JSON.stringify(node.data) + '));\n';
        break;

    } // end switch
  } // end iterate childNodes

  func += 'return frag; })';
  func += sourceURL ?
    '\n//@ sourceURL=' + sourceURL + '\n//# sourceURL=' + sourceURL + '\n' :
    '';

  return func;
}




function matchEndBlock(block, str) {
  var match = str.match(/\/([\w\.\-]+)?/);
  return match ?
    block === '' || !match[1] || match[1] === block :
    false;
}




module.exports = compile;

},{"./compile-rules-attr":2,"./compile-rules-node":3}],5:[function(_dereq_,module,exports){
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

},{"./consts":5}],8:[function(_dereq_,module,exports){
/*

## Main function

*/

/* jshint evil: true */
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
            jtmpl(
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
        //target.appendChild(require('./compiler')(template, model, args[3]));
        target.appendChild(
          eval(
            jtmpl.compile(
              jtmpl.parse(template),
              target.getAttribute('data-jtmpl')
            ) + '(model)'
          )
        );
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
    jtmpl.get = function(model, prop) {
      var val = model(prop);
      return (typeof val === 'function') ?
        JSON.stringify(val.values) :
        val;
    };


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

},{"./compile":4,"./consts":5,"./content-loaded":6,"./loader":7,"./parse":9,"./xhr":10,"freak":1}],9:[function(_dereq_,module,exports){
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
    template = template.replace(/\{\{\{([\S\s]*?)\}\}\}/g, '{{&$1}}');

    // 1. wrap each non-attribute tag in <script type="text/jtmpl-tag">
    // 2. remove Mustache comments
    // TODO: handle tags in HTML comments
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

},{}],10:[function(_dereq_,module,exports){
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

},{}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1hdHRyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1ub2RlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbnN0cy5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbnRlbnQtbG9hZGVkLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbG9hZGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbWFpbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3BhcnNlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMveGhyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ3VwZGF0ZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIF9kZXBlbmRlbnRQcm9wcyA9IHt9O1xuICB2YXIgX2RlcGVuZGVudENvbnRleHRzID0ge307XG4gIHZhciBjYWNoZSA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICAvLyBBc3NlcnQgY29uZGl0aW9uXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVlcEVxdWFsKHgsIHkpIHtcbiAgICBpZiAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgeSA9PT0gXCJvYmplY3RcIiAmJiB5ICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyh4KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKHkpLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIHByb3AgaW4geCkge1xuICAgICAgICBpZiAoeC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmICh5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh4W3Byb3BdLCB5W3Byb3BdKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoeCAhPT0geSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/XG4gICAgICBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAndXBkYXRlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgIT09IG51bGwpIHx8XG4gICAgICAoWydpbnNlcnQnLCAnZGVsZXRlJywgJ3VwZGF0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCA9PT0gbnVsbClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIG9yIHNwZWNpZmllZCBsaXN0ZW5lcnMgZ2l2ZW4gZXZlbnQgYW5kIHByb3BlcnR5XG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIHZhciBoYW5kbGVycyA9IChsaXN0ZW5lcnNbZXZlbnRdW1snY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSA/IGEgOiBudWxsXSB8fCBbXSk7XG4gICAgdmFyIGksIGxlbiA9IGhhbmRsZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGhhbmRsZXJzW2ldLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgIH07XG4gIH1cblxuICAvLyBFeHBvcnQgbW9kZWwgdG8gSlNPTiBzdHJpbmdcbiAgLy8gTk9UIGV4cG9ydGVkOlxuICAvLyAtIHByb3BlcnRpZXMgc3RhcnRpbmcgd2l0aCBfIChQeXRob24gcHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbnZlbnRpb24pXG4gIC8vIC0gY29tcHV0ZWQgcHJvcGVydGllcyAoZGVyaXZlZCBmcm9tIG5vcm1hbCBwcm9wZXJ0aWVzKVxuICBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgZnVuY3Rpb24gZmlsdGVyKG9iaikge1xuICAgICAgdmFyIGtleSwgZmlsdGVyZWQgPSBBcnJheS5pc0FycmF5KG9iaikgPyBbXSA6IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZpbHRlcihvYmpba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9ialtrZXldICE9PSAnZnVuY3Rpb24nICYmIGtleVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmaWx0ZXIob2JqKSk7XG4gIH1cblxuICAvLyBMb2FkIG1vZGVsIGZyb20gSlNPTiBzdHJpbmcgb3Igb2JqZWN0XG4gIGZ1bmN0aW9uIGZyb21KU09OKGRhdGEpIHtcbiAgICB2YXIga2V5O1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH1cbiAgICBmb3IgKGtleSBpbiBkYXRhKSB7XG4gICAgICBpbnN0YW5jZShrZXksIGRhdGFba2V5XSk7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBrZXkpO1xuICAgIH1cbiAgICBpbnN0YW5jZS5sZW4gPSBvYmoubGVuZ3RoO1xuICB9XG5cbiAgLy8gVXBkYXRlIGhhbmRsZXI6IHJlY2FsY3VsYXRlIGRlcGVuZGVudCBwcm9wZXJ0aWVzLFxuICAvLyB0cmlnZ2VyIGNoYW5nZSBpZiBuZWNlc3NhcnlcbiAgZnVuY3Rpb24gdXBkYXRlKHByb3ApIHtcbiAgICBpZiAoIWRlZXBFcXVhbChjYWNoZVtwcm9wXSwgZ2V0KHByb3AsIGZ1bmN0aW9uKCkge30sIHRydWUpKSkge1xuICAgICAgdHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGRlcGVuZGVudHNcbiAgICBmb3IgKHZhciBpID0gMCwgZGVwID0gX2RlcGVuZGVudFByb3BzW3Byb3BdIHx8IFtdLCBsZW4gPSBkZXAubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlbGV0ZSBjaGlsZHJlbltkZXBbaV1dO1xuICAgICAgX2RlcGVuZGVudENvbnRleHRzW3Byb3BdW2ldLnRyaWdnZXIoJ3VwZGF0ZScsIGRlcFtpXSk7XG4gICAgfVxuXG4gICAgaWYgKGluc3RhbmNlLnBhcmVudCkge1xuICAgICAgLy8gTm90aWZ5IGNvbXB1dGVkIHByb3BlcnRpZXMsIGRlcGVuZGluZyBvbiBwYXJlbnQgb2JqZWN0XG4gICAgICBpbnN0YW5jZS5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgaW5zdGFuY2UucHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJveHkgdGhlIGFjY2Vzc29yIGZ1bmN0aW9uIHRvIHJlY29yZFxuICAvLyBhbGwgYWNjZXNzZWQgcHJvcGVydGllc1xuICBmdW5jdGlvbiBnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSB7XG4gICAgZnVuY3Rpb24gdHJhY2tlcihjb250ZXh0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oX3Byb3AsIF9hcmcpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0pIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0gPSBbXTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXh0KF9wcm9wLCBfYXJnLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRyYWNrZXIoaW5zdGFuY2UpO1xuICAgIGNvbnN0cnVjdChyZXN1bHQpO1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgIHJlc3VsdC5wYXJlbnQgPSB0cmFja2VyKHBhcmVudCk7XG4gICAgfVxuICAgIHJlc3VsdC5yb290ID0gdHJhY2tlcihyb290IHx8IGluc3RhbmNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2hhbGxvdyBjbG9uZSBhbiBvYmplY3RcbiAgZnVuY3Rpb24gc2hhbGxvd0Nsb25lKG9iaikge1xuICAgIHZhciBrZXksIGNsb25lO1xuICAgIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNsb25lID0ge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgY2xvbmVba2V5XSA9IG9ialtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNsb25lID0gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICAvLyBHZXR0ZXIgZm9yIHByb3AsIGlmIGNhbGxiYWNrIGlzIGdpdmVuXG4gIC8vIGNhbiByZXR1cm4gYXN5bmMgdmFsdWVcbiAgZnVuY3Rpb24gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciB2YWwgPSBvYmpbcHJvcF07XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhbCA9IHZhbC5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCBjYWxsYmFjayk7XG4gICAgICBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICAgIGNhY2hlW3Byb3BdID0gKHZhbCA9PT0gdW5kZWZpbmVkKSA/IHZhbCA6IHNoYWxsb3dDbG9uZSh2YWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgIGNhY2hlW3Byb3BdID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciByZXN1bHQgPSBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKTtcblxuICAgIHJldHVybiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcgP1xuICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgIGNoaWxkcmVuW3Byb3BdID9cbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gOlxuICAgICAgICBjaGlsZHJlbltwcm9wXSA9IGZyZWFrKHJlc3VsdCwgcm9vdCB8fCBpbnN0YW5jZSwgaW5zdGFuY2UsIHByb3ApIDpcbiAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgcmVzdWx0O1xuICB9XG5cbiAgLy8gU2V0IHByb3AgdG8gdmFsXG4gIGZ1bmN0aW9uIHNldHRlcihwcm9wLCB2YWwpIHtcbiAgICB2YXIgb2xkVmFsID0gZ2V0KHByb3ApO1xuXG4gICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5IHNldHRlclxuICAgICAgb2JqW3Byb3BdLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIHZhbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gU2ltcGxlIHByb3BlcnR5XG4gICAgICBvYmpbcHJvcF0gPSB2YWw7XG4gICAgICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGRlbGV0ZSBjYWNoZVtwcm9wXTtcbiAgICAgICAgZGVsZXRlIGNoaWxkcmVuW3Byb3BdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvbGRWYWwgIT09IHZhbCkge1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywgcHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRnVuY3Rpb25hbCBhY2Nlc3NvciwgdW5pZnkgZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgZnVuY3Rpb24gYWNjZXNzb3IocHJvcCwgYXJnLCBza2lwQ2FjaGluZykge1xuICAgIHJldHVybiAoXG4gICAgICAoYXJnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICBnZXR0ZXIgOiBzZXR0ZXJcbiAgICApKHByb3AsIGFyZywgc2tpcENhY2hpbmcpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgZnVuY3Rpb24gY29uc3RydWN0KHRhcmdldCkge1xuICAgIG1peGluKHRhcmdldCwge1xuICAgICAgdmFsdWVzOiBvYmosXG4gICAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgICAgcm9vdDogcm9vdCB8fCB0YXJnZXQsXG4gICAgICBwcm9wOiBwcm9wID09PSB1bmRlZmluZWQgPyBudWxsIDogcHJvcCxcbiAgICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICAgIG9uOiBvbixcbiAgICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgLy8gLnRyaWdnZXIoZXZlbnRbLCBwcm9wXSlcbiAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICB0b0pTT046IHRvSlNPTixcbiAgICAgIC8vIERlcHJlY2F0ZWQuIEl0IGhhcyBhbHdheXMgYmVlbiBicm9rZW4sIGFueXdheVxuICAgICAgLy8gV2lsbCB0aGluayBob3cgdG8gaW1wbGVtZW50IHByb3Blcmx5XG4gICAgICBmcm9tSlNPTjogZnJvbUpTT04sXG4gICAgICAvLyBJbnRlcm5hbDogZGVwZW5kZW5jeSB0cmFja2luZ1xuICAgICAgX2RlcGVuZGVudFByb3BzOiBfZGVwZW5kZW50UHJvcHMsXG4gICAgICBfZGVwZW5kZW50Q29udGV4dHM6IF9kZXBlbmRlbnRDb250ZXh0c1xuICAgIH0pO1xuXG4gICAgLy8gV3JhcCBtdXRhdGluZyBhcnJheSBtZXRob2QgdG8gdXBkYXRlXG4gICAgLy8gc3RhdGUgYW5kIG5vdGlmeSBsaXN0ZW5lcnNcbiAgICBmdW5jdGlvbiB3cmFwQXJyYXlNZXRob2QobWV0aG9kLCBmdW5jKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXVttZXRob2RdLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICAgIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdGFyZ2V0LnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCB0YXJnZXQucHJvcCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgIG1peGluKHRhcmdldCwge1xuICAgICAgICAvLyBGdW5jdGlvbiBwcm90b3R5cGUgYWxyZWFkeSBjb250YWlucyBsZW5ndGhcbiAgICAgICAgLy8gYGxlbmAgc3BlY2lmaWVzIGFycmF5IGxlbmd0aFxuICAgICAgICBsZW46IG9iai5sZW5ndGgsXG5cbiAgICAgICAgcG9wOiB3cmFwQXJyYXlNZXRob2QoJ3BvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIHRoaXMubGVuLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcHVzaDogd3JhcEFycmF5TWV0aG9kKCdwdXNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgdGhpcy5sZW4gLSAxLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcmV2ZXJzZTogd3JhcEFycmF5TWV0aG9kKCdyZXZlcnNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgnc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgdW5zaGlmdDogd3JhcEFycmF5TWV0aG9kKCd1bnNoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNvcnQ6IHdyYXBBcnJheU1ldGhvZCgnc29ydCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNwbGljZTogd3JhcEFycmF5TWV0aG9kKCdzcGxpY2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHMubGVuZ3RoIC0gMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICAvLyBDcmVhdGUgZnJlYWsgaW5zdGFuY2VcbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgY29uc3RydWN0KGluc3RhbmNlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwidmFyIFJFX0RFTElNSVRFRF9WQVIgPSAvXlxce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9JC87XG5cblxuLypcbiAqIEF0dHJpYnV0ZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoqXG4gICAqIHZhbHVlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICd2YWx1ZScgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGp0bXBsLmdldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgICAgIG5vZGVbYXR0cl0gPSB2YWwgfHwgJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gdGV4dCBpbnB1dD9cbiAgICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICAgJ2tleXVwJyA6ICdjaGFuZ2UnOyAvLyBJRTkgaW5jb3JlY3RseSByZXBvcnRzIGl0IHN1cHBvcnRzIGlucHV0IGV2ZW50XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG5cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHNlbGVjdGVkPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICdqdG1wbC1zZWxlY3RlZCcgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgIGlmIChzZWxlY3RzVXBkYXRpbmdbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDAsIGxlbiA9IHNlbGVjdE9wdGlvbnNbaV0ubGVuZ3RoOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zW2ldW2pdLnNlbGVjdGVkID0gc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldW2pdKHByb3ApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZS5zZWxlY3RlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuXG4gICAgICAgICAgICAvLyBQcm9jZXNzIGFzeW5jLCBhcyBwYXJlbnROb2RlIGlzIHN0aWxsIGRvY3VtZW50RnJhZ21lbnRcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgIGlmIChpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIC8vIEFkZCA8c2VsZWN0PiB0byBsaXN0XG4gICAgICAgICAgICAgICAgaSA9IHNlbGVjdHMucHVzaChub2RlLnBhcmVudE5vZGUpIC0gMTtcbiAgICAgICAgICAgICAgICAvLyBJbml0IG9wdGlvbnNcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zLnB1c2goW10pO1xuICAgICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9ucyBjb250ZXh0c1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0cy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICAvLyBBdHRhY2ggY2hhbmdlIGxpc3RlbmVyXG4gICAgICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgc2VsZWN0c1VwZGF0aW5nW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGZvciAodmFyIG9pID0gMCwgb2xlbiA9IHNlbGVjdE9wdGlvbnNbaV0ubGVuZ3RoOyBvaSA8IG9sZW47IG9pKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldW29pXShwcm9wLCBzZWxlY3RPcHRpb25zW2ldW29pXS5zZWxlY3RlZCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzZWxlY3RzVXBkYXRpbmdbaV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBSZW1lbWJlciBvcHRpb24gYW5kIGNvbnRleHRcbiAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXS5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV0ucHVzaChtb2RlbCk7XG4gICAgICAgICAgICB9LCAwKTtcblxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIG1vZGVsKHByb3AsIHRoaXMuc2VsZWN0ZWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBjaGVja2VkPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICdqdG1wbC1jaGVja2VkJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5uYW1lKSB7XG4gICAgICAgICAgICAgIGlmIChyYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQgPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdW2ldKHByb3ApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZS5jaGVja2VkID0gbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gcmFkaW8gZ3JvdXA/XG4gICAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICAgIGlmICghcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAvLyBJbml0IHJhZGlvIGdyb3VwIChbMF06IG5vZGUsIFsxXTogbW9kZWwpXG4gICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV0gPSBbW10sIFtdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEFkZCBpbnB1dCB0byByYWRpbyBncm91cFxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgLy8gQWRkIGNvbnRleHQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV0ucHVzaChtb2RlbCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUudHlwZSA9PT0gJ3JhZGlvJyAmJiBub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNVcGRhdGluZ1tub2RlLm5hbWVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIGFsbCBpbnB1dHMgZnJvbSB0aGUgZ3JvdXBcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdW2ldKHByb3AsIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF1baV0uY2hlY2tlZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNVcGRhdGluZ1tub2RlLm5hbWVdID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgaW5wdXQgb25seVxuICAgICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlLmNoZWNrZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgc2V0VGltZW91dChjaGFuZ2UpO1xuICAgICAgICB9XG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBjbGFzcz1cInt7I2NvbmQxfX1jbGFzczF7ey99fSB7e15jb25kMn19Y2xhc3Mye3svfX0gLi4uXCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICBpZiAoYXR0ciAhPT0gJ2NsYXNzJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdmFsID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cik7XG4gICAgdmFyIG1hdGNoO1xuICAgIHZhciByZUNvbmQgPSAvXFx7XFx7IyhbXFx3XFwuXFwtXSspXFx9XFx9KFtcXFNcXHNdKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2c7XG4gICAgdmFyIGNvbmQgPSBbXTtcbiAgICB2YXIgcmVOZWdDb25kID0gL1xce1xce1xcXihbXFx3XFwuXFwtXSspXFx9XFx9KFtcXFNcXHNdKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2c7XG4gICAgdmFyIG5lZ0NvbmQgPSBbXTtcblxuICAgIHdoaWxlICgobWF0Y2ggPSByZUNvbmQuZXhlYyh2YWwpKSkge1xuICAgICAgY29uZC5wdXNoKG1hdGNoKTtcbiAgICB9XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlTmVnQ29uZC5leGVjKHZhbCkpKSB7XG4gICAgICBuZWdDb25kLnB1c2gobWF0Y2gpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGNvbmQpO1xuICAgIGNvbnNvbGUubG9nKG5lZ0NvbmQpO1xuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBzdHlsZT1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuXG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGF0dHJpYnV0ZT1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0ganRtcGwuZ2V0KG1vZGVsLCBwcm9wKTtcbiAgICAgICAgICAgIHJldHVybiB2YWwgP1xuICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyLCB2YWwpIDpcbiAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qXG4gICAqIEZhbGxiYWNrIHJ1bGUsIGNvcHkgdGhlIGF0dHJpYnV0ZVxuICAgKiBTdHJpcCBqdG1wbC0gcHJlZml4XG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3A6IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLFxuICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ci5yZXBsYWNlKCdqdG1wbC0nLCAnJyksIHByb3ApO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuXTtcbiIsIi8qXG4gKiBOb2RlIHJ1bGVzXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IFtcblxuICAvKiBqc2hpbnQgZXZpbDogdHJ1ZSAqL1xuXG5cblxuXG4gIC8qKlxuICAgKiB7e3Zhcn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYgKG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eW1xcd1xcLlxcLV0rJC8pKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbm9kZS5pbm5lckhUTUwsXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wKSB7XG4gICAgICAgICAgdmFyIHRleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobW9kZWwocHJvcCkgfHwgJycpO1xuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRleHROb2RlKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5kYXRhID0ganRtcGwuZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7JnZhcn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14mKFtcXHdcXC5cXC1dKykkLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnLmFwcGVuZENoaWxkKGVsLmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGZyYWcsIGFuY2hvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3s+cGFydGlhbH19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3VibGUtcXVvdGVkXCJcbiAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8pKSB7XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiB7eyNzZWN0aW9ufX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXiMoW1xcd1xcLlxcLV0rKSQvKTtcblxuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIGJsb2NrOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3AsIHRlbXBsYXRlKSB7XG5cbiAgICAgICAgICAvLyBBbmNob3Igbm9kZSBmb3Iga2VlcGluZyBzZWN0aW9uIGxvY2F0aW9uXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIC8vIE51bWJlciBvZiByZW5kZXJlZCBub2Rlc1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuICAgICAgICAgIC8vIEhvdyBtYW55IGNoaWxkTm9kZXMgaW4gb25lIHNlY3Rpb24gaXRlbVxuICAgICAgICAgIHZhciBjaHVua1NpemU7XG5cbiAgICAgICAgICBmdW5jdGlvbiB1cGRhdGUoaSkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgICAgdmFyIHNpemUgPSBjaHVua1NpemU7XG5cbiAgICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChwYXJlbnQuY2hpbGROb2Rlc1twb3MgLSAxXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShcbiAgICAgICAgICAgICAgICBldmFsKHRlbXBsYXRlICsgJyhtb2RlbChwcm9wKShpKSknKSxcbiAgICAgICAgICAgICAgICBwYXJlbnQuY2hpbGROb2Rlc1twb3NdXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGluc2VydChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICAgICAgZm9yIChpID0gMCwgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICAgICAgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwocHJvcCkoaW5kZXggKyBpKSknKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoICsgc2l6ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBzaXplID0gY291bnQgKiBjaHVua1NpemU7XG5cbiAgICAgICAgICAgIGxlbmd0aCA9IGxlbmd0aCAtIHNpemU7XG5cbiAgICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygncmVuZGVyaW5nICcgKyB2YWwubGVuICsgJyB2YWx1ZXMnKTtcbiAgICAgICAgICAgICAgdmFyIGZ1bmMgPSBldmFsKHRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgdmFyIGNoaWxkLCBjaGlsZE1vZGVsO1xuICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB2YWwudmFsdWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IGV2ZW50IGRlbGVnYXRpb24gZm9yIGFycmF5IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAvLyBBbHNvLCB1c2luZyB2YWwudmFsdWVzW2ldIGluc3RlYWQgb2YgdmFsW2ldXG4gICAgICAgICAgICAgICAgLy8gc2F2ZXMgQSBMT1Qgb2YgaGVhcCBtZW1vcnkuIEZpZ3VyZSBvdXQgaG93IHRvIGRvXG4gICAgICAgICAgICAgICAgLy8gb24gZGVtYW5kIG1vZGVsIGNyZWF0aW9uLlxuICAgICAgICAgICAgICAgIHZhbC5vbignY2hhbmdlJywgaSwgdXBkYXRlKGkpKTtcbiAgICAgICAgICAgICAgICAvL3JlbmRlci5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyh2YWwoaSkpJykpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGZ1bmModmFsLnZhbHVlc1tpXSkpO1xuICAgICAgICAgICAgICAgIGNoaWxkTW9kZWwgPSB2YWwoaSk7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBmdW5jKGNoaWxkTW9kZWwpO1xuICAgICAgICAgICAgICAgIGNoaWxkLl9fanRtcGxfXyA9IGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgY2h1bmtTaXplID0gfn4obGVuZ3RoIC8gbGVuKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcodmFsKScpO1xuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGNodW5rU2l6ZSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuX19qdG1wbF9fID0gbW9kZWw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7XmludmVydGVkX3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eXFxeKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBjaGFuZ2UpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcodmFsKGkpKScpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghdmFsKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwpJyk7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICB9XG5cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG4gIC8qXG4gICAqIEZhbGxiYWNrIHJ1bGUsIG5vdCByZWNvZ25pemVkIGp0bXBsIHRhZ1xuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiB7XG4gICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnUkVNT1ZFTUVMQVRFUicpKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5dO1xuIiwiLyoqXG4gKiBDb21waWxlIGEgdGVtcGxhdGUsIHBhcnNlZCBieSBAc2VlIHBhcnNlXG4gKlxuICogQHBhcmFtIHtkb2N1bWVudEZyYWdtZW50fSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtzdHJpbmd8dW5kZWZpbmVkfSBzb3VyY2VVUkwgLSBpbmNsdWRlIHNvdXJjZVVSTCB0byBhaWQgZGVidWdnaW5nXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBGdW5jdGlvbiBib2R5LCBhY2NlcHRpbmcgRnJlYWsgaW5zdGFuY2UgcGFyYW1ldGVyLCBzdWl0YWJsZSBmb3IgZXZhbCgpXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHNvdXJjZVVSTCwgZGVwdGgpIHtcblxuICB2YXIgcmksIHJ1bGVzLCBybGVuO1xuICB2YXIgbWF0Y2gsIGJsb2NrO1xuXG4gIC8vIEdlbmVyYXRlIGR5bmFtaWMgZnVuY3Rpb24gYm9keVxuICB2YXIgZnVuYyA9ICcoZnVuY3Rpb24obW9kZWwpIHtcXG4nICtcbiAgICAndmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIG5vZGU7XFxuXFxuJztcblxuICBpZiAoIWRlcHRoKSB7XG4gICAgLy8gR2xvYmFsIGJvb2trZWVwaW5nXG4gICAgZnVuYyArPVxuICAgICAgJ3ZhciByYWRpb0dyb3VwcyA9IHt9O1xcbicgK1xuICAgICAgJ3ZhciByYWRpb0dyb3Vwc1VwZGF0aW5nID0ge307XFxuJyArXG4gICAgICAndmFyIHNlbGVjdHMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0c1VwZGF0aW5nID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdE9wdGlvbnMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9uc0NvbnRleHRzID0gW107XFxuXFxuJztcbiAgfVxuXG4gIC8vIFdyYXAgbW9kZWwgaW4gYSBGcmVhayBpbnN0YW5jZSwgaWYgbmVjZXNzYXJ5XG4gIGZ1bmMgKz0gJ21vZGVsID0gdHlwZW9mIG1vZGVsID09PSBcImZ1bmN0aW9uXCIgPycgK1xuICAgICdtb2RlbCA6ICcgK1xuICAgICd0eXBlb2YgbW9kZWwgPT09IFwib2JqZWN0XCIgPycgK1xuICAgICAgJ2p0bXBsKG1vZGVsKSA6JyArXG4gICAgICAnanRtcGwoe1wiLlwiOiBtb2RlbH0pO1xcblxcbic7XG5cbiAgLy8gSXRlcmF0ZSBjaGlsZE5vZGVzXG4gIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGgsIG5vZGU7XG4gICAgICAgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcblxuICAgIHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXG4gICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgIGNhc2UgMTpcblxuICAgICAgICAvLyBqdG1wbCB0YWc/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnU0NSSVBUJyAmJiBub2RlLnR5cGUgPT09ICd0ZXh0L2p0bXBsLXRhZycpIHtcblxuICAgICAgICAgIGZvciAocmkgPSAwLCBydWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcy1ub2RlJyksIHJsZW4gPSBydWxlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlKTtcblxuICAgICAgICAgICAgLy8gUnVsZSBmb3VuZD9cbiAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgIC8vIEJsb2NrIHRhZz9cbiAgICAgICAgICAgICAgaWYgKG1hdGNoLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBGZXRjaCBibG9jayB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAoaSsrO1xuICAgICAgICAgICAgICAgICAgICAoaSA8IGxlbikgJiYgIW1hdGNoRW5kQmxvY2sobWF0Y2guYmxvY2ssIGNoaWxkTm9kZXNbaV0uaW5uZXJIVE1MIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG4gICAgICAgICAgICAgICAgICBibG9jay5hcHBlbmRDaGlsZChjaGlsZE5vZGVzW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgbWF0Y2guYmxvY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgICAnKGZyYWcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2guYmxvY2spICsgJywgJyArICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jayxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5pbm5lckhUTUwgKyAnWycgKyBpICsgJ10nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICkgKyAnKTsnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIElubGluZSB0YWdcbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgJyk7XFxuJztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFNraXAgcmVtYWluaW5nIHJ1bGVzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gZW5kIGl0ZXJhdGluZyBub2RlIHJ1bGVzXG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBDcmVhdGUgZWxlbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ25vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiJyArIG5vZGUubm9kZU5hbWUgKyAnXCIpO1xcbic7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGF0dHJpYnV0ZXNcbiAgICAgICAgICBmb3IgKHZhciBhaSA9IDAsIGF0dHJpYnV0ZXMgPSBub2RlLmF0dHJpYnV0ZXMsIGFsZW4gPSBhdHRyaWJ1dGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgIGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICBmb3IgKHJpID0gMCwgcnVsZXMgPSByZXF1aXJlKCcuL2NvbXBpbGUtcnVsZXMtYXR0cicpLCBybGVuID0gcnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUsIGF0dHJpYnV0ZXNbYWldLm5hbWUudG9Mb3dlckNhc2UoKSk7XG5cbiAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNYXRjaCBmb3VuZCwgYXBwZW5kIHJ1bGUgdG8gZnVuY1xuICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICcobm9kZSwgJyArXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShhdHRyaWJ1dGVzW2FpXS5uYW1lKSArIC8vIGF0dHJcbiAgICAgICAgICAgICAgICAgICcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgICAgICAgICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgJyk7XFxuJztcblxuICAgICAgICAgICAgICAgIC8vIFNraXAgb3RoZXIgYXR0cmlidXRlIHJ1bGVzXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgZnVuYyArPSAnbm9kZS5hcHBlbmRDaGlsZCgnICtcbiAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5ub2RlTmFtZSArICdbJyArIGkgKyAnXScpLFxuICAgICAgICAgICAgICAoZGVwdGggfHwgMCkgKyAxXG4gICAgICAgICAgICApICsgJyhtb2RlbCkpO1xcbic7XG5cbiAgICAgICAgICAvLyBBcHBlbmQgdG8gZnJhZ21lbnRcbiAgICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKG5vZGUpO1xcbic7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcblxuXG4gICAgICAvLyBUZXh0IG5vZGVcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpO1xcbic7XG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgY2FzZSA4OlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobm9kZS5kYXRhKSArICcpKTtcXG4nO1xuICAgICAgICBicmVhaztcblxuICAgIH0gLy8gZW5kIHN3aXRjaFxuICB9IC8vIGVuZCBpdGVyYXRlIGNoaWxkTm9kZXNcblxuICBmdW5jICs9ICdyZXR1cm4gZnJhZzsgfSknO1xuICBmdW5jICs9IHNvdXJjZVVSTCA/XG4gICAgJ1xcbi8vQCBzb3VyY2VVUkw9JyArIHNvdXJjZVVSTCArICdcXG4vLyMgc291cmNlVVJMPScgKyBzb3VyY2VVUkwgKyAnXFxuJyA6XG4gICAgJyc7XG5cbiAgcmV0dXJuIGZ1bmM7XG59XG5cblxuXG5cbmZ1bmN0aW9uIG1hdGNoRW5kQmxvY2soYmxvY2ssIHN0cikge1xuICB2YXIgbWF0Y2ggPSBzdHIubWF0Y2goL1xcLyhbXFx3XFwuXFwtXSspPy8pO1xuICByZXR1cm4gbWF0Y2ggP1xuICAgIGJsb2NrID09PSAnJyB8fCAhbWF0Y2hbMV0gfHwgbWF0Y2hbMV0gPT09IGJsb2NrIDpcbiAgICBmYWxzZTtcbn1cblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjb21waWxlO1xuIiwiLypcblxuIyMgQ29uc3RhbnRzXG5cbiovXG4gIG1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgUkVfSURFTlRJRklFUjogL15bXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX1NSQ19JREVOVElGSUVSOiAnKFtcXFxcd1xcXFwuXFxcXC1dKyknLFxuXG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3ViZS1xdW90ZWRcIlxuICAgIFJFX1BBUlRJQUw6IC8+KFtcXHdcXC5cXC1dKyl8JyhbXlxcJ10qKVxcJ3xcIihbXlwiXSopXCIvLFxuXG4gICAgUkVfUElQRTogL15bXFx3XFwuXFwtXSsoPzpcXHxbXFx3XFwuXFwtXSspPyQvLFxuXG4gICAgUkVfTk9ERV9JRDogL14jW1xcd1xcLlxcLV0rJC8sXG5cbiAgICBSRV9FTkRTX1dJVEhfTk9ERV9JRDogLy4rKCNbXFx3XFwuXFwtXSspJC8sXG5cbiAgICBSRV9BTllUSElORzogJ1tcXFxcc1xcXFxTXSo/JyxcblxuICAgIFJFX1NQQUNFOiAnXFxcXHMqJ1xuXG4gIH07XG4iLCIvKiFcbiAqIGNvbnRlbnRsb2FkZWQuanNcbiAqXG4gKiBBdXRob3I6IERpZWdvIFBlcmluaSAoZGllZ28ucGVyaW5pIGF0IGdtYWlsLmNvbSlcbiAqIFN1bW1hcnk6IGNyb3NzLWJyb3dzZXIgd3JhcHBlciBmb3IgRE9NQ29udGVudExvYWRlZFxuICogVXBkYXRlZDogMjAxMDEwMjBcbiAqIExpY2Vuc2U6IE1JVFxuICogVmVyc2lvbjogMS4yXG4gKlxuICogVVJMOlxuICogaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL0NvbnRlbnRMb2FkZWQvXG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9NSVQtTElDRU5TRVxuICpcbiAqL1xuXG4vLyBAd2luIHdpbmRvdyByZWZlcmVuY2Vcbi8vIEBmbiBmdW5jdGlvbiByZWZlcmVuY2Vcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29udGVudExvYWRlZCh3aW4sIGZuKSB7XG5cblx0dmFyIGRvbmUgPSBmYWxzZSwgdG9wID0gdHJ1ZSxcblxuXHRkb2MgPSB3aW4uZG9jdW1lbnQsXG5cdHJvb3QgPSBkb2MuZG9jdW1lbnRFbGVtZW50LFxuXHRtb2Rlcm4gPSBkb2MuYWRkRXZlbnRMaXN0ZW5lcixcblxuXHRhZGQgPSBtb2Rlcm4gPyAnYWRkRXZlbnRMaXN0ZW5lcicgOiAnYXR0YWNoRXZlbnQnLFxuXHRyZW0gPSBtb2Rlcm4gPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnZGV0YWNoRXZlbnQnLFxuXHRwcmUgPSBtb2Rlcm4gPyAnJyA6ICdvbicsXG5cblx0aW5pdCA9IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS50eXBlID09ICdyZWFkeXN0YXRlY2hhbmdlJyAmJiBkb2MucmVhZHlTdGF0ZSAhPSAnY29tcGxldGUnKSByZXR1cm47XG5cdFx0KGUudHlwZSA9PSAnbG9hZCcgPyB3aW4gOiBkb2MpW3JlbV0ocHJlICsgZS50eXBlLCBpbml0LCBmYWxzZSk7XG5cdFx0aWYgKCFkb25lICYmIChkb25lID0gdHJ1ZSkpIGZuLmNhbGwod2luLCBlLnR5cGUgfHwgZSk7XG5cdH0sXG5cblx0cG9sbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRyeSB7IHJvb3QuZG9TY3JvbGwoJ2xlZnQnKTsgfSBjYXRjaChlKSB7IHNldFRpbWVvdXQocG9sbCwgNTApOyByZXR1cm47IH1cblx0XHRpbml0KCdwb2xsJyk7XG5cdH07XG5cblx0aWYgKGRvYy5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpIGZuLmNhbGwod2luLCAnbGF6eScpO1xuXHRlbHNlIHtcblx0XHRpZiAoIW1vZGVybiAmJiByb290LmRvU2Nyb2xsKSB7XG5cdFx0XHR0cnkgeyB0b3AgPSAhd2luLmZyYW1lRWxlbWVudDsgfSBjYXRjaChlKSB7IH1cblx0XHRcdGlmICh0b3ApIHBvbGwoKTtcblx0XHR9XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0LCBmYWxzZSk7XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ3JlYWR5c3RhdGVjaGFuZ2UnLCBpbml0LCBmYWxzZSk7XG5cdFx0d2luW2FkZF0ocHJlICsgJ2xvYWQnLCBpbml0LCBmYWxzZSk7XG5cdH1cblxufTtcbiIsIi8qXG5cbkV2YWx1YXRlIG9iamVjdCBmcm9tIGxpdGVyYWwgb3IgQ29tbW9uSlMgbW9kdWxlXG5cbiovXG5cbiAgICAvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYywgbW9kZWwpIHtcblxuICAgICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICAgIG1vZGVsID0gbW9kZWwgfHwge307XG4gICAgICBpZiAodHlwZW9mIG1vZGVsICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG1vZGVsID0ganRtcGwobW9kZWwpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgaWYgKC8vIFBsdWdpblxuICAgICAgICAgICAgICAocHJvcC5pbmRleE9mKCdfXycpID09PSAwICYmXG4gICAgICAgICAgICAgICAgcHJvcC5sYXN0SW5kZXhPZignX18nKSA9PT0gcHJvcC5sZW5ndGggLSAyKSB8fFxuICAgICAgICAgICAgICAvLyBDb21wdXRlZCBwcm9wZXJ0eVxuICAgICAgICAgICAgICB0eXBlb2YgcHJvcGVydGllc1twcm9wXSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgaWYgKHRhcmdldC52YWx1ZXNbcHJvcF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQudmFsdWVzW3Byb3BdID0gcHJvcGVydGllc1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBUYXJnZXQgZG9lc24ndCBhbHJlYWR5IGhhdmUgcHJvcD9cbiAgICAgICAgICAgIGlmICh0YXJnZXQocHJvcCkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB0YXJnZXQocHJvcCwgcHJvcGVydGllc1twcm9wXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGFwcGx5UGx1Z2lucygpIHtcbiAgICAgICAgdmFyIHByb3AsIGFyZztcbiAgICAgICAgZm9yIChwcm9wIGluIGp0bXBsLnBsdWdpbnMpIHtcbiAgICAgICAgICBwbHVnaW4gPSBqdG1wbC5wbHVnaW5zW3Byb3BdO1xuICAgICAgICAgIGFyZyA9IG1vZGVsLnZhbHVlc1snX18nICsgcHJvcCArICdfXyddO1xuICAgICAgICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSAnZnVuY3Rpb24nICYmIGFyZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBwbHVnaW4uY2FsbChtb2RlbCwgYXJnLCB0YXJnZXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBldmFsT2JqZWN0KGJvZHksIHNyYykge1xuICAgICAgICB2YXIgcmVzdWx0LCBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH07XG4gICAgICAgIHNyYyA9IHNyYyA/XG4gICAgICAgICAgJ1xcbi8vQCBzb3VyY2VVUkw9JyArIHNyYyArXG4gICAgICAgICAgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNyYyA6XG4gICAgICAgICAgJyc7XG4gICAgICAgIGlmIChib2R5Lm1hdGNoKC9eXFxzKntbXFxTXFxzXSp9XFxzKiQvKSkge1xuICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICByZXR1cm4gZXZhbCgncmVzdWx0PScgKyBib2R5ICsgc3JjKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDb21tb25KUyBtb2R1bGVcbiAgICAgICAgZXZhbChib2R5ICsgc3JjKTtcbiAgICAgICAgcmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBsb2FkTW9kZWwoc3JjLCB0ZW1wbGF0ZSwgZG9jKSB7XG4gICAgICAgIHZhciBoYXNoSW5kZXg7XG4gICAgICAgIGlmICghc3JjKSB7XG4gICAgICAgICAgLy8gTm8gc291cmNlXG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNyYy5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBFbGVtZW50IGluIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvYy5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QoZWxlbWVudC5pbm5lckhUTUwsIHNyYykpO1xuICAgICAgICAgIGFwcGx5UGx1Z2lucygpO1xuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCBtb2RlbCB2aWEgWEhSXG4gICAgICAgICAgLy8gT2xkZXIgSUVzIGNvbXBsYWluIGlmIFVSTCBjb250YWlucyBoYXNoXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLFxuICAgICAgICAgICAgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGNvbnN0cy5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgbmV3IERPTVBhcnNlcigpXG4gICAgICAgICAgICAgICAgLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJylcbiAgICAgICAgICAgICAgICAucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG4gICAgICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLCBzcmMpKTtcbiAgICAgICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRUZW1wbGF0ZSgpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcblxuICAgICAgICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gICAgICAgIGlmIChzcmMubWF0Y2goY29uc3RzLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gVGVtcGxhdGUgaXMgdGhlIGNvbnRlbnRzIG9mIGVsZW1lbnRcbiAgICAgICAgICAvLyBiZWxvbmdpbmcgdG8gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIGxvYWRNb2RlbChlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbCcpLCBlbGVtZW50LmlubmVySFRNTCwgZG9jdW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGhhc2hJbmRleCA9IHNyYy5pbmRleE9mKCcjJyk7XG4gICAgICAgICAgLy8gR2V0IHRlbXBsYXRlIHZpYSBYSFJcbiAgICAgICAgICBqdG1wbCgnR0VUJywgaGFzaEluZGV4ID4gLTEgPyBzcmMuc3Vic3RyaW5nKDAsIGhhc2hJbmRleCkgOiBzcmMsXG4gICAgICAgICAgICBmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChjb25zdHMuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgICB2YXIgaWZyYW1lLCBkb2M7XG4gICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgICAgICAgICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgICAgICAgICBkb2MgPSBpZnJhbWUuY29udGVudERvY3VtZW50O1xuICAgICAgICAgICAgICAgIGRvYy53cml0ZWxuKHJlc3ApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2MgPSBkb2N1bWVudDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IG1hdGNoICYmIGRvYy5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcblxuICAgICAgICAgICAgICBsb2FkTW9kZWwoXG4gICAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbCcpIDogJycsXG4gICAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsXG4gICAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2FkVGVtcGxhdGUoKTtcbiAgICB9O1xuIiwiLypcblxuIyMgTWFpbiBmdW5jdGlvblxuXG4qL1xuXG4vKiBqc2hpbnQgZXZpbDogdHJ1ZSAqL1xuICAgIHZhciBjb25zdHMgPSByZXF1aXJlKCcuL2NvbnN0cycpO1xuXG4gICAgZnVuY3Rpb24ganRtcGwoKSB7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIHZhciB0YXJnZXQsIHQsIHRlbXBsYXRlLCBtb2RlbDtcblxuICAgICAgLy8ganRtcGwoJ0hUVFBfTUVUSE9EJywgdXJsWywgcGFyYW1ldGVyc1ssIGNhbGxiYWNrWywgb3B0aW9uc11dXSk/XG4gICAgICBpZiAoWydHRVQnLCAnUE9TVCddLmluZGV4T2YoYXJnc1swXSkgPiAtMSkge1xuICAgICAgICByZXR1cm4gcmVxdWlyZSgnLi94aHInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwob2JqZWN0KT9cbiAgICAgIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyByZXR1cm4gRnJlYWsgaW5zdGFuY2VcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUoJ2ZyZWFrJykoYXJnc1swXSk7XG4gICAgICB9XG5cbiAgICAgIC8vIGp0bXBsKHRhcmdldCk/XG4gICAgICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gcmV0dXJuIG1vZGVsXG4gICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMF0pLl9fanRtcGxfXztcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gICAgICBlbHNlIGlmIChcbiAgICAgICAgKCBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgfHxcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgKCAoYXJnc1sxXSAmJiB0eXBlb2YgYXJnc1sxXS5hcHBlbmRDaGlsZCA9PT0gJ2Z1bmN0aW9uJykgfHxcbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKVxuICAgICAgICApICYmXG5cbiAgICAgICAgYXJnc1syXSAhPT0gdW5kZWZpbmVkXG5cbiAgICAgICkge1xuXG4gICAgICAgIHRhcmdldCA9IGFyZ3NbMF0gJiYgYXJnc1swXS5ub2RlVHlwZSAgP1xuICAgICAgICAgIGFyZ3NbMF0gOlxuICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICAgICAgdGVtcGxhdGUgPSBhcmdzWzFdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgICAgIGFyZ3NbMV07XG5cbiAgICAgICAgbW9kZWwgPVxuICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICAgIC8vIGFscmVhZHkgd3JhcHBlZFxuICAgICAgICAgICAgYXJnc1syXSA6XG4gICAgICAgICAgICAvLyBvdGhlcndpc2Ugd3JhcFxuICAgICAgICAgICAganRtcGwoXG4gICAgICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAgICAgLy8gb2JqZWN0XG4gICAgICAgICAgICAgICAgYXJnc1syXSA6XG5cbiAgICAgICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycgJiYgYXJnc1syXS5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgICAgICAgICAgLy8gc3JjLCBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICByZXF1aXJlKCcuL2xvYWRlcicpXG4gICAgICAgICAgICAgICAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMl0pLmlubmVySFRNTCkgOlxuXG4gICAgICAgICAgICAgICAgICAvLyBzaW1wbGUgdmFsdWUsIGJveCBpdFxuICAgICAgICAgICAgICAgICAgeycuJzogYXJnc1syXX1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgaWYgKHRhcmdldC5ub2RlTmFtZSA9PT0gJ1NDUklQVCcpIHtcbiAgICAgICAgICB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgdC5pZCA9IHRhcmdldC5pZDtcbiAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQodCwgdGFyZ2V0KTtcbiAgICAgICAgICB0YXJnZXQgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXNzb2NpYXRlIHRhcmdldCBhbmQgbW9kZWxcbiAgICAgICAgdGFyZ2V0Ll9fanRtcGxfXyA9IG1vZGVsO1xuXG4gICAgICAgIC8vIEVtcHR5IHRhcmdldFxuICAgICAgICB0YXJnZXQuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgLy8gQXNzaWduIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAgICAgIC8vdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKFxuICAgICAgICAgIGV2YWwoXG4gICAgICAgICAgICBqdG1wbC5jb21waWxlKFxuICAgICAgICAgICAgICBqdG1wbC5wYXJzZSh0ZW1wbGF0ZSksXG4gICAgICAgICAgICAgIHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtanRtcGwnKVxuICAgICAgICAgICAgKSArICcobW9kZWwpJ1xuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cblxuXG4vKlxuXG5PbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcblxuKi9cblxuICAgIHJlcXVpcmUoJy4vY29udGVudC1sb2FkZWQnKSh3aW5kb3csIGZ1bmN0aW9uKCkge1xuXG4gICAgICB2YXIgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbiAgICAgIHZhciB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtanRtcGxdJyk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0YXJnZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGxvYWRlcih0YXJnZXRzW2ldLCB0YXJnZXRzW2ldLmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuXG5cbi8qXG5cbkV4cG9zZSBuZXctZ2VuZXJhdGlvbiBjb21waWxlciBmb3IgZXhwZXJpbWVudGluZ1xuXG4qL1xuXG4gICAganRtcGwucGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG4gICAganRtcGwuY29tcGlsZSA9IHJlcXVpcmUoJy4vY29tcGlsZScpO1xuICAgIGp0bXBsLmdldCA9IGZ1bmN0aW9uKG1vZGVsLCBwcm9wKSB7XG4gICAgICB2YXIgdmFsID0gbW9kZWwocHJvcCk7XG4gICAgICByZXR1cm4gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpID9cbiAgICAgICAgSlNPTi5zdHJpbmdpZnkodmFsLnZhbHVlcykgOlxuICAgICAgICB2YWw7XG4gICAgfTtcblxuXG4vKlxuXG5QbHVnaW5zXG5cbiovXG5cbiAgICBqdG1wbC5wbHVnaW5zID0ge1xuICAgICAgaW5pdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICAgIC8vIENhbGwgYXN5bmMsIGFmdGVyIGp0bXBsIGhhcyBjb25zdHJ1Y3RlZCB0aGUgRE9NXG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFyZy5jYWxsKHRoYXQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuXG4vKlxuXG5FeHBvcnRcblxuKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGp0bXBsO1xuIiwiLyoqXG4gKiBQYXJzZSBhIHRleHQgdGVtcGxhdGUgdG8gRE9NIHN0cnVjdHVyZSByZWFkeSBmb3IgY29tcGlsaW5nXG4gKiBAc2VlIGNvbXBpbGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqXG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuZnVuY3Rpb24gcGFyc2UodGVtcGxhdGUpIHtcblxuICB2YXIgaWZyYW1lLCBib2R5O1xuXG4gIGZ1bmN0aW9uIHByZXByb2Nlc3ModGVtcGxhdGUpIHtcblxuICAgIC8vIHJlcGxhY2Uge3t7dGFnfX19IHdpdGgge3smdGFnfX1cbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoL1xce1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfVxcfS9nLCAne3smJDF9fScpO1xuXG4gICAgLy8gMS4gd3JhcCBlYWNoIG5vbi1hdHRyaWJ1dGUgdGFnIGluIDxzY3JpcHQgdHlwZT1cInRleHQvanRtcGwtdGFnXCI+XG4gICAgLy8gMi4gcmVtb3ZlIE11c3RhY2hlIGNvbW1lbnRzXG4gICAgLy8gVE9ETzogaGFuZGxlIHRhZ3MgaW4gSFRNTCBjb21tZW50c1xuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC9cXHtcXHsoW1xcU1xcc10qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBtYXRjaDEsIHBvcykge1xuICAgICAgICB2YXIgaGVhZCA9IHRlbXBsYXRlLnNsaWNlKDAsIHBvcyk7XG4gICAgICAgIHZhciBpbnNpZGVUYWcgPSAhIWhlYWQubWF0Y2goLzxbXFx3XFwtXStbXj5dKj8kLyk7XG4gICAgICAgIHZhciBvcGVuaW5nID0gaGVhZC5tYXRjaCgvPChzY3JpcHR8U0NSSVBUKS9nKTtcbiAgICAgICAgdmFyIGNsb3NpbmcgPSBoZWFkLm1hdGNoKC88XFwvKHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgaW5zaWRlU2NyaXB0ID1cbiAgICAgICAgICAgIChvcGVuaW5nICYmIG9wZW5pbmcubGVuZ3RoIHx8IDApID4gKGNsb3NpbmcgJiYgY2xvc2luZy5sZW5ndGggfHwgMCk7XG4gICAgICAgIHZhciBpbnNpZGVDb21tZW50ID0gISFoZWFkLm1hdGNoKC88IS0tXFxzKiQvKTtcbiAgICAgICAgdmFyIGlzTXVzdGFjaGVDb21tZW50ID0gbWF0Y2gxLmluZGV4T2YoJyEnKSA9PT0gMDtcblxuICAgICAgICByZXR1cm4gaW5zaWRlVGFnIHx8IGluc2lkZUNvbW1lbnQgP1xuICAgICAgICAgIGlzTXVzdGFjaGVDb21tZW50ID9cbiAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICBpbnNpZGVTY3JpcHQgP1xuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgICAgJzxzY3JpcHQgdHlwZT1cInRleHQvanRtcGwtdGFnXCI+JyArIG1hdGNoMS50cmltKCkgKyAnXFx4M0Mvc2NyaXB0Pic7XG4gICAgICB9XG4gICAgKTtcbiAgICAvLyBwcmVmaXggJ3NlbGVjdGVkJyBhbmQgJ2NoZWNrZWQnIGF0dHJpYnV0ZXMgd2l0aCAnanRtcGwtJ1xuICAgIC8vICh0byBhdm9pZCBcInNwZWNpYWxcIiBwcm9jZXNzaW5nLCBvaCBJRTgpXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgLyg8KD86b3B0aW9ufE9QVElPTilbXj5dKj8pKD86c2VsZWN0ZWR8U0VMRUNURUQpPS9nLFxuICAgICAgJyQxanRtcGwtc2VsZWN0ZWQ9Jyk7XG5cbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzppbnB1dHxJTlBVVClbXj5dKj8pKD86Y2hlY2tlZHxDSEVDS0VEKT0vZyxcbiAgICAgICckMWp0bXBsLWNoZWNrZWQ9Jyk7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICB0ZW1wbGF0ZSA9IHByZXByb2Nlc3ModGVtcGxhdGUpO1xuICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgaWZyYW1lLmNvbnRlbnREb2N1bWVudC53cml0ZWxuKCc8IWRvY3R5cGUgaHRtbD5cXG48aHRtbD48Ym9keT4nICsgdGVtcGxhdGUgKyAnPC9ib2R5PjwvaHRtbD4nKTtcbiAgYm9keSA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQuYm9keTtcbiAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuXG4gIHJldHVybiBib2R5O1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkge1xuICAgICAgICAgICAgb25sb2FkLmNhbGwodGhpcywgJ2RvbmUnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnanRtcGwgWEhSIGVycm9yOiAnICsgdGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSxcbiAgICAgICAgb3B0cy51c2VyLCBvcHRzLnBhc3N3b3JkKTtcblxuICAgICAgeGhyLnNlbmQocmVxdWVzdCk7XG5cbiAgICAgIHJldHVybiB4aHI7XG5cbiAgICB9O1xuIl19
(8)
});
