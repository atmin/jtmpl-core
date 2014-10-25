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
            var val = jtmpl._get(model, prop);
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
   * attribute="{{var}}"
   */
  function(node, attr) {
    var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
    if (match) {

      return {

        prop: match[1],

        rule: function(node, attr, model, prop) {

          function change() {
            var val = jtmpl._get(model, prop);
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




  /**
   * Fallback rule, process via @see utemplate
   * Strip jtmpl- prefix
   */
  function(node, attr) {
    return {
      prop: node.getAttribute(attr),
      rule: function(node, attr, model, prop) {
        var attrName = attr.replace('jtmpl-', '');
        function change() {
          node.setAttribute(
            attrName,
            jtmpl.utemplate(prop, model, change)
          );
        }
        change();
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
          var textNode = document.createTextNode(jtmpl._get(model, prop) || '');
          fragment.appendChild(textNode);
          model.on('change', prop, function() {
            textNode.data = jtmpl._get(model, prop) || '';
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
    var match = node.innerHTML.match(/>([\w\.\-]+)|'([^\']*)\'|"([^"]*)"/);

    if (match) {
      return {

        prop: match,

        rule: function(fragment, model, match) {

          var anchor = document.createComment('');
          var target;

          function loader() {
            if (!target) {
              target = anchor.parentNode;
            }
            jtmpl.loader(
              target,
              match[1] ?
                // Variable
                model(match[1]) :
                // Literal
                match[2] || match[3],
              model
            );
          }
          if (match[1]) {
            // Variable
            model.on('change', match[1], loader);
          }
          fragment.appendChild(anchor);
          // Load async
          setTimeout(loader);
        }
      };
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
              var arr = prop === '.' ? model : model(prop);

              while (size--) {
                parent.removeChild(parent.childNodes[pos]);
              }
              parent.insertBefore(
                eval(template + '(arr(i))'),
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
            var arr = prop === '.' ? model : model(prop);

            for (i = 0, fragment = document.createDocumentFragment();
                i < count; i++) {
              fragment.appendChild(eval(template + '(arr(index + i))'));
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

          if (node.nodeName !== 'INPUT') {
            // Recursively compile
            func += 'node.appendChild(' +
              compile(
                node,
            sourceURL && (sourceURL + '-' + node.nodeName + '[' + i + ']'),
            (depth || 0) + 1
            ) + '(model));\n';
          }

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

Evaluate object from literal or CommonJS module

*/

    /* jshint evil:true */
    module.exports = function(target, src, model) {

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
        else if (src.match(jtmpl.RE_NODE_ID)) {
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
              var match = src.match(jtmpl.RE_ENDS_WITH_NODE_ID);
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

        if (src.match(jtmpl.RE_NODE_ID)) {
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
              var match = src.match(jtmpl.RE_ENDS_WITH_NODE_ID);
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

},{}],6:[function(_dereq_,module,exports){
/*
 * Main function
 */
/* jshint evil: true */
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

    template = args[1].match(jtmpl.RE_NODE_ID) ?
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

            typeof args[2] === 'string' && args[2].match(jtmpl.RE_NODE_ID) ?
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
 * On page ready, process jtmpl targets
 */

window.addEventListener('DOMContentLoaded', function() {
  var loader = _dereq_('./loader');
  var targets = document.querySelectorAll('[data-jtmpl]');

  for (var i = 0, len = targets.length; i < len; i++) {
    loader(targets[i], targets[i].getAttribute('data-jtmpl'));
  }
});


/*
 * Export stuff
 */
jtmpl.RE_NODE_ID = /^#[\w\.\-]+$/;
jtmpl.RE_ENDS_WITH_NODE_ID = /.+(#[\w\.\-]+)$/;

jtmpl.parse = _dereq_('./parse');
jtmpl.compile = _dereq_('./compile');
jtmpl.loader = _dereq_('./loader');
jtmpl.utemplate = _dereq_('./utemplate');
jtmpl._get = function(model, prop) {
  var val = model(prop);
  return (typeof val === 'function') ?
    JSON.stringify(val.values) :
    val;
};


/*
 * Plugins
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
 * Export
 */
module.exports = jtmpl;

},{"./compile":4,"./loader":5,"./parse":7,"./utemplate":8,"./xhr":9,"freak":1}],7:[function(_dereq_,module,exports){
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

},{}],8:[function(_dereq_,module,exports){
/**
 * utemplate
 *
 * @param {string} template
 * @param {function} model - data as Freak instance
 * @param {optional function} onChange - will be called whenever used model property changes
 *
 * @returns {string} - rendered template using model
 *
 * Basic template rendering.
 * Supported tags: {{variable}}, {{#section}}, {{^inverted_section}}
 * (short closing tags {{/}} supported)
 *
 * Does NOT support nested sections, so simple parsing via regex is possible.
 */
function utemplate(template, model, onChange) {
  return template
    // {{#section}} sectionBody {{/}}
    .replace(
      /\{\{#([\w\.\-]+)\}\}(.+?)\{\{\/([\w\.\-]*?)\}\}/g,
      function(match, openTag, body, closeTag, pos) {
        if (closeTag !== '' && closeTag !== openTag) {
          throw 'jtmpl: Unclosed ' + openTag;
        }
        if (typeof onChange === 'function') {
          model.on('change', openTag, onChange);
        }
        var val = openTag === '.' ? model : model(openTag);
        return (typeof val === 'function' && val.len !== undefined) ?
            // Array
            (val.len > 0) ?
              // Non-empty
              val.values
                .map(function(el, i) {
                  return utemplate(body.replace(/\{\{\.\}\}/g, '{{' + i + '}}'), val, onChange);
                })
                .join('') :
              // Empty
              '' :
            // Object or boolean?
            (typeof val === 'function' && val.len === undefined) ?
              // Object
              utemplate(body, val, onChange) :
              // Cast to boolean
              (!!val) ?
                utemplate(body, model, onChange) :
                '';
      }
    )
    // {{^inverted_section}} sectionBody {{/}}
    .replace(
      /\{\{\^([\w\.\-]+)\}\}(.+?)\{\{\/([\w\.\-]*?)\}\}/g,
      function(match, openTag, body, closeTag, pos) {
        if (closeTag !== '' && closeTag !== openTag) {
          throw 'jtmpl: Unclosed ' + openTag;
        }
        if (typeof onChange === 'function') {
          model.on('change', openTag, onChange);
        }
        var val = openTag === '.' ? model : model(openTag);
        return (typeof val === 'function' && val.len !== undefined) ?
            // Array
            (val.len === 0) ?
              // Empty
              utemplate(body, model, onChange) :
              // Non-empty
              '' :
            // Cast to boolean
            (!val) ?
              utemplate(body, model, onChange) :
              '';
      }
    )
    // {{variable}}
    .replace(
      /\{\{([\w\.\-]+)\}\}/g,
      function(match, variable, pos) {
        if (typeof onChange === 'function') {
          model.on('change', variable, onChange);
        }
        return model(variable) === undefined ? '' : model(variable) + '';
      }
    );
}



module.exports = utemplate;

},{}],9:[function(_dereq_,module,exports){
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

},{}]},{},[6])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1hdHRyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1ub2RlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2xvYWRlci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL21haW4uanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9wYXJzZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3V0ZW1wbGF0ZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ3VwZGF0ZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIF9kZXBlbmRlbnRQcm9wcyA9IHt9O1xuICB2YXIgX2RlcGVuZGVudENvbnRleHRzID0ge307XG4gIHZhciBjYWNoZSA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICAvLyBBc3NlcnQgY29uZGl0aW9uXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVlcEVxdWFsKHgsIHkpIHtcbiAgICBpZiAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgeSA9PT0gXCJvYmplY3RcIiAmJiB5ICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyh4KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKHkpLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIHByb3AgaW4geCkge1xuICAgICAgICBpZiAoeC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmICh5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh4W3Byb3BdLCB5W3Byb3BdKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoeCAhPT0geSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/XG4gICAgICBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAndXBkYXRlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgIT09IG51bGwpIHx8XG4gICAgICAoWydpbnNlcnQnLCAnZGVsZXRlJywgJ3VwZGF0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCA9PT0gbnVsbClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIG9yIHNwZWNpZmllZCBsaXN0ZW5lcnMgZ2l2ZW4gZXZlbnQgYW5kIHByb3BlcnR5XG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIHZhciBoYW5kbGVycyA9IChsaXN0ZW5lcnNbZXZlbnRdW1snY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSA/IGEgOiBudWxsXSB8fCBbXSk7XG4gICAgdmFyIGksIGxlbiA9IGhhbmRsZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGhhbmRsZXJzW2ldLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgIH07XG4gIH1cblxuICAvLyBFeHBvcnQgbW9kZWwgdG8gSlNPTiBzdHJpbmdcbiAgLy8gTk9UIGV4cG9ydGVkOlxuICAvLyAtIHByb3BlcnRpZXMgc3RhcnRpbmcgd2l0aCBfIChQeXRob24gcHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbnZlbnRpb24pXG4gIC8vIC0gY29tcHV0ZWQgcHJvcGVydGllcyAoZGVyaXZlZCBmcm9tIG5vcm1hbCBwcm9wZXJ0aWVzKVxuICBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgZnVuY3Rpb24gZmlsdGVyKG9iaikge1xuICAgICAgdmFyIGtleSwgZmlsdGVyZWQgPSBBcnJheS5pc0FycmF5KG9iaikgPyBbXSA6IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZpbHRlcihvYmpba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9ialtrZXldICE9PSAnZnVuY3Rpb24nICYmIGtleVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmaWx0ZXIob2JqKSk7XG4gIH1cblxuICAvLyBMb2FkIG1vZGVsIGZyb20gSlNPTiBzdHJpbmcgb3Igb2JqZWN0XG4gIGZ1bmN0aW9uIGZyb21KU09OKGRhdGEpIHtcbiAgICB2YXIga2V5O1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH1cbiAgICBmb3IgKGtleSBpbiBkYXRhKSB7XG4gICAgICBpbnN0YW5jZShrZXksIGRhdGFba2V5XSk7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBrZXkpO1xuICAgIH1cbiAgICBpbnN0YW5jZS5sZW4gPSBvYmoubGVuZ3RoO1xuICB9XG5cbiAgLy8gVXBkYXRlIGhhbmRsZXI6IHJlY2FsY3VsYXRlIGRlcGVuZGVudCBwcm9wZXJ0aWVzLFxuICAvLyB0cmlnZ2VyIGNoYW5nZSBpZiBuZWNlc3NhcnlcbiAgZnVuY3Rpb24gdXBkYXRlKHByb3ApIHtcbiAgICBpZiAoIWRlZXBFcXVhbChjYWNoZVtwcm9wXSwgZ2V0KHByb3AsIGZ1bmN0aW9uKCkge30sIHRydWUpKSkge1xuICAgICAgdHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGRlcGVuZGVudHNcbiAgICBmb3IgKHZhciBpID0gMCwgZGVwID0gX2RlcGVuZGVudFByb3BzW3Byb3BdIHx8IFtdLCBsZW4gPSBkZXAubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlbGV0ZSBjaGlsZHJlbltkZXBbaV1dO1xuICAgICAgX2RlcGVuZGVudENvbnRleHRzW3Byb3BdW2ldLnRyaWdnZXIoJ3VwZGF0ZScsIGRlcFtpXSk7XG4gICAgfVxuXG4gICAgaWYgKGluc3RhbmNlLnBhcmVudCkge1xuICAgICAgLy8gTm90aWZ5IGNvbXB1dGVkIHByb3BlcnRpZXMsIGRlcGVuZGluZyBvbiBwYXJlbnQgb2JqZWN0XG4gICAgICBpbnN0YW5jZS5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgaW5zdGFuY2UucHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJveHkgdGhlIGFjY2Vzc29yIGZ1bmN0aW9uIHRvIHJlY29yZFxuICAvLyBhbGwgYWNjZXNzZWQgcHJvcGVydGllc1xuICBmdW5jdGlvbiBnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSB7XG4gICAgZnVuY3Rpb24gdHJhY2tlcihjb250ZXh0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oX3Byb3AsIF9hcmcpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0pIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0gPSBbXTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXh0KF9wcm9wLCBfYXJnLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRyYWNrZXIoaW5zdGFuY2UpO1xuICAgIGNvbnN0cnVjdChyZXN1bHQpO1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgIHJlc3VsdC5wYXJlbnQgPSB0cmFja2VyKHBhcmVudCk7XG4gICAgfVxuICAgIHJlc3VsdC5yb290ID0gdHJhY2tlcihyb290IHx8IGluc3RhbmNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2hhbGxvdyBjbG9uZSBhbiBvYmplY3RcbiAgZnVuY3Rpb24gc2hhbGxvd0Nsb25lKG9iaikge1xuICAgIHZhciBrZXksIGNsb25lO1xuICAgIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNsb25lID0ge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgY2xvbmVba2V5XSA9IG9ialtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNsb25lID0gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICAvLyBHZXR0ZXIgZm9yIHByb3AsIGlmIGNhbGxiYWNrIGlzIGdpdmVuXG4gIC8vIGNhbiByZXR1cm4gYXN5bmMgdmFsdWVcbiAgZnVuY3Rpb24gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciB2YWwgPSBvYmpbcHJvcF07XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhbCA9IHZhbC5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCBjYWxsYmFjayk7XG4gICAgICBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICAgIGNhY2hlW3Byb3BdID0gKHZhbCA9PT0gdW5kZWZpbmVkKSA/IHZhbCA6IHNoYWxsb3dDbG9uZSh2YWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgIGNhY2hlW3Byb3BdID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciByZXN1bHQgPSBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKTtcblxuICAgIHJldHVybiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcgP1xuICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgIGNoaWxkcmVuW3Byb3BdID9cbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gOlxuICAgICAgICBjaGlsZHJlbltwcm9wXSA9IGZyZWFrKHJlc3VsdCwgcm9vdCB8fCBpbnN0YW5jZSwgaW5zdGFuY2UsIHByb3ApIDpcbiAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgcmVzdWx0O1xuICB9XG5cbiAgLy8gU2V0IHByb3AgdG8gdmFsXG4gIGZ1bmN0aW9uIHNldHRlcihwcm9wLCB2YWwpIHtcbiAgICB2YXIgb2xkVmFsID0gZ2V0KHByb3ApO1xuXG4gICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5IHNldHRlclxuICAgICAgb2JqW3Byb3BdLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIHZhbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gU2ltcGxlIHByb3BlcnR5XG4gICAgICBvYmpbcHJvcF0gPSB2YWw7XG4gICAgICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGRlbGV0ZSBjYWNoZVtwcm9wXTtcbiAgICAgICAgZGVsZXRlIGNoaWxkcmVuW3Byb3BdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvbGRWYWwgIT09IHZhbCkge1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywgcHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRnVuY3Rpb25hbCBhY2Nlc3NvciwgdW5pZnkgZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgZnVuY3Rpb24gYWNjZXNzb3IocHJvcCwgYXJnLCBza2lwQ2FjaGluZykge1xuICAgIHJldHVybiAoXG4gICAgICAoYXJnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICBnZXR0ZXIgOiBzZXR0ZXJcbiAgICApKHByb3AsIGFyZywgc2tpcENhY2hpbmcpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgZnVuY3Rpb24gY29uc3RydWN0KHRhcmdldCkge1xuICAgIG1peGluKHRhcmdldCwge1xuICAgICAgdmFsdWVzOiBvYmosXG4gICAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgICAgcm9vdDogcm9vdCB8fCB0YXJnZXQsXG4gICAgICBwcm9wOiBwcm9wID09PSB1bmRlZmluZWQgPyBudWxsIDogcHJvcCxcbiAgICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICAgIG9uOiBvbixcbiAgICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgLy8gLnRyaWdnZXIoZXZlbnRbLCBwcm9wXSlcbiAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICB0b0pTT046IHRvSlNPTixcbiAgICAgIC8vIERlcHJlY2F0ZWQuIEl0IGhhcyBhbHdheXMgYmVlbiBicm9rZW4sIGFueXdheVxuICAgICAgLy8gV2lsbCB0aGluayBob3cgdG8gaW1wbGVtZW50IHByb3Blcmx5XG4gICAgICBmcm9tSlNPTjogZnJvbUpTT04sXG4gICAgICAvLyBJbnRlcm5hbDogZGVwZW5kZW5jeSB0cmFja2luZ1xuICAgICAgX2RlcGVuZGVudFByb3BzOiBfZGVwZW5kZW50UHJvcHMsXG4gICAgICBfZGVwZW5kZW50Q29udGV4dHM6IF9kZXBlbmRlbnRDb250ZXh0c1xuICAgIH0pO1xuXG4gICAgLy8gV3JhcCBtdXRhdGluZyBhcnJheSBtZXRob2QgdG8gdXBkYXRlXG4gICAgLy8gc3RhdGUgYW5kIG5vdGlmeSBsaXN0ZW5lcnNcbiAgICBmdW5jdGlvbiB3cmFwQXJyYXlNZXRob2QobWV0aG9kLCBmdW5jKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXVttZXRob2RdLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICAgIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdGFyZ2V0LnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCB0YXJnZXQucHJvcCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgIG1peGluKHRhcmdldCwge1xuICAgICAgICAvLyBGdW5jdGlvbiBwcm90b3R5cGUgYWxyZWFkeSBjb250YWlucyBsZW5ndGhcbiAgICAgICAgLy8gYGxlbmAgc3BlY2lmaWVzIGFycmF5IGxlbmd0aFxuICAgICAgICBsZW46IG9iai5sZW5ndGgsXG5cbiAgICAgICAgcG9wOiB3cmFwQXJyYXlNZXRob2QoJ3BvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIHRoaXMubGVuLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcHVzaDogd3JhcEFycmF5TWV0aG9kKCdwdXNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgdGhpcy5sZW4gLSAxLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcmV2ZXJzZTogd3JhcEFycmF5TWV0aG9kKCdyZXZlcnNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgnc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgdW5zaGlmdDogd3JhcEFycmF5TWV0aG9kKCd1bnNoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNvcnQ6IHdyYXBBcnJheU1ldGhvZCgnc29ydCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNwbGljZTogd3JhcEFycmF5TWV0aG9kKCdzcGxpY2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHMubGVuZ3RoIC0gMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICAvLyBDcmVhdGUgZnJlYWsgaW5zdGFuY2VcbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgY29uc3RydWN0KGluc3RhbmNlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwidmFyIFJFX0RFTElNSVRFRF9WQVIgPSAvXlxce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9JC87XG5cblxuLypcbiAqIEF0dHJpYnV0ZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoqXG4gICAqIHZhbHVlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICd2YWx1ZScgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGp0bXBsLl9nZXQobW9kZWwsIHByb3ApO1xuICAgICAgICAgICAgaWYgKG5vZGVbYXR0cl0gIT09IHZhbCkge1xuICAgICAgICAgICAgICBub2RlW2F0dHJdID0gdmFsIHx8ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHRleHQgaW5wdXQ/XG4gICAgICAgICAgdmFyIGV2ZW50VHlwZSA9IFsndGV4dCcsICdwYXNzd29yZCddLmluZGV4T2Yobm9kZS50eXBlKSA+IC0xID9cbiAgICAgICAgICAgICdrZXl1cCcgOiAnY2hhbmdlJzsgLy8gSUU5IGluY29yZWN0bHkgcmVwb3J0cyBpdCBzdXBwb3J0cyBpbnB1dCBldmVudFxuXG4gICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBzZWxlY3RlZD1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChhdHRyID09PSAnanRtcGwtc2VsZWN0ZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoc2VsZWN0c1VwZGF0aW5nW2ldKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwLCBsZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXVtqXS5zZWxlY3RlZCA9IHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtqXShwcm9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGUuc2VsZWN0ZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ09QVElPTicpIHtcblxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgPHNlbGVjdD4gdG8gbGlzdFxuICAgICAgICAgICAgICAgIGkgPSBzZWxlY3RzLnB1c2gobm9kZS5wYXJlbnROb2RlKSAtIDE7XG4gICAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zXG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9ucy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICAvLyBJbml0IG9wdGlvbnMgY29udGV4dHNcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoIGNoYW5nZSBsaXN0ZW5lclxuICAgICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGVjdHNVcGRhdGluZ1tpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBvaSA9IDAsIG9sZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgb2kgPCBvbGVuOyBvaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtvaV0ocHJvcCwgc2VsZWN0T3B0aW9uc1tpXVtvaV0uc2VsZWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc2VsZWN0c1VwZGF0aW5nW2ldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gUmVtZW1iZXIgb3B0aW9uIGFuZCBjb250ZXh0XG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBtb2RlbChwcm9wLCB0aGlzLnNlbGVjdGVkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGNoZWNrZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2p0bXBsLWNoZWNrZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF1baV0uY2hlY2tlZCA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgaWYgKCFyYWRpb0dyb3Vwc1tub2RlLm5hbWVdKSB7XG4gICAgICAgICAgICAgIC8vIEluaXQgcmFkaW8gZ3JvdXAgKFswXTogbm9kZSwgWzFdOiBtb2RlbClcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQWRkIGlucHV0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAvLyBBZGQgY29udGV4dCB0byByYWRpbyBncm91cFxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgYWxsIGlucHV0cyBmcm9tIHRoZSBncm91cFxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCwgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuY2hlY2tlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KGNoYW5nZSk7XG4gICAgICAgIH1cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGF0dHJpYnV0ZT1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0ganRtcGwuX2dldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKSA6XG4gICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogRmFsbGJhY2sgcnVsZSwgcHJvY2VzcyB2aWEgQHNlZSB1dGVtcGxhdGVcbiAgICogU3RyaXAganRtcGwtIHByZWZpeFxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHJldHVybiB7XG4gICAgICBwcm9wOiBub2RlLmdldEF0dHJpYnV0ZShhdHRyKSxcbiAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG4gICAgICAgIHZhciBhdHRyTmFtZSA9IGF0dHIucmVwbGFjZSgnanRtcGwtJywgJycpO1xuICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICBhdHRyTmFtZSxcbiAgICAgICAgICAgIGp0bXBsLnV0ZW1wbGF0ZShwcm9wLCBtb2RlbCwgY2hhbmdlKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY2hhbmdlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG5dO1xuIiwiLypcbiAqIE5vZGUgcnVsZXNcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gW1xuXG4gIC8qIGpzaGludCBldmlsOiB0cnVlICovXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7dmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goL15bXFx3XFwuXFwtXSskLykpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBub2RlLmlubmVySFRNTCxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShqdG1wbC5fZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJyk7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGV4dE5vZGUpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRleHROb2RlLmRhdGEgPSBqdG1wbC5fZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7JnZhcn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14mKFtcXHdcXC5cXC1dKykkLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnLmFwcGVuZENoaWxkKGVsLmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGZyYWcsIGFuY2hvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3s+cGFydGlhbH19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3VibGUtcXVvdGVkXCJcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvPihbXFx3XFwuXFwtXSspfCcoW15cXCddKilcXCd8XCIoW15cIl0qKVwiLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2gsXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBtYXRjaCkge1xuXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIHZhciB0YXJnZXQ7XG5cbiAgICAgICAgICBmdW5jdGlvbiBsb2FkZXIoKSB7XG4gICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgICB0YXJnZXQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGp0bXBsLmxvYWRlcihcbiAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICBtYXRjaFsxXSA/XG4gICAgICAgICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICAgICAgICBtb2RlbChtYXRjaFsxXSkgOlxuICAgICAgICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICAgICAgICBtYXRjaFsyXSB8fCBtYXRjaFszXSxcbiAgICAgICAgICAgICAgbW9kZWxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChtYXRjaFsxXSkge1xuICAgICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBtYXRjaFsxXSwgbG9hZGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAvLyBMb2FkIGFzeW5jXG4gICAgICAgICAgc2V0VGltZW91dChsb2FkZXIpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3sjc2VjdGlvbn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14jKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcbiAgICAgICAgICAvLyBIb3cgbWFueSBjaGlsZE5vZGVzIGluIG9uZSBzZWN0aW9uIGl0ZW1cbiAgICAgICAgICB2YXIgY2h1bmtTaXplO1xuXG4gICAgICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGkgKiBjaHVua1NpemU7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gY2h1bmtTaXplO1xuICAgICAgICAgICAgICB2YXIgYXJyID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcblxuICAgICAgICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoXG4gICAgICAgICAgICAgICAgZXZhbCh0ZW1wbGF0ZSArICcoYXJyKGkpKScpLFxuICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gaW5zZXJ0KGluZGV4LCBjb3VudCkge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiBjaHVua1NpemU7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIGksIGZyYWdtZW50O1xuICAgICAgICAgICAgdmFyIGFyciA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKGFycihpbmRleCArIGkpKScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShmcmFnbWVudCwgcGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGRlbChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcblxuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBpbnNlcnQpO1xuICAgICAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdyZW5kZXJpbmcgJyArIHZhbC5sZW4gKyAnIHZhbHVlcycpO1xuICAgICAgICAgICAgICB2YXIgZnVuYyA9IGV2YWwodGVtcGxhdGUpO1xuICAgICAgICAgICAgICB2YXIgY2hpbGQsIGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC52YWx1ZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgZXZlbnQgZGVsZWdhdGlvbiBmb3IgYXJyYXkgaW5kZXhlc1xuICAgICAgICAgICAgICAgIC8vIEFsc28sIHVzaW5nIHZhbC52YWx1ZXNbaV0gaW5zdGVhZCBvZiB2YWxbaV1cbiAgICAgICAgICAgICAgICAvLyBzYXZlcyBBIExPVCBvZiBoZWFwIG1lbW9yeS4gRmlndXJlIG91dCBob3cgdG8gZG9cbiAgICAgICAgICAgICAgICAvLyBvbiBkZW1hbmQgbW9kZWwgY3JlYXRpb24uXG4gICAgICAgICAgICAgICAgdmFsLm9uKCdjaGFuZ2UnLCBpLCB1cGRhdGUoaSkpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKHZhbChpKSknKSk7XG4gICAgICAgICAgICAgICAgLy9yZW5kZXIuYXBwZW5kQ2hpbGQoZnVuYyh2YWwudmFsdWVzW2ldKSk7XG4gICAgICAgICAgICAgICAgY2hpbGRNb2RlbCA9IHZhbChpKTtcbiAgICAgICAgICAgICAgICBjaGlsZCA9IGZ1bmMoY2hpbGRNb2RlbCk7XG4gICAgICAgICAgICAgICAgY2hpbGQuX19qdG1wbF9fID0gY2hpbGRNb2RlbDtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICBjaHVua1NpemUgPSB+fihsZW5ndGggLyBsZW4pO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPYmplY3Q/XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyh2YWwpJyk7XG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgY2h1bmtTaXplID0gbGVuZ3RoO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5fX2p0bXBsX18gPSBtb2RlbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKCEhdmFsKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwpJyk7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGNodW5rU2l6ZSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cblxuICAvKipcbiAgICoge3teaW52ZXJ0ZWRfc2VjdGlvbn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL15cXF4oW1xcd1xcLlxcLV0rKSQvKTtcblxuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIGJsb2NrOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3AsIHRlbXBsYXRlKSB7XG5cbiAgICAgICAgICAvLyBBbmNob3Igbm9kZSBmb3Iga2VlcGluZyBzZWN0aW9uIGxvY2F0aW9uXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIC8vIE51bWJlciBvZiByZW5kZXJlZCBub2Rlc1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBjaGFuZ2UpO1xuICAgICAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGNoYW5nZSk7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICBpZiAodmFsLmxlbiA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyh2YWwoaSkpJykpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKCF2YWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyhtb2RlbCknKTtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cblxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cbiAgLypcbiAgICogRmFsbGJhY2sgcnVsZSwgbm90IHJlY29nbml6ZWQganRtcGwgdGFnXG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50KSB7XG4gICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCdSRU1PVkVNRUxBVEVSJykpO1xuICAgICAgfVxuICAgIH07XG4gIH1cbl07XG4iLCIvKipcbiAqIENvbXBpbGUgYSB0ZW1wbGF0ZSwgcGFyc2VkIGJ5IEBzZWUgcGFyc2VcbiAqXG4gKiBAcGFyYW0ge2RvY3VtZW50RnJhZ21lbnR9IHRlbXBsYXRlXG4gKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR9IHNvdXJjZVVSTCAtIGluY2x1ZGUgc291cmNlVVJMIHRvIGFpZCBkZWJ1Z2dpbmdcbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIEZ1bmN0aW9uIGJvZHksIGFjY2VwdGluZyBGcmVhayBpbnN0YW5jZSBwYXJhbWV0ZXIsIHN1aXRhYmxlIGZvciBldmFsKClcbiAqL1xuZnVuY3Rpb24gY29tcGlsZSh0ZW1wbGF0ZSwgc291cmNlVVJMLCBkZXB0aCkge1xuXG4gIHZhciByaSwgcnVsZXMsIHJsZW47XG4gIHZhciBtYXRjaCwgYmxvY2s7XG5cbiAgLy8gR2VuZXJhdGUgZHluYW1pYyBmdW5jdGlvbiBib2R5XG4gIHZhciBmdW5jID0gJyhmdW5jdGlvbihtb2RlbCkge1xcbicgK1xuICAgICd2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSwgbm9kZTtcXG5cXG4nO1xuXG4gIGlmICghZGVwdGgpIHtcbiAgICAvLyBHbG9iYWwgYm9va2tlZXBpbmdcbiAgICBmdW5jICs9XG4gICAgICAndmFyIHJhZGlvR3JvdXBzID0ge307XFxuJyArXG4gICAgICAndmFyIHJhZGlvR3JvdXBzVXBkYXRpbmcgPSB7fTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0cyA9IFtdO1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RzVXBkYXRpbmcgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9ucyA9IFtdO1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RPcHRpb25zQ29udGV4dHMgPSBbXTtcXG5cXG4nO1xuICB9XG5cbiAgLy8gV3JhcCBtb2RlbCBpbiBhIEZyZWFrIGluc3RhbmNlLCBpZiBuZWNlc3NhcnlcbiAgZnVuYyArPSAnbW9kZWwgPSB0eXBlb2YgbW9kZWwgPT09IFwiZnVuY3Rpb25cIiA/JyArXG4gICAgJ21vZGVsIDogJyArXG4gICAgJ3R5cGVvZiBtb2RlbCA9PT0gXCJvYmplY3RcIiA/JyArXG4gICAgICAnanRtcGwobW9kZWwpIDonICtcbiAgICAgICdqdG1wbCh7XCIuXCI6IG1vZGVsfSk7XFxuXFxuJztcblxuICAvLyBJdGVyYXRlIGNoaWxkTm9kZXNcbiAgZm9yICh2YXIgaSA9IDAsIGNoaWxkTm9kZXMgPSB0ZW1wbGF0ZS5jaGlsZE5vZGVzLCBsZW4gPSBjaGlsZE5vZGVzLmxlbmd0aCwgbm9kZTtcbiAgICAgICBpIDwgbGVuOyBpKyspIHtcblxuICAgIG5vZGUgPSBjaGlsZE5vZGVzW2ldO1xuXG4gICAgc3dpdGNoIChub2RlLm5vZGVUeXBlKSB7XG5cbiAgICAgIC8vIEVsZW1lbnQgbm9kZVxuICAgICAgY2FzZSAxOlxuXG4gICAgICAgIC8vIGp0bXBsIHRhZz9cbiAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdTQ1JJUFQnICYmIG5vZGUudHlwZSA9PT0gJ3RleHQvanRtcGwtdGFnJykge1xuXG4gICAgICAgICAgZm9yIChyaSA9IDAsIHJ1bGVzID0gcmVxdWlyZSgnLi9jb21waWxlLXJ1bGVzLW5vZGUnKSwgcmxlbiA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgcmkgPCBybGVuOyByaSsrKSB7XG5cbiAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUpO1xuXG4gICAgICAgICAgICAvLyBSdWxlIGZvdW5kP1xuICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgICAgICAgLy8gQmxvY2sgdGFnP1xuICAgICAgICAgICAgICBpZiAobWF0Y2guYmxvY2spIHtcblxuICAgICAgICAgICAgICAgIC8vIEZldGNoIGJsb2NrIHRlbXBsYXRlXG4gICAgICAgICAgICAgICAgYmxvY2sgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICAgICAgZm9yIChpKys7XG4gICAgICAgICAgICAgICAgICAgIChpIDwgbGVuKSAmJiAhbWF0Y2hFbmRCbG9jayhtYXRjaC5ibG9jaywgY2hpbGROb2Rlc1tpXS5pbm5lckhUTUwgfHwgJycpO1xuICAgICAgICAgICAgICAgICAgICBpKyspIHtcbiAgICAgICAgICAgICAgICAgIGJsb2NrLmFwcGVuZENoaWxkKGNoaWxkTm9kZXNbaV0uY2xvbmVOb2RlKHRydWUpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBtYXRjaC5ibG9jaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmdW5jICs9ICcoJyArIG1hdGNoLnJ1bGUudG9TdHJpbmcoKSArICcpJyArXG4gICAgICAgICAgICAgICAgICAgICcoZnJhZywgbW9kZWwsICcgK1xuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShtYXRjaC5ibG9jaykgKyAnLCAnICsgICAvLyBwcm9wXG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KFxuICAgICAgICAgICAgICAgICAgICAgIC8vIHRlbXBsYXRlXG4gICAgICAgICAgICAgICAgICAgICAgY29tcGlsZShcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrLFxuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlVVJMICYmIChzb3VyY2VVUkwgKyAnLScgKyBub2RlLmlubmVySFRNTCArICdbJyArIGkgKyAnXScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgKGRlcHRoIHx8IDApICsgMVxuICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgKSArICcpOyc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gSW5saW5lIHRhZ1xuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBmdW5jICs9ICcoJyArIG1hdGNoLnJ1bGUudG9TdHJpbmcoKSArICcpJyArXG4gICAgICAgICAgICAgICAgICAnKGZyYWcsIG1vZGVsLCAnICsgSlNPTi5zdHJpbmdpZnkobWF0Y2gucHJvcCkgKyAnKTtcXG4nO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gU2tpcCByZW1haW5pbmcgcnVsZXNcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSAvLyBlbmQgaXRlcmF0aW5nIG5vZGUgcnVsZXNcbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIENyZWF0ZSBlbGVtZW50XG4gICAgICAgICAgZnVuYyArPSAnbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCInICsgbm9kZS5ub2RlTmFtZSArICdcIik7XFxuJztcblxuICAgICAgICAgIC8vIFByb2Nlc3MgYXR0cmlidXRlc1xuICAgICAgICAgIGZvciAodmFyIGFpID0gMCwgYXR0cmlidXRlcyA9IG5vZGUuYXR0cmlidXRlcywgYWxlbiA9IGF0dHJpYnV0ZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgYWkgPCBhbGVuOyBhaSsrKSB7XG5cbiAgICAgICAgICAgIGZvciAocmkgPSAwLCBydWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcy1hdHRyJyksIHJsZW4gPSBydWxlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcmkgPCBybGVuOyByaSsrKSB7XG5cbiAgICAgICAgICAgICAgbWF0Y2ggPSBydWxlc1tyaV0obm9kZSwgYXR0cmlidXRlc1thaV0ubmFtZS50b0xvd2VyQ2FzZSgpKTtcblxuICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1hdGNoIGZvdW5kLCBhcHBlbmQgcnVsZSB0byBmdW5jXG4gICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgJyhub2RlLCAnICtcbiAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGF0dHJpYnV0ZXNbYWldLm5hbWUpICsgLy8gYXR0clxuICAgICAgICAgICAgICAgICAgJywgbW9kZWwsICcgK1xuICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2gucHJvcCkgKyAgICAgICAgICAvLyBwcm9wXG4gICAgICAgICAgICAgICAgICAnKTtcXG4nO1xuXG4gICAgICAgICAgICAgICAgLy8gU2tpcCBvdGhlciBhdHRyaWJ1dGUgcnVsZXNcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lICE9PSAnSU5QVVQnKSB7XG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjb21waWxlXG4gICAgICAgICAgICBmdW5jICs9ICdub2RlLmFwcGVuZENoaWxkKCcgK1xuICAgICAgICAgICAgICBjb21waWxlKFxuICAgICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBzb3VyY2VVUkwgJiYgKHNvdXJjZVVSTCArICctJyArIG5vZGUubm9kZU5hbWUgKyAnWycgKyBpICsgJ10nKSxcbiAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICkgKyAnKG1vZGVsKSk7XFxuJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBcHBlbmQgdG8gZnJhZ21lbnRcbiAgICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKG5vZGUpO1xcbic7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcblxuXG4gICAgICAvLyBUZXh0IG5vZGVcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpO1xcbic7XG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIENvbW1lbnQgbm9kZVxuICAgICAgY2FzZSA4OlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobm9kZS5kYXRhKSArICcpKTtcXG4nO1xuICAgICAgICBicmVhaztcblxuICAgIH0gLy8gZW5kIHN3aXRjaFxuICB9IC8vIGVuZCBpdGVyYXRlIGNoaWxkTm9kZXNcblxuICBmdW5jICs9ICdyZXR1cm4gZnJhZzsgfSknO1xuICBmdW5jICs9IHNvdXJjZVVSTCA/XG4gICAgJ1xcbi8vQCBzb3VyY2VVUkw9JyArIHNvdXJjZVVSTCArICdcXG4vLyMgc291cmNlVVJMPScgKyBzb3VyY2VVUkwgKyAnXFxuJyA6XG4gICAgJyc7XG5cbiAgcmV0dXJuIGZ1bmM7XG59XG5cblxuXG5cbmZ1bmN0aW9uIG1hdGNoRW5kQmxvY2soYmxvY2ssIHN0cikge1xuICB2YXIgbWF0Y2ggPSBzdHIubWF0Y2goL1xcLyhbXFx3XFwuXFwtXSspPy8pO1xuICByZXR1cm4gbWF0Y2ggP1xuICAgIGJsb2NrID09PSAnJyB8fCAhbWF0Y2hbMV0gfHwgbWF0Y2hbMV0gPT09IGJsb2NrIDpcbiAgICBmYWxzZTtcbn1cblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjb21waWxlO1xuIiwiLypcblxuRXZhbHVhdGUgb2JqZWN0IGZyb20gbGl0ZXJhbCBvciBDb21tb25KUyBtb2R1bGVcblxuKi9cblxuICAgIC8qIGpzaGludCBldmlsOnRydWUgKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgc3JjLCBtb2RlbCkge1xuXG4gICAgICBtb2RlbCA9IG1vZGVsIHx8IHt9O1xuICAgICAgaWYgKHR5cGVvZiBtb2RlbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBtb2RlbCA9IGp0bXBsKG1vZGVsKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgIGlmICgvLyBQbHVnaW5cbiAgICAgICAgICAgICAgKHByb3AuaW5kZXhPZignX18nKSA9PT0gMCAmJlxuICAgICAgICAgICAgICAgIHByb3AubGFzdEluZGV4T2YoJ19fJykgPT09IHByb3AubGVuZ3RoIC0gMikgfHxcbiAgICAgICAgICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHlcbiAgICAgICAgICAgICAgdHlwZW9mIHByb3BlcnRpZXNbcHJvcF0gPT09ICdmdW5jdGlvbidcbiAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgIGlmICh0YXJnZXQudmFsdWVzW3Byb3BdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0LnZhbHVlc1twcm9wXSA9IHByb3BlcnRpZXNbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gVGFyZ2V0IGRvZXNuJ3QgYWxyZWFkeSBoYXZlIHByb3A/XG4gICAgICAgICAgICBpZiAodGFyZ2V0KHByb3ApID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdGFyZ2V0KHByb3AsIHByb3BlcnRpZXNbcHJvcF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBhcHBseVBsdWdpbnMoKSB7XG4gICAgICAgIHZhciBwcm9wLCBhcmc7XG4gICAgICAgIGZvciAocHJvcCBpbiBqdG1wbC5wbHVnaW5zKSB7XG4gICAgICAgICAgcGx1Z2luID0ganRtcGwucGx1Z2luc1twcm9wXTtcbiAgICAgICAgICBhcmcgPSBtb2RlbC52YWx1ZXNbJ19fJyArIHByb3AgKyAnX18nXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHBsdWdpbiA9PT0gJ2Z1bmN0aW9uJyAmJiBhcmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcGx1Z2luLmNhbGwobW9kZWwsIGFyZywgdGFyZ2V0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZXZhbE9iamVjdChib2R5LCBzcmMpIHtcbiAgICAgICAgdmFyIHJlc3VsdCwgbW9kdWxlID0geyBleHBvcnRzOiB7fSB9O1xuICAgICAgICBzcmMgPSBzcmMgP1xuICAgICAgICAgICdcXG4vL0Agc291cmNlVVJMPScgKyBzcmMgK1xuICAgICAgICAgICdcXG4vLyMgc291cmNlVVJMPScgKyBzcmMgOlxuICAgICAgICAgICcnO1xuICAgICAgICBpZiAoYm9keS5tYXRjaCgvXlxccyp7W1xcU1xcc10qfVxccyokLykpIHtcbiAgICAgICAgICAvLyBMaXRlcmFsXG4gICAgICAgICAgcmV0dXJuIGV2YWwoJ3Jlc3VsdD0nICsgYm9keSArIHNyYyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29tbW9uSlMgbW9kdWxlXG4gICAgICAgIGV2YWwoYm9keSArIHNyYyk7XG4gICAgICAgIHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZE1vZGVsKHNyYywgdGVtcGxhdGUsIGRvYykge1xuICAgICAgICB2YXIgaGFzaEluZGV4O1xuICAgICAgICBpZiAoIXNyYykge1xuICAgICAgICAgIC8vIE5vIHNvdXJjZVxuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzcmMubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBFbGVtZW50IGluIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvYy5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QoZWxlbWVudC5pbm5lckhUTUwsIHNyYykpO1xuICAgICAgICAgIGFwcGx5UGx1Z2lucygpO1xuICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCBtb2RlbCB2aWEgWEhSXG4gICAgICAgICAgLy8gT2xkZXIgSUVzIGNvbXBsYWluIGlmIFVSTCBjb250YWlucyBoYXNoXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLFxuICAgICAgICAgICAgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGp0bXBsLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAgICAgICAucGFyc2VGcm9tU3RyaW5nKHJlc3AsICd0ZXh0L2h0bWwnKVxuICAgICAgICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QobWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsIHNyYykpO1xuICAgICAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKCkge1xuICAgICAgICB2YXIgaGFzaEluZGV4O1xuXG4gICAgICAgIGlmICghc3JjKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHNyYy5tYXRjaChqdG1wbC5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIGlzIHRoZSBjb250ZW50cyBvZiBlbGVtZW50XG4gICAgICAgICAgLy8gYmVsb25naW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBsb2FkTW9kZWwoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSwgZWxlbWVudC5pbm5lckhUTUwsIGRvY3VtZW50KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBoYXNoSW5kZXggPSBzcmMuaW5kZXhPZignIycpO1xuICAgICAgICAgIC8vIEdldCB0ZW1wbGF0ZSB2aWEgWEhSXG4gICAgICAgICAganRtcGwoJ0dFVCcsIGhhc2hJbmRleCA+IC0xID8gc3JjLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpIDogc3JjLFxuICAgICAgICAgICAgZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goanRtcGwuUkVfRU5EU19XSVRIX05PREVfSUQpO1xuICAgICAgICAgICAgICB2YXIgaWZyYW1lLCBkb2M7XG4gICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgICAgICAgICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgICAgICAgICBkb2MgPSBpZnJhbWUuY29udGVudERvY3VtZW50O1xuICAgICAgICAgICAgICAgIGRvYy53cml0ZWxuKHJlc3ApO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkb2MgPSBkb2N1bWVudDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9IG1hdGNoICYmIGRvYy5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcblxuICAgICAgICAgICAgICBsb2FkTW9kZWwoXG4gICAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbCcpIDogJycsXG4gICAgICAgICAgICAgICAgbWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsXG4gICAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2FkVGVtcGxhdGUoKTtcbiAgICB9O1xuIiwiLypcbiAqIE1haW4gZnVuY3Rpb25cbiAqL1xuLyoganNoaW50IGV2aWw6IHRydWUgKi9cbmZ1bmN0aW9uIGp0bXBsKCkge1xuICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgdmFyIHRhcmdldCwgdCwgdGVtcGxhdGUsIG1vZGVsO1xuXG4gIC8vIGp0bXBsKCdIVFRQX01FVEhPRCcsIHVybFssIHBhcmFtZXRlcnNbLCBjYWxsYmFja1ssIG9wdGlvbnNdXV0pP1xuICBpZiAoWydHRVQnLCAnUE9TVCddLmluZGV4T2YoYXJnc1swXSkgPiAtMSkge1xuICAgIHJldHVybiByZXF1aXJlKCcuL3hocicpLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG5cbiAgLy8ganRtcGwob2JqZWN0KT9cbiAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdvYmplY3QnKSB7XG4gICAgLy8gcmV0dXJuIEZyZWFrIGluc3RhbmNlXG4gICAgcmV0dXJuIHJlcXVpcmUoJ2ZyZWFrJykoYXJnc1swXSk7XG4gIH1cblxuICAvLyBqdG1wbCh0YXJnZXQpP1xuICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICAvLyByZXR1cm4gbW9kZWxcbiAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKS5fX2p0bXBsX187XG4gIH1cblxuICAvLyBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgZWxzZSBpZiAoXG4gICAgKCBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgfHxcbiAgICAgICh0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpXG4gICAgKSAmJlxuXG4gICAgKCAoYXJnc1sxXSAmJiB0eXBlb2YgYXJnc1sxXS5hcHBlbmRDaGlsZCA9PT0gJ2Z1bmN0aW9uJykgfHxcbiAgICAgICh0eXBlb2YgYXJnc1sxXSA9PT0gJ3N0cmluZycpXG4gICAgKSAmJlxuXG4gICAgYXJnc1syXSAhPT0gdW5kZWZpbmVkXG5cbiAgKSB7XG5cbiAgICB0YXJnZXQgPSBhcmdzWzBdICYmIGFyZ3NbMF0ubm9kZVR5cGUgID9cbiAgICAgIGFyZ3NbMF0gOlxuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKTtcblxuICAgIHRlbXBsYXRlID0gYXJnc1sxXS5tYXRjaChqdG1wbC5SRV9OT0RFX0lEKSA/XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMV0pLmlubmVySFRNTCA6XG4gICAgICBhcmdzWzFdO1xuXG4gICAgbW9kZWwgPVxuICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAvLyBhbHJlYWR5IHdyYXBwZWRcbiAgICAgICAgYXJnc1syXSA6XG4gICAgICAgIC8vIG90aGVyd2lzZSB3cmFwXG4gICAgICAgIGp0bXBsKFxuICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAvLyBvYmplY3RcbiAgICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycgJiYgYXJnc1syXS5tYXRjaChqdG1wbC5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgICAgIC8vIHNyYywgbG9hZCBpdFxuICAgICAgICAgICAgICByZXF1aXJlKCcuL2xvYWRlcicpXG4gICAgICAgICAgICAgICAgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1syXSkuaW5uZXJIVE1MKSA6XG5cbiAgICAgICAgICAgICAgLy8gc2ltcGxlIHZhbHVlLCBib3ggaXRcbiAgICAgICAgICAgICAgeycuJzogYXJnc1syXX1cbiAgICAgICAgKTtcblxuICAgIGlmICh0YXJnZXQubm9kZU5hbWUgPT09ICdTQ1JJUFQnKSB7XG4gICAgICB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB0LmlkID0gdGFyZ2V0LmlkO1xuICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHQsIHRhcmdldCk7XG4gICAgICB0YXJnZXQgPSB0O1xuICAgIH1cblxuICAgIC8vIEFzc29jaWF0ZSB0YXJnZXQgYW5kIG1vZGVsXG4gICAgdGFyZ2V0Ll9fanRtcGxfXyA9IG1vZGVsO1xuXG4gICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgdGFyZ2V0LmlubmVySFRNTCA9ICcnO1xuXG4gICAgLy8gQXNzaWduIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAgLy90YXJnZXQuYXBwZW5kQ2hpbGQocmVxdWlyZSgnLi9jb21waWxlcicpKHRlbXBsYXRlLCBtb2RlbCwgYXJnc1szXSkpO1xuICAgIHRhcmdldC5hcHBlbmRDaGlsZChcbiAgICAgIGV2YWwoXG4gICAgICAgIGp0bXBsLmNvbXBpbGUoXG4gICAgICAgICAganRtcGwucGFyc2UodGVtcGxhdGUpLFxuICAgICAgICAgIHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtanRtcGwnKVxuICAgICAgICApICsgJyhtb2RlbCknXG4gICAgICApXG4gICAgKTtcbiAgfVxufVxuXG5cblxuLypcbiAqIE9uIHBhZ2UgcmVhZHksIHByb2Nlc3MganRtcGwgdGFyZ2V0c1xuICovXG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gIHZhciBsb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xuICB2YXIgdGFyZ2V0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWp0bXBsXScpO1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0YXJnZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbG9hZGVyKHRhcmdldHNbaV0sIHRhcmdldHNbaV0uZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJykpO1xuICB9XG59KTtcblxuXG4vKlxuICogRXhwb3J0IHN0dWZmXG4gKi9cbmp0bXBsLlJFX05PREVfSUQgPSAvXiNbXFx3XFwuXFwtXSskLztcbmp0bXBsLlJFX0VORFNfV0lUSF9OT0RFX0lEID0gLy4rKCNbXFx3XFwuXFwtXSspJC87XG5cbmp0bXBsLnBhcnNlID0gcmVxdWlyZSgnLi9wYXJzZScpO1xuanRtcGwuY29tcGlsZSA9IHJlcXVpcmUoJy4vY29tcGlsZScpO1xuanRtcGwubG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbmp0bXBsLnV0ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdXRlbXBsYXRlJyk7XG5qdG1wbC5fZ2V0ID0gZnVuY3Rpb24obW9kZWwsIHByb3ApIHtcbiAgdmFyIHZhbCA9IG1vZGVsKHByb3ApO1xuICByZXR1cm4gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpID9cbiAgICBKU09OLnN0cmluZ2lmeSh2YWwudmFsdWVzKSA6XG4gICAgdmFsO1xufTtcblxuXG4vKlxuICogUGx1Z2luc1xuICovXG5qdG1wbC5wbHVnaW5zID0ge1xuICBpbml0OiBmdW5jdGlvbihhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgLy8gQ2FsbCBhc3luYywgYWZ0ZXIganRtcGwgaGFzIGNvbnN0cnVjdGVkIHRoZSBET01cbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGFyZy5jYWxsKHRoYXQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59O1xuXG5cbi8qXG4gKiBFeHBvcnRcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBqdG1wbDtcbiIsIi8qKlxuICogUGFyc2UgYSB0ZXh0IHRlbXBsYXRlIHRvIERPTSBzdHJ1Y3R1cmUgcmVhZHkgZm9yIGNvbXBpbGluZ1xuICogQHNlZSBjb21waWxlXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlXG4gKlxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cbmZ1bmN0aW9uIHBhcnNlKHRlbXBsYXRlKSB7XG5cbiAgdmFyIGlmcmFtZSwgYm9keTtcblxuICBmdW5jdGlvbiBwcmVwcm9jZXNzKHRlbXBsYXRlKSB7XG5cbiAgICAvLyByZXBsYWNlIHt7e3RhZ319fSB3aXRoIHt7JnRhZ319XG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKC9cXHtcXHtcXHsoW1xcU1xcc10qPylcXH1cXH1cXH0vZywgJ3t7JiQxfX0nKTtcblxuICAgIC8vIDEuIHdyYXAgZWFjaCBub24tYXR0cmlidXRlIHRhZyBpbiA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2p0bXBsLXRhZ1wiPlxuICAgIC8vIDIuIHJlbW92ZSBNdXN0YWNoZSBjb21tZW50c1xuICAgIC8vIFRPRE86IGhhbmRsZSB0YWdzIGluIEhUTUwgY29tbWVudHNcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7KFtcXFNcXHNdKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgbWF0Y2gxLCBwb3MpIHtcbiAgICAgICAgdmFyIGhlYWQgPSB0ZW1wbGF0ZS5zbGljZSgwLCBwb3MpO1xuICAgICAgICB2YXIgaW5zaWRlVGFnID0gISFoZWFkLm1hdGNoKC88W1xcd1xcLV0rW14+XSo/JC8pO1xuICAgICAgICB2YXIgb3BlbmluZyA9IGhlYWQubWF0Y2goLzwoc2NyaXB0fFNDUklQVCkvZyk7XG4gICAgICAgIHZhciBjbG9zaW5nID0gaGVhZC5tYXRjaCgvPFxcLyhzY3JpcHR8U0NSSVBUKS9nKTtcbiAgICAgICAgdmFyIGluc2lkZVNjcmlwdCA9XG4gICAgICAgICAgICAob3BlbmluZyAmJiBvcGVuaW5nLmxlbmd0aCB8fCAwKSA+IChjbG9zaW5nICYmIGNsb3NpbmcubGVuZ3RoIHx8IDApO1xuICAgICAgICB2YXIgaW5zaWRlQ29tbWVudCA9ICEhaGVhZC5tYXRjaCgvPCEtLVxccyokLyk7XG4gICAgICAgIHZhciBpc011c3RhY2hlQ29tbWVudCA9IG1hdGNoMS5pbmRleE9mKCchJykgPT09IDA7XG5cbiAgICAgICAgcmV0dXJuIGluc2lkZVRhZyB8fCBpbnNpZGVDb21tZW50ID9cbiAgICAgICAgICBpc011c3RhY2hlQ29tbWVudCA/XG4gICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgaW5zaWRlU2NyaXB0ID9cbiAgICAgICAgICAgIG1hdGNoIDpcbiAgICAgICAgICAgICc8c2NyaXB0IHR5cGU9XCJ0ZXh0L2p0bXBsLXRhZ1wiPicgKyBtYXRjaDEudHJpbSgpICsgJ1xceDNDL3NjcmlwdD4nO1xuICAgICAgfVxuICAgICk7XG4gICAgLy8gcHJlZml4ICdzZWxlY3RlZCcgYW5kICdjaGVja2VkJyBhdHRyaWJ1dGVzIHdpdGggJ2p0bXBsLSdcbiAgICAvLyAodG8gYXZvaWQgXCJzcGVjaWFsXCIgcHJvY2Vzc2luZywgb2ggSUU4KVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/Om9wdGlvbnxPUFRJT04pW14+XSo/KSg/OnNlbGVjdGVkfFNFTEVDVEVEKT0vZyxcbiAgICAgICckMWp0bXBsLXNlbGVjdGVkPScpO1xuXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgLyg8KD86aW5wdXR8SU5QVVQpW14+XSo/KSg/OmNoZWNrZWR8Q0hFQ0tFRCk9L2csXG4gICAgICAnJDFqdG1wbC1jaGVja2VkPScpO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9XG5cbiAgdGVtcGxhdGUgPSBwcmVwcm9jZXNzKHRlbXBsYXRlKTtcbiAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gIGlmcmFtZS5jb250ZW50RG9jdW1lbnQud3JpdGVsbignPCFkb2N0eXBlIGh0bWw+XFxuPGh0bWw+PGJvZHk+JyArIHRlbXBsYXRlICsgJzwvYm9keT48L2h0bWw+Jyk7XG4gIGJvZHkgPSBpZnJhbWUuY29udGVudERvY3VtZW50LmJvZHk7XG4gIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcblxuICByZXR1cm4gYm9keTtcbn1cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG4iLCIvKipcbiAqIHV0ZW1wbGF0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gbW9kZWwgLSBkYXRhIGFzIEZyZWFrIGluc3RhbmNlXG4gKiBAcGFyYW0ge29wdGlvbmFsIGZ1bmN0aW9ufSBvbkNoYW5nZSAtIHdpbGwgYmUgY2FsbGVkIHdoZW5ldmVyIHVzZWQgbW9kZWwgcHJvcGVydHkgY2hhbmdlc1xuICpcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gcmVuZGVyZWQgdGVtcGxhdGUgdXNpbmcgbW9kZWxcbiAqXG4gKiBCYXNpYyB0ZW1wbGF0ZSByZW5kZXJpbmcuXG4gKiBTdXBwb3J0ZWQgdGFnczoge3t2YXJpYWJsZX19LCB7eyNzZWN0aW9ufX0sIHt7XmludmVydGVkX3NlY3Rpb259fVxuICogKHNob3J0IGNsb3NpbmcgdGFncyB7ey99fSBzdXBwb3J0ZWQpXG4gKlxuICogRG9lcyBOT1Qgc3VwcG9ydCBuZXN0ZWQgc2VjdGlvbnMsIHNvIHNpbXBsZSBwYXJzaW5nIHZpYSByZWdleCBpcyBwb3NzaWJsZS5cbiAqL1xuZnVuY3Rpb24gdXRlbXBsYXRlKHRlbXBsYXRlLCBtb2RlbCwgb25DaGFuZ2UpIHtcbiAgcmV0dXJuIHRlbXBsYXRlXG4gICAgLy8ge3sjc2VjdGlvbn19IHNlY3Rpb25Cb2R5IHt7L319XG4gICAgLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7IyhbXFx3XFwuXFwtXSspXFx9XFx9KC4rPylcXHtcXHtcXC8oW1xcd1xcLlxcLV0qPylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCBvcGVuVGFnLCBib2R5LCBjbG9zZVRhZywgcG9zKSB7XG4gICAgICAgIGlmIChjbG9zZVRhZyAhPT0gJycgJiYgY2xvc2VUYWcgIT09IG9wZW5UYWcpIHtcbiAgICAgICAgICB0aHJvdyAnanRtcGw6IFVuY2xvc2VkICcgKyBvcGVuVGFnO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb25DaGFuZ2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgb3BlblRhZywgb25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIHZhciB2YWwgPSBvcGVuVGFnID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKG9wZW5UYWcpO1xuICAgICAgICByZXR1cm4gKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSA/XG4gICAgICAgICAgICAvLyBBcnJheVxuICAgICAgICAgICAgKHZhbC5sZW4gPiAwKSA/XG4gICAgICAgICAgICAgIC8vIE5vbi1lbXB0eVxuICAgICAgICAgICAgICB2YWwudmFsdWVzXG4gICAgICAgICAgICAgICAgLm1hcChmdW5jdGlvbihlbCwgaSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHV0ZW1wbGF0ZShib2R5LnJlcGxhY2UoL1xce1xce1xcLlxcfVxcfS9nLCAne3snICsgaSArICd9fScpLCB2YWwsIG9uQ2hhbmdlKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5qb2luKCcnKSA6XG4gICAgICAgICAgICAgIC8vIEVtcHR5XG4gICAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIC8vIE9iamVjdCBvciBib29sZWFuP1xuICAgICAgICAgICAgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSA/XG4gICAgICAgICAgICAgIC8vIE9iamVjdFxuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgdmFsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgICAgKCEhdmFsKSA/XG4gICAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIG1vZGVsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAgICcnO1xuICAgICAgfVxuICAgIClcbiAgICAvLyB7e15pbnZlcnRlZF9zZWN0aW9ufX0gc2VjdGlvbkJvZHkge3svfX1cbiAgICAucmVwbGFjZShcbiAgICAgIC9cXHtcXHtcXF4oW1xcd1xcLlxcLV0rKVxcfVxcfSguKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgb3BlblRhZywgYm9keSwgY2xvc2VUYWcsIHBvcykge1xuICAgICAgICBpZiAoY2xvc2VUYWcgIT09ICcnICYmIGNsb3NlVGFnICE9PSBvcGVuVGFnKSB7XG4gICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgb3BlblRhZztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG9wZW5UYWcsIG9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdmFsID0gb3BlblRhZyA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChvcGVuVGFnKTtcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkgP1xuICAgICAgICAgICAgLy8gQXJyYXlcbiAgICAgICAgICAgICh2YWwubGVuID09PSAwKSA/XG4gICAgICAgICAgICAgIC8vIEVtcHR5XG4gICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgLy8gTm9uLWVtcHR5XG4gICAgICAgICAgICAgICcnIDpcbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgKCF2YWwpID9cbiAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIG1vZGVsLCBvbkNoYW5nZSkgOlxuICAgICAgICAgICAgICAnJztcbiAgICAgIH1cbiAgICApXG4gICAgLy8ge3t2YXJpYWJsZX19XG4gICAgLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7KFtcXHdcXC5cXC1dKylcXH1cXH0vZyxcbiAgICAgIGZ1bmN0aW9uKG1hdGNoLCB2YXJpYWJsZSwgcG9zKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb25DaGFuZ2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgdmFyaWFibGUsIG9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbW9kZWwodmFyaWFibGUpID09PSB1bmRlZmluZWQgPyAnJyA6IG1vZGVsKHZhcmlhYmxlKSArICcnO1xuICAgICAgfVxuICAgICk7XG59XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHV0ZW1wbGF0ZTtcbiIsIi8qXG5cblJlcXVlc3RzIEFQSVxuXG4qL1xuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW4sIHByb3AsIHByb3BzLCByZXF1ZXN0O1xuICAgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gTGFzdCBmdW5jdGlvbiBhcmd1bWVudFxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5yZWR1Y2UoXG4gICAgICAgIGZ1bmN0aW9uIChwcmV2LCBjdXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBjdXJyID09PSAnZnVuY3Rpb24nID8gY3VyciA6IHByZXY7XG4gICAgICAgIH0sXG4gICAgICAgIG51bGxcbiAgICAgICk7XG5cbiAgICAgIHZhciBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuXG4gICAgICBpZiAodHlwZW9mIG9wdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cblxuICAgICAgZm9yIChpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvcHRzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICAgIHhocltwcm9wXSA9IG9wdHNbcHJvcF07XG4gICAgICB9XG5cbiAgICAgIHJlcXVlc3QgPVxuICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnKSA/XG5cbiAgICAgICAgICAvLyBTdHJpbmcgcGFyYW1ldGVyc1xuICAgICAgICAgIGFyZ3NbMl0gOlxuXG4gICAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnb2JqZWN0JykgP1xuXG4gICAgICAgICAgICAvLyBPYmplY3QgcGFyYW1ldGVycy4gU2VyaWFsaXplIHRvIFVSSVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoYXJnc1syXSkubWFwKFxuICAgICAgICAgICAgICBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHggKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoYXJnc1syXVt4XSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICkuam9pbignJicpIDpcblxuICAgICAgICAgICAgLy8gTm8gcGFyYW1ldGVyc1xuICAgICAgICAgICAgJyc7XG5cbiAgICAgIHZhciBvbmxvYWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgcmVzcDtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcCA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmVzcCA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIHJlc3AsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkge1xuICAgICAgICAgICAgb25sb2FkLmNhbGwodGhpcywgJ2RvbmUnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnanRtcGwgWEhSIGVycm9yOiAnICsgdGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgeGhyLm9wZW4oYXJnc1swXSwgYXJnc1sxXSxcbiAgICAgICAgKG9wdHMuYXN5bmMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYXN5bmMgOiB0cnVlKSxcbiAgICAgICAgb3B0cy51c2VyLCBvcHRzLnBhc3N3b3JkKTtcblxuICAgICAgeGhyLnNlbmQocmVxdWVzdCk7XG5cbiAgICAgIHJldHVybiB4aHI7XG5cbiAgICB9O1xuIl19
(6)
});
