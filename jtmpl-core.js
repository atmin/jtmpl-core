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

          // TODO: what to do with non-matching rules?
          if (!match) {
            func += 'node = document.createTextNode("REMOVEMELATER");\n';
            func += 'frag.appendChild(node);\n';
          }
        }

        else {
          // Create element
          func += 'node = document.createElement("' + node.nodeName + '");\n';

          // Process attributes
          // TODO: handle jtmpl- prefixed attributes
          for (var ai = 0, attributes = node.attributes, alen = attributes.length;
               ai < alen; ai++) {

            if (attributes[ai].value.match(/\{\{/)) {

              // Opening delimiter found, process attribute rules
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
            else {

              // TODO: extract clone rule as last fallback
              // attribute rule and clean this section

              // Just clone the attribute
              func += 'node.setAttribute("' +
                attributes[ai].name +
                '", ' +
                JSON.stringify(attributes[ai].value) +
                ');\n';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1hdHRyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1ub2RlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbnN0cy5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbnRlbnQtbG9hZGVkLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbG9hZGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbWFpbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3BhcnNlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMveGhyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnJlYWsob2JqLCByb290LCBwYXJlbnQsIHByb3ApIHtcblxuICB2YXIgbGlzdGVuZXJzID0ge1xuICAgICdjaGFuZ2UnOiB7fSxcbiAgICAndXBkYXRlJzoge30sXG4gICAgJ2luc2VydCc6IHt9LFxuICAgICdkZWxldGUnOiB7fVxuICB9O1xuICB2YXIgX2RlcGVuZGVudFByb3BzID0ge307XG4gIHZhciBfZGVwZW5kZW50Q29udGV4dHMgPSB7fTtcbiAgdmFyIGNhY2hlID0ge307XG4gIHZhciBjaGlsZHJlbiA9IHt9O1xuXG4gIC8vIEFzc2VydCBjb25kaXRpb25cbiAgZnVuY3Rpb24gYXNzZXJ0KGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgdGhyb3cgbXNnIHx8ICdhc3NlcnRpb24gZmFpbGVkJztcbiAgICB9XG4gIH1cblxuICAvLyBNaXggcHJvcGVydGllcyBpbnRvIHRhcmdldFxuICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wZXJ0aWVzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtwcm9wc1tpXV0gPSBwcm9wZXJ0aWVzW3Byb3BzW2ldXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWVwRXF1YWwoeCwgeSkge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmXG4gICAgICAgIHR5cGVvZiB5ID09PSBcIm9iamVjdFwiICYmIHkgIT09IG51bGwpIHtcblxuICAgICAgaWYgKE9iamVjdC5rZXlzKHgpLmxlbmd0aCAhPT0gT2JqZWN0LmtleXMoeSkubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgcHJvcCBpbiB4KSB7XG4gICAgICAgIGlmICh4Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgaWYgKHkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIGlmICghZGVlcEVxdWFsKHhbcHJvcF0sIHlbcHJvcF0pKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmICh4ICE9PSB5KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBFdmVudCBmdW5jdGlvbnNcbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gWydzdHJpbmcnLCAnbnVtYmVyJ10uaW5kZXhPZih0eXBlb2YgYXJndW1lbnRzWzFdKSA+IC0xID9cbiAgICAgIGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuXG4gICAgLy8gQXJncyBjaGVja1xuICAgIGFzc2VydChbJ2NoYW5nZScsICd1cGRhdGUnLCAnaW5zZXJ0JywgJ2RlbGV0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEpO1xuICAgIGFzc2VydChcbiAgICAgIChbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCAhPT0gbnVsbCkgfHxcbiAgICAgIChbJ2luc2VydCcsICdkZWxldGUnLCAndXBkYXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wID09PSBudWxsKVxuICAgICk7XG5cbiAgICAvLyBJbml0IGxpc3RlbmVycyBmb3IgcHJvcFxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICAvLyBBbHJlYWR5IHJlZ2lzdGVyZWQ/XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjaykgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgb3Igc3BlY2lmaWVkIGxpc3RlbmVycyBnaXZlbiBldmVudCBhbmQgcHJvcGVydHlcbiAgZnVuY3Rpb24gb2ZmKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdzdHJpbmcnID8gYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG4gICAgdmFyIGk7XG5cbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBhbGwgcHJvcGVydHkgd2F0Y2hlcnM/XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFJlbW92ZSBzcGVjaWZpYyBjYWxsYmFja1xuICAgICAgaSA9IGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICBpZiAoaSA+IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0uc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICB9XG5cbiAgLy8gdHJpZ2dlcignY2hhbmdlJywgcHJvcClcbiAgLy8gdHJpZ2dlcigndXBkYXRlJywgcHJvcClcbiAgLy8gdHJpZ2dlcignaW5zZXJ0JyBvciAnZGVsZXRlJywgaW5kZXgsIGNvdW50KVxuICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBhLCBiKSB7XG4gICAgdmFyIGhhbmRsZXJzID0gKGxpc3RlbmVyc1tldmVudF1bWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xID8gYSA6IG51bGxdIHx8IFtdKTtcbiAgICB2YXIgaSwgbGVuID0gaGFuZGxlcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaGFuZGxlcnNbaV0uY2FsbChpbnN0YW5jZSwgYSwgYik7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4cG9ydCBtb2RlbCB0byBKU09OIHN0cmluZ1xuICAvLyBOT1QgZXhwb3J0ZWQ6XG4gIC8vIC0gcHJvcGVydGllcyBzdGFydGluZyB3aXRoIF8gKFB5dGhvbiBwcml2YXRlIHByb3BlcnRpZXMgY29udmVudGlvbilcbiAgLy8gLSBjb21wdXRlZCBwcm9wZXJ0aWVzIChkZXJpdmVkIGZyb20gbm9ybWFsIHByb3BlcnRpZXMpXG4gIGZ1bmN0aW9uIHRvSlNPTigpIHtcbiAgICBmdW5jdGlvbiBmaWx0ZXIob2JqKSB7XG4gICAgICB2YXIga2V5LCBmaWx0ZXJlZCA9IEFycmF5LmlzQXJyYXkob2JqKSA/IFtdIDoge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZmlsdGVyKG9ialtrZXldKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2tleV0gIT09ICdmdW5jdGlvbicgJiYga2V5WzBdICE9PSAnXycpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZpbHRlcihvYmopKTtcbiAgfVxuXG4gIC8vIExvYWQgbW9kZWwgZnJvbSBKU09OIHN0cmluZyBvciBvYmplY3RcbiAgZnVuY3Rpb24gZnJvbUpTT04oZGF0YSkge1xuICAgIHZhciBrZXk7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfVxuICAgIGZvciAoa2V5IGluIGRhdGEpIHtcbiAgICAgIGluc3RhbmNlKGtleSwgZGF0YVtrZXldKTtcbiAgICAgIHRyaWdnZXIoJ3VwZGF0ZScsIGtleSk7XG4gICAgfVxuICAgIGluc3RhbmNlLmxlbiA9IG9iai5sZW5ndGg7XG4gIH1cblxuICAvLyBVcGRhdGUgaGFuZGxlcjogcmVjYWxjdWxhdGUgZGVwZW5kZW50IHByb3BlcnRpZXMsXG4gIC8vIHRyaWdnZXIgY2hhbmdlIGlmIG5lY2Vzc2FyeVxuICBmdW5jdGlvbiB1cGRhdGUocHJvcCkge1xuICAgIGlmICghZGVlcEVxdWFsKGNhY2hlW3Byb3BdLCBnZXQocHJvcCwgZnVuY3Rpb24oKSB7fSwgdHJ1ZSkpKSB7XG4gICAgICB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgZGVwZW5kZW50c1xuICAgIGZvciAodmFyIGkgPSAwLCBkZXAgPSBfZGVwZW5kZW50UHJvcHNbcHJvcF0gfHwgW10sIGxlbiA9IGRlcC5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgZGVsZXRlIGNoaWxkcmVuW2RlcFtpXV07XG4gICAgICBfZGVwZW5kZW50Q29udGV4dHNbcHJvcF1baV0udHJpZ2dlcigndXBkYXRlJywgZGVwW2ldKTtcbiAgICB9XG5cbiAgICBpZiAoaW5zdGFuY2UucGFyZW50KSB7XG4gICAgICAvLyBOb3RpZnkgY29tcHV0ZWQgcHJvcGVydGllcywgZGVwZW5kaW5nIG9uIHBhcmVudCBvYmplY3RcbiAgICAgIGluc3RhbmNlLnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCBpbnN0YW5jZS5wcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBQcm94eSB0aGUgYWNjZXNzb3IgZnVuY3Rpb24gdG8gcmVjb3JkXG4gIC8vIGFsbCBhY2Nlc3NlZCBwcm9wZXJ0aWVzXG4gIGZ1bmN0aW9uIGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApIHtcbiAgICBmdW5jdGlvbiB0cmFja2VyKGNvbnRleHQpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbihfcHJvcCwgX2FyZykge1xuICAgICAgICBpZiAoIWNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSA9IFtdO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0uaW5kZXhPZihwcm9wKSA9PT0gLTEpIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0ucHVzaChwcm9wKTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0ucHVzaChpbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRleHQoX3Byb3AsIF9hcmcsIHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gdHJhY2tlcihpbnN0YW5jZSk7XG4gICAgY29uc3RydWN0KHJlc3VsdCk7XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgcmVzdWx0LnBhcmVudCA9IHRyYWNrZXIocGFyZW50KTtcbiAgICB9XG4gICAgcmVzdWx0LnJvb3QgPSB0cmFja2VyKHJvb3QgfHwgaW5zdGFuY2UpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBTaGFsbG93IGNsb25lIGFuIG9iamVjdFxuICBmdW5jdGlvbiBzaGFsbG93Q2xvbmUob2JqKSB7XG4gICAgdmFyIGtleSwgY2xvbmU7XG4gICAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgY2xvbmUgPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICBjbG9uZVtrZXldID0gb2JqW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY2xvbmUgPSBvYmo7XG4gICAgfVxuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIC8vIEdldHRlciBmb3IgcHJvcCwgaWYgY2FsbGJhY2sgaXMgZ2l2ZW5cbiAgLy8gY2FuIHJldHVybiBhc3luYyB2YWx1ZVxuICBmdW5jdGlvbiBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHZhbCA9IG9ialtwcm9wXTtcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFsID0gdmFsLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIGNhbGxiYWNrKTtcbiAgICAgIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgICAgY2FjaGVbcHJvcF0gPSAodmFsID09PSB1bmRlZmluZWQpID8gdmFsIDogc2hhbGxvd0Nsb25lKHZhbCk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKCFza2lwQ2FjaGluZykge1xuICAgICAgY2FjaGVbcHJvcF0gPSB2YWw7XG4gICAgfVxuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBmdW5jdGlvbiBnZXR0ZXIocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldChwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpO1xuXG4gICAgcmV0dXJuIHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0JyA/XG4gICAgICAvLyBXcmFwIG9iamVjdFxuICAgICAgY2hpbGRyZW5bcHJvcF0gP1xuICAgICAgICBjaGlsZHJlbltwcm9wXSA6XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdID0gZnJlYWsocmVzdWx0LCByb290IHx8IGluc3RhbmNlLCBpbnN0YW5jZSwgcHJvcCkgOlxuICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICByZXN1bHQ7XG4gIH1cblxuICAvLyBTZXQgcHJvcCB0byB2YWxcbiAgZnVuY3Rpb24gc2V0dGVyKHByb3AsIHZhbCkge1xuICAgIHZhciBvbGRWYWwgPSBnZXQocHJvcCk7XG5cbiAgICBpZiAodHlwZW9mIG9ialtwcm9wXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHkgc2V0dGVyXG4gICAgICBvYmpbcHJvcF0uY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgdmFsKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBTaW1wbGUgcHJvcGVydHlcbiAgICAgIG9ialtwcm9wXSA9IHZhbDtcbiAgICAgIGlmICh2YWwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZGVsZXRlIGNhY2hlW3Byb3BdO1xuICAgICAgICBkZWxldGUgY2hpbGRyZW5bcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9sZFZhbCAhPT0gdmFsKSB7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yLCB1bmlmeSBnZXR0ZXIgYW5kIHNldHRlclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcsIHNraXBDYWNoaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIChhcmcgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgIGdldHRlciA6IHNldHRlclxuICAgICkocHJvcCwgYXJnLCBza2lwQ2FjaGluZyk7XG4gIH1cblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBmdW5jdGlvbiBjb25zdHJ1Y3QodGFyZ2V0KSB7XG4gICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICB2YWx1ZXM6IG9iaixcbiAgICAgIHBhcmVudDogcGFyZW50IHx8IG51bGwsXG4gICAgICByb290OiByb290IHx8IHRhcmdldCxcbiAgICAgIHByb3A6IHByb3AgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBwcm9wLFxuICAgICAgLy8gLm9uKGV2ZW50WywgcHJvcF0sIGNhbGxiYWNrKVxuICAgICAgb246IG9uLFxuICAgICAgLy8gLm9mZihldmVudFssIHByb3BdWywgY2FsbGJhY2tdKVxuICAgICAgb2ZmOiBvZmYsXG4gICAgICAvLyAudHJpZ2dlcihldmVudFssIHByb3BdKVxuICAgICAgdHJpZ2dlcjogdHJpZ2dlcixcbiAgICAgIHRvSlNPTjogdG9KU09OLFxuICAgICAgLy8gRGVwcmVjYXRlZC4gSXQgaGFzIGFsd2F5cyBiZWVuIGJyb2tlbiwgYW55d2F5XG4gICAgICAvLyBXaWxsIHRoaW5rIGhvdyB0byBpbXBsZW1lbnQgcHJvcGVybHlcbiAgICAgIGZyb21KU09OOiBmcm9tSlNPTixcbiAgICAgIC8vIEludGVybmFsOiBkZXBlbmRlbmN5IHRyYWNraW5nXG4gICAgICBfZGVwZW5kZW50UHJvcHM6IF9kZXBlbmRlbnRQcm9wcyxcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0czogX2RlcGVuZGVudENvbnRleHRzXG4gICAgfSk7XG5cbiAgICAvLyBXcmFwIG11dGF0aW5nIGFycmF5IG1ldGhvZCB0byB1cGRhdGVcbiAgICAvLyBzdGF0ZSBhbmQgbm90aWZ5IGxpc3RlbmVyc1xuICAgIGZ1bmN0aW9uIHdyYXBBcnJheU1ldGhvZChtZXRob2QsIGZ1bmMpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdW21ldGhvZF0uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgICAgZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB0YXJnZXQucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIHRhcmdldC5wcm9wKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHByb3RvdHlwZSBhbHJlYWR5IGNvbnRhaW5zIGxlbmd0aFxuICAgICAgICAvLyBgbGVuYCBzcGVjaWZpZXMgYXJyYXkgbGVuZ3RoXG4gICAgICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgICAgICBwb3A6IHdyYXBBcnJheU1ldGhvZCgncG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgdGhpcy5sZW4sIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBwdXNoOiB3cmFwQXJyYXlNZXRob2QoJ3B1c2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCB0aGlzLmxlbiAtIDEsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICByZXZlcnNlOiB3cmFwQXJyYXlNZXRob2QoJ3JldmVyc2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzaGlmdDogd3JhcEFycmF5TWV0aG9kKCdzaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICB1bnNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3Vuc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc29ydDogd3JhcEFycmF5TWV0aG9kKCdzb3J0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc3BsaWNlOiB3cmFwQXJyYXlNZXRob2QoJ3NwbGljZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50cy5sZW5ndGggLSAyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uKCd1cGRhdGUnLCB1cGRhdGUpO1xuXG4gIC8vIENyZWF0ZSBmcmVhayBpbnN0YW5jZVxuICB2YXIgaW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gYWNjZXNzb3IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBjb25zdHJ1Y3QoaW5zdGFuY2UpO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ29tbW9uSlMgZXhwb3J0XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcpIG1vZHVsZS5leHBvcnRzID0gZnJlYWs7XG4iLCJ2YXIgUkVfREVMSU1JVEVEX1ZBUiA9IC9eXFx7XFx7KFtcXHdcXC5cXC1dKylcXH1cXH0kLztcblxuXG4vKlxuICogQXR0cmlidXRlIHJ1bGVzXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IFtcblxuICAvKipcbiAgICogdmFsdWU9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ3ZhbHVlJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0ganRtcGwuZ2V0KG1vZGVsLCBwcm9wKTtcbiAgICAgICAgICAgIGlmIChub2RlW2F0dHJdICE9PSB2YWwpIHtcbiAgICAgICAgICAgICAgbm9kZVthdHRyXSA9IHZhbCB8fCAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyB0ZXh0IGlucHV0P1xuICAgICAgICAgIHZhciBldmVudFR5cGUgPSBbJ3RleHQnLCAncGFzc3dvcmQnXS5pbmRleE9mKG5vZGUudHlwZSkgPiAtMSA/XG4gICAgICAgICAgICAna2V5dXAnIDogJ2NoYW5nZSc7IC8vIElFOSBpbmNvcmVjdGx5IHJlcG9ydHMgaXQgc3VwcG9ydHMgaW5wdXQgZXZlbnRcblxuICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZVthdHRyXSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcblxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogc2VsZWN0ZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2p0bXBsLXNlbGVjdGVkJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ09QVElPTicpIHtcbiAgICAgICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgaWYgKHNlbGVjdHNVcGRhdGluZ1tpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMCwgbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV1bal0uc2VsZWN0ZWQgPSBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bal0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLnNlbGVjdGVkID0gbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG5cbiAgICAgICAgICAgIC8vIFByb2Nlc3MgYXN5bmMsIGFzIHBhcmVudE5vZGUgaXMgc3RpbGwgZG9jdW1lbnRGcmFnbWVudFxuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIGkgPSBzZWxlY3RzLmluZGV4T2Yobm9kZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgaWYgKGkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIDxzZWxlY3Q+IHRvIGxpc3RcbiAgICAgICAgICAgICAgICBpID0gc2VsZWN0cy5wdXNoKG5vZGUucGFyZW50Tm9kZSkgLSAxO1xuICAgICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9uc1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zIGNvbnRleHRzXG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzLnB1c2goW10pO1xuICAgICAgICAgICAgICAgIC8vIEF0dGFjaCBjaGFuZ2UgbGlzdGVuZXJcbiAgICAgICAgICAgICAgICBub2RlLnBhcmVudE5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RzVXBkYXRpbmdbaV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgb2kgPSAwLCBvbGVuID0gc2VsZWN0T3B0aW9uc1tpXS5sZW5ndGg7IG9pIDwgb2xlbjsgb2krKykge1xuICAgICAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV1bb2ldKHByb3AsIHNlbGVjdE9wdGlvbnNbaV1bb2ldLnNlbGVjdGVkKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHNlbGVjdHNVcGRhdGluZ1tpXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFJlbWVtYmVyIG9wdGlvbiBhbmQgY29udGV4dFxuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zW2ldLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIH0sIDApO1xuXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgbW9kZWwocHJvcCwgdGhpcy5zZWxlY3RlZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGNoZWNrZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2p0bXBsLWNoZWNrZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF1baV0uY2hlY2tlZCA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgaWYgKCFyYWRpb0dyb3Vwc1tub2RlLm5hbWVdKSB7XG4gICAgICAgICAgICAgIC8vIEluaXQgcmFkaW8gZ3JvdXAgKFswXTogbm9kZSwgWzFdOiBtb2RlbClcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQWRkIGlucHV0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAvLyBBZGQgY29udGV4dCB0byByYWRpbyBncm91cFxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgYWxsIGlucHV0cyBmcm9tIHRoZSBncm91cFxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCwgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuY2hlY2tlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KGNoYW5nZSk7XG4gICAgICAgIH1cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGNsYXNzPVwie3sjY29uZDF9fWNsYXNzMXt7L319IHt7XmNvbmQyfX1jbGFzczJ7ey99fSAuLi5cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuXG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHN0eWxlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG5cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogYXR0cmlidXRlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBqdG1wbC5nZXQobW9kZWwsIHByb3ApO1xuICAgICAgICAgICAgcmV0dXJuIHZhbCA/XG4gICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbCkgOlxuICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH1cbl07XG4iLCIvKlxuICogTm9kZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG4gIC8qIGpzaGludCBldmlsOiB0cnVlICovXG5cbiAgLyoqXG4gICAqIHt7dmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goL15bXFx3XFwuXFwtXSskLykpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBub2RlLmlubmVySFRNTCxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtb2RlbChwcm9wKSB8fCAnJyk7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGV4dE5vZGUpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRleHROb2RlLmRhdGEgPSBqdG1wbC5nZXQobW9kZWwsIHByb3ApIHx8ICcnO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3smdmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXiYoW1xcd1xcLlxcLV0rKSQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICAvLyBBbmNob3Igbm9kZSBmb3Iga2VlcGluZyBzZWN0aW9uIGxvY2F0aW9uXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIC8vIE51bWJlciBvZiByZW5kZXJlZCBub2Rlc1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgICAgICB2YXIgaTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbC5pbm5lckhUTUwgPSBtb2RlbChwcm9wKSB8fCAnJztcbiAgICAgICAgICAgIGxlbmd0aCA9IGVsLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoZWwuY2hpbGROb2Rlc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZnJhZywgYW5jaG9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiB7ez5wYXJ0aWFsfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJsZS1xdW90ZWRcIlxuICAgIGlmIChub2RlLmlubmVySFRNTC5tYXRjaCgvPihbXFx3XFwuXFwtXSspfCcoW15cXCddKilcXCd8XCIoW15cIl0qKVwiLykpIHtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7I3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eIyhbXFx3XFwuXFwtXSspJC8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgYmxvY2s6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCwgdGVtcGxhdGUpIHtcblxuICAgICAgICAgIC8vIEFuY2hvciBub2RlIGZvciBrZWVwaW5nIHNlY3Rpb24gbG9jYXRpb25cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgLy8gTnVtYmVyIG9mIHJlbmRlcmVkIG5vZGVzXG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG4gICAgICAgICAgLy8gSG93IG1hbnkgY2hpbGROb2RlcyBpbiBvbmUgc2VjdGlvbiBpdGVtXG4gICAgICAgICAgdmFyIGNodW5rU2l6ZTtcblxuICAgICAgICAgIGZ1bmN0aW9uIHVwZGF0ZShpKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpICogY2h1bmtTaXplO1xuICAgICAgICAgICAgICB2YXIgc2l6ZSA9IGNodW5rU2l6ZTtcblxuICAgICAgICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3BvcyAtIDFdKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKFxuICAgICAgICAgICAgICAgIGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKHByb3ApKGkpKScpLFxuICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZE5vZGVzW3Bvc11cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gaW5zZXJ0KGluZGV4LCBjb3VudCkge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiBjaHVua1NpemU7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIGksIGZyYWdtZW50O1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgICAgICBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyhtb2RlbChwcm9wKShpbmRleCArIGkpKScpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShmcmFnbWVudCwgcGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICBsZW5ndGggPSBsZW5ndGggKyBzaXplO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGRlbChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcblxuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoIC0gc2l6ZTtcblxuICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IHByb3AgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwocHJvcCk7XG4gICAgICAgICAgICB2YXIgaSwgbGVuLCByZW5kZXI7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXJyYXk/XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgdmFsLm9uKCdpbnNlcnQnLCBpbnNlcnQpO1xuICAgICAgICAgICAgICB2YWwub24oJ2RlbGV0ZScsIGRlbCk7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdyZW5kZXJpbmcgJyArIHZhbC5sZW4gKyAnIHZhbHVlcycpO1xuICAgICAgICAgICAgICB2YXIgZnVuYyA9IGV2YWwodGVtcGxhdGUpO1xuICAgICAgICAgICAgICB2YXIgY2hpbGQsIGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHZhbC52YWx1ZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgZXZlbnQgZGVsZWdhdGlvbiBmb3IgYXJyYXkgaW5kZXhlc1xuICAgICAgICAgICAgICAgIHZhbC5vbignY2hhbmdlJywgaSwgdXBkYXRlKGkpKTtcbiAgICAgICAgICAgICAgICAvL3JlbmRlci5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyh2YWwoaSkpJykpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGZ1bmModmFsLnZhbHVlc1tpXSkpO1xuICAgICAgICAgICAgICAgIGNoaWxkTW9kZWwgPSB2YWwoaSk7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBmdW5jKGNoaWxkTW9kZWwpO1xuICAgICAgICAgICAgICAgIGNoaWxkLl9fanRtcGxfXyA9IGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgY2h1bmtTaXplID0gfn4obGVuZ3RoIC8gbGVuKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcodmFsKScpO1xuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGNodW5rU2l6ZSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuX19qdG1wbF9fID0gbW9kZWw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7XmludmVydGVkX3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eXFxeKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBjaGFuZ2UpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcodmFsKGkpKScpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKCF2YWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyhtb2RlbCknKTtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cblxuXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG5dO1xuIiwiLyoqXG4gKiBDb21waWxlIGEgdGVtcGxhdGUsIHBhcnNlZCBieSBAc2VlIHBhcnNlXG4gKlxuICogQHBhcmFtIHtkb2N1bWVudEZyYWdtZW50fSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtzdHJpbmd8dW5kZWZpbmVkfSBzb3VyY2VVUkwgLSBpbmNsdWRlIHNvdXJjZVVSTCB0byBhaWQgZGVidWdnaW5nXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBGdW5jdGlvbiBib2R5LCBhY2NlcHRpbmcgRnJlYWsgaW5zdGFuY2UgcGFyYW1ldGVyLCBzdWl0YWJsZSBmb3IgZXZhbCgpXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHNvdXJjZVVSTCwgZGVwdGgpIHtcblxuICB2YXIgcmksIHJ1bGVzLCBybGVuO1xuICB2YXIgbWF0Y2gsIGJsb2NrO1xuXG4gIC8vIEdlbmVyYXRlIGR5bmFtaWMgZnVuY3Rpb24gYm9keVxuICB2YXIgZnVuYyA9ICcoZnVuY3Rpb24obW9kZWwpIHtcXG4nICtcbiAgICAndmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIG5vZGU7XFxuXFxuJztcblxuICBpZiAoIWRlcHRoKSB7XG4gICAgLy8gR2xvYmFsIGJvb2trZWVwaW5nXG4gICAgZnVuYyArPVxuICAgICAgJ3ZhciByYWRpb0dyb3VwcyA9IHt9O1xcbicgK1xuICAgICAgJ3ZhciByYWRpb0dyb3Vwc1VwZGF0aW5nID0ge307XFxuJyArXG4gICAgICAndmFyIHNlbGVjdHMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0c1VwZGF0aW5nID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdE9wdGlvbnMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9uc0NvbnRleHRzID0gW107XFxuXFxuJztcbiAgfVxuXG4gIC8vIFdyYXAgbW9kZWwgaW4gYSBGcmVhayBpbnN0YW5jZSwgaWYgbmVjZXNzYXJ5XG4gIGZ1bmMgKz0gJ21vZGVsID0gdHlwZW9mIG1vZGVsID09PSBcImZ1bmN0aW9uXCIgPycgK1xuICAgICdtb2RlbCA6ICcgK1xuICAgICd0eXBlb2YgbW9kZWwgPT09IFwib2JqZWN0XCIgPycgK1xuICAgICAgJ2p0bXBsKG1vZGVsKSA6JyArXG4gICAgICAnanRtcGwoe1wiLlwiOiBtb2RlbH0pO1xcblxcbic7XG5cbiAgLy8gSXRlcmF0ZSBjaGlsZE5vZGVzXG4gIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGgsIG5vZGU7XG4gICAgICAgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcblxuICAgIHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXG4gICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgIGNhc2UgMTpcblxuICAgICAgICAvLyBqdG1wbCB0YWc/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnU0NSSVBUJyAmJiBub2RlLnR5cGUgPT09ICd0ZXh0L2p0bXBsLXRhZycpIHtcblxuICAgICAgICAgIGZvciAocmkgPSAwLCBydWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcy1ub2RlJyksIHJsZW4gPSBydWxlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlKTtcblxuICAgICAgICAgICAgLy8gUnVsZSBmb3VuZD9cbiAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgIC8vIEJsb2NrIHRhZz9cbiAgICAgICAgICAgICAgaWYgKG1hdGNoLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBGZXRjaCBibG9jayB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAoaSsrO1xuICAgICAgICAgICAgICAgICAgICAoaSA8IGxlbikgJiYgIW1hdGNoRW5kQmxvY2sobWF0Y2guYmxvY2ssIGNoaWxkTm9kZXNbaV0uaW5uZXJIVE1MIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG4gICAgICAgICAgICAgICAgICBibG9jay5hcHBlbmRDaGlsZChjaGlsZE5vZGVzW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgbWF0Y2guYmxvY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgICAnKGZyYWcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2guYmxvY2spICsgJywgJyArICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jayxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5pbm5lckhUTUwgKyAnWycgKyBpICsgJ10nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICkgKyAnKTsnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIElubGluZSB0YWdcbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgJyk7XFxuJztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFNraXAgcmVtYWluaW5nIHJ1bGVzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gZW5kIGl0ZXJhdGluZyBub2RlIHJ1bGVzXG5cbiAgICAgICAgICAvLyBUT0RPOiB3aGF0IHRvIGRvIHdpdGggbm9uLW1hdGNoaW5nIHJ1bGVzP1xuICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgIGZ1bmMgKz0gJ25vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlJFTU9WRU1FTEFURVJcIik7XFxuJztcbiAgICAgICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7XFxuJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBDcmVhdGUgZWxlbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ25vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiJyArIG5vZGUubm9kZU5hbWUgKyAnXCIpO1xcbic7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGF0dHJpYnV0ZXNcbiAgICAgICAgICAvLyBUT0RPOiBoYW5kbGUganRtcGwtIHByZWZpeGVkIGF0dHJpYnV0ZXNcbiAgICAgICAgICBmb3IgKHZhciBhaSA9IDAsIGF0dHJpYnV0ZXMgPSBub2RlLmF0dHJpYnV0ZXMsIGFsZW4gPSBhdHRyaWJ1dGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgIGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlc1thaV0udmFsdWUubWF0Y2goL1xce1xcey8pKSB7XG5cbiAgICAgICAgICAgICAgLy8gT3BlbmluZyBkZWxpbWl0ZXIgZm91bmQsIHByb2Nlc3MgYXR0cmlidXRlIHJ1bGVzXG4gICAgICAgICAgICAgIGZvciAocmkgPSAwLCBydWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcy1hdHRyJyksIHJsZW4gPSBydWxlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICByaSA8IHJsZW47IHJpKyspIHtcblxuICAgICAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUsIGF0dHJpYnV0ZXNbYWldLm5hbWUudG9Mb3dlckNhc2UoKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICAgICAgICAgICAgLy8gTWF0Y2ggZm91bmQsIGFwcGVuZCBydWxlIHRvIGZ1bmNcbiAgICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICAgJyhub2RlLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYXR0cmlidXRlc1thaV0ubmFtZSkgKyAvLyBhdHRyXG4gICAgICAgICAgICAgICAgICAgICcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2gucHJvcCkgKyAgICAgICAgICAvLyBwcm9wXG4gICAgICAgICAgICAgICAgICAgICcpO1xcbic7XG5cbiAgICAgICAgICAgICAgICAgIC8vIFNraXAgb3RoZXIgYXR0cmlidXRlIHJ1bGVzXG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG5cbiAgICAgICAgICAgICAgLy8gVE9ETzogZXh0cmFjdCBjbG9uZSBydWxlIGFzIGxhc3QgZmFsbGJhY2tcbiAgICAgICAgICAgICAgLy8gYXR0cmlidXRlIHJ1bGUgYW5kIGNsZWFuIHRoaXMgc2VjdGlvblxuXG4gICAgICAgICAgICAgIC8vIEp1c3QgY2xvbmUgdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICBmdW5jICs9ICdub2RlLnNldEF0dHJpYnV0ZShcIicgK1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNbYWldLm5hbWUgK1xuICAgICAgICAgICAgICAgICdcIiwgJyArXG4gICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYXR0cmlidXRlc1thaV0udmFsdWUpICtcbiAgICAgICAgICAgICAgICAnKTtcXG4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBpbGVcbiAgICAgICAgICBmdW5jICs9ICdub2RlLmFwcGVuZENoaWxkKCcgK1xuICAgICAgICAgICAgY29tcGlsZShcbiAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgc291cmNlVVJMICYmIChzb3VyY2VVUkwgKyAnLScgKyBub2RlLm5vZGVOYW1lICsgJ1snICsgaSArICddJyksXG4gICAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICkgKyAnKG1vZGVsKSk7XFxuJztcblxuICAgICAgICAgIC8vIEFwcGVuZCB0byBmcmFnbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgY2FzZSAzOlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG5vZGUuZGF0YSkgKyAnKSk7XFxuJztcbiAgICAgICAgYnJlYWs7XG5cblxuICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICBjYXNlIDg6XG4gICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpO1xcbic7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgfSAvLyBlbmQgc3dpdGNoXG4gIH0gLy8gZW5kIGl0ZXJhdGUgY2hpbGROb2Rlc1xuXG4gIGZ1bmMgKz0gJ3JldHVybiBmcmFnOyB9KSc7XG4gIGZ1bmMgKz0gc291cmNlVVJMID9cbiAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc291cmNlVVJMICsgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNvdXJjZVVSTCArICdcXG4nIDpcbiAgICAnJztcblxuICByZXR1cm4gZnVuYztcbn1cblxuXG5cblxuZnVuY3Rpb24gbWF0Y2hFbmRCbG9jayhibG9jaywgc3RyKSB7XG4gIHZhciBtYXRjaCA9IHN0ci5tYXRjaCgvXFwvKFtcXHdcXC5cXC1dKyk/Lyk7XG4gIHJldHVybiBtYXRjaCA/XG4gICAgYmxvY2sgPT09ICcnIHx8ICFtYXRjaFsxXSB8fCBtYXRjaFsxXSA9PT0gYmxvY2sgOlxuICAgIGZhbHNlO1xufVxuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBpbGU7XG4iLCIvKlxuXG4jIyBDb25zdGFudHNcblxuKi9cbiAgbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBSRV9JREVOVElGSUVSOiAvXltcXHdcXC5cXC1dKyQvLFxuXG4gICAgUkVfU1JDX0lERU5USUZJRVI6ICcoW1xcXFx3XFxcXC5cXFxcLV0rKScsXG5cbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJlLXF1b3RlZFwiXG4gICAgUkVfUEFSVElBTDogLz4oW1xcd1xcLlxcLV0rKXwnKFteXFwnXSopXFwnfFwiKFteXCJdKilcIi8sXG5cbiAgICBSRV9QSVBFOiAvXltcXHdcXC5cXC1dKyg/OlxcfFtcXHdcXC5cXC1dKyk/JC8sXG5cbiAgICBSRV9OT0RFX0lEOiAvXiNbXFx3XFwuXFwtXSskLyxcblxuICAgIFJFX0VORFNfV0lUSF9OT0RFX0lEOiAvLisoI1tcXHdcXC5cXC1dKykkLyxcblxuICAgIFJFX0FOWVRISU5HOiAnW1xcXFxzXFxcXFNdKj8nLFxuXG4gICAgUkVfU1BBQ0U6ICdcXFxccyonXG5cbiAgfTtcbiIsIi8qIVxuICogY29udGVudGxvYWRlZC5qc1xuICpcbiAqIEF1dGhvcjogRGllZ28gUGVyaW5pIChkaWVnby5wZXJpbmkgYXQgZ21haWwuY29tKVxuICogU3VtbWFyeTogY3Jvc3MtYnJvd3NlciB3cmFwcGVyIGZvciBET01Db250ZW50TG9hZGVkXG4gKiBVcGRhdGVkOiAyMDEwMTAyMFxuICogTGljZW5zZTogTUlUXG4gKiBWZXJzaW9uOiAxLjJcbiAqXG4gKiBVUkw6XG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9cbiAqIGh0dHA6Ly9qYXZhc2NyaXB0Lm53Ym94LmNvbS9Db250ZW50TG9hZGVkL01JVC1MSUNFTlNFXG4gKlxuICovXG5cbi8vIEB3aW4gd2luZG93IHJlZmVyZW5jZVxuLy8gQGZuIGZ1bmN0aW9uIHJlZmVyZW5jZVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb250ZW50TG9hZGVkKHdpbiwgZm4pIHtcblxuXHR2YXIgZG9uZSA9IGZhbHNlLCB0b3AgPSB0cnVlLFxuXG5cdGRvYyA9IHdpbi5kb2N1bWVudCxcblx0cm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQsXG5cdG1vZGVybiA9IGRvYy5hZGRFdmVudExpc3RlbmVyLFxuXG5cdGFkZCA9IG1vZGVybiA/ICdhZGRFdmVudExpc3RlbmVyJyA6ICdhdHRhY2hFdmVudCcsXG5cdHJlbSA9IG1vZGVybiA/ICdyZW1vdmVFdmVudExpc3RlbmVyJyA6ICdkZXRhY2hFdmVudCcsXG5cdHByZSA9IG1vZGVybiA/ICcnIDogJ29uJyxcblxuXHRpbml0ID0gZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLnR5cGUgPT0gJ3JlYWR5c3RhdGVjaGFuZ2UnICYmIGRvYy5yZWFkeVN0YXRlICE9ICdjb21wbGV0ZScpIHJldHVybjtcblx0XHQoZS50eXBlID09ICdsb2FkJyA/IHdpbiA6IGRvYylbcmVtXShwcmUgKyBlLnR5cGUsIGluaXQsIGZhbHNlKTtcblx0XHRpZiAoIWRvbmUgJiYgKGRvbmUgPSB0cnVlKSkgZm4uY2FsbCh3aW4sIGUudHlwZSB8fCBlKTtcblx0fSxcblxuXHRwb2xsID0gZnVuY3Rpb24oKSB7XG5cdFx0dHJ5IHsgcm9vdC5kb1Njcm9sbCgnbGVmdCcpOyB9IGNhdGNoKGUpIHsgc2V0VGltZW91dChwb2xsLCA1MCk7IHJldHVybjsgfVxuXHRcdGluaXQoJ3BvbGwnKTtcblx0fTtcblxuXHRpZiAoZG9jLnJlYWR5U3RhdGUgPT0gJ2NvbXBsZXRlJykgZm4uY2FsbCh3aW4sICdsYXp5Jyk7XG5cdGVsc2Uge1xuXHRcdGlmICghbW9kZXJuICYmIHJvb3QuZG9TY3JvbGwpIHtcblx0XHRcdHRyeSB7IHRvcCA9ICF3aW4uZnJhbWVFbGVtZW50OyB9IGNhdGNoKGUpIHsgfVxuXHRcdFx0aWYgKHRvcCkgcG9sbCgpO1xuXHRcdH1cblx0XHRkb2NbYWRkXShwcmUgKyAnRE9NQ29udGVudExvYWRlZCcsIGluaXQsIGZhbHNlKTtcblx0XHRkb2NbYWRkXShwcmUgKyAncmVhZHlzdGF0ZWNoYW5nZScsIGluaXQsIGZhbHNlKTtcblx0XHR3aW5bYWRkXShwcmUgKyAnbG9hZCcsIGluaXQsIGZhbHNlKTtcblx0fVxuXG59O1xuIiwiLypcblxuRXZhbHVhdGUgb2JqZWN0IGZyb20gbGl0ZXJhbCBvciBDb21tb25KUyBtb2R1bGVcblxuKi9cblxuICAgIC8qIGpzaGludCBldmlsOnRydWUgKi9cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgc3JjLCBtb2RlbCkge1xuXG4gICAgICB2YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxuICAgICAgbW9kZWwgPSBtb2RlbCB8fCB7fTtcbiAgICAgIGlmICh0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbW9kZWwgPSBqdG1wbChtb2RlbCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICBpZiAoLy8gUGx1Z2luXG4gICAgICAgICAgICAgIChwcm9wLmluZGV4T2YoJ19fJykgPT09IDAgJiZcbiAgICAgICAgICAgICAgICBwcm9wLmxhc3RJbmRleE9mKCdfXycpID09PSBwcm9wLmxlbmd0aCAtIDIpIHx8XG4gICAgICAgICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICAgICAgICAgIHR5cGVvZiBwcm9wZXJ0aWVzW3Byb3BdID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnZhbHVlc1twcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldC52YWx1ZXNbcHJvcF0gPSBwcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRhcmdldCBkb2Vzbid0IGFscmVhZHkgaGF2ZSBwcm9wP1xuICAgICAgICAgICAgaWYgKHRhcmdldChwcm9wKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldChwcm9wLCBwcm9wZXJ0aWVzW3Byb3BdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYXBwbHlQbHVnaW5zKCkge1xuICAgICAgICB2YXIgcHJvcCwgYXJnO1xuICAgICAgICBmb3IgKHByb3AgaW4ganRtcGwucGx1Z2lucykge1xuICAgICAgICAgIHBsdWdpbiA9IGp0bXBsLnBsdWdpbnNbcHJvcF07XG4gICAgICAgICAgYXJnID0gbW9kZWwudmFsdWVzWydfXycgKyBwcm9wICsgJ19fJ107XG4gICAgICAgICAgaWYgKHR5cGVvZiBwbHVnaW4gPT09ICdmdW5jdGlvbicgJiYgYXJnICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBsdWdpbi5jYWxsKG1vZGVsLCBhcmcsIHRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGV2YWxPYmplY3QoYm9keSwgc3JjKSB7XG4gICAgICAgIHZhciByZXN1bHQsIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcbiAgICAgICAgc3JjID0gc3JjID9cbiAgICAgICAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc3JjICtcbiAgICAgICAgICAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc3JjIDpcbiAgICAgICAgICAnJztcbiAgICAgICAgaWYgKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSB7XG4gICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgIHJldHVybiBldmFsKCdyZXN1bHQ9JyArIGJvZHkgKyBzcmMpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICBldmFsKGJvZHkgKyBzcmMpO1xuICAgICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSkge1xuICAgICAgICAgIC8vIEVsZW1lbnQgaW4gdGhpcyBkb2N1bWVudFxuICAgICAgICAgIHZhciBlbGVtZW50ID0gZG9jLnF1ZXJ5U2VsZWN0b3Ioc3JjKTtcbiAgICAgICAgICBtaXhpbihtb2RlbCwgZXZhbE9iamVjdChlbGVtZW50LmlubmVySFRNTCwgc3JjKSk7XG4gICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGhhc2hJbmRleCA9IHNyYy5pbmRleE9mKCcjJyk7XG4gICAgICAgICAgLy8gR2V0IG1vZGVsIHZpYSBYSFJcbiAgICAgICAgICAvLyBPbGRlciBJRXMgY29tcGxhaW4gaWYgVVJMIGNvbnRhaW5zIGhhc2hcbiAgICAgICAgICBqdG1wbCgnR0VUJywgaGFzaEluZGV4ID4gLTEgPyBzcmMuc3Vic3RyaW5nKDAsIGhhc2hJbmRleCkgOiBzcmMsXG4gICAgICAgICAgICBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICAgICAgICB2YXIgbWF0Y2ggPSBzcmMubWF0Y2goY29uc3RzLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBuZXcgRE9NUGFyc2VyKClcbiAgICAgICAgICAgICAgICAucGFyc2VGcm9tU3RyaW5nKHJlc3AsICd0ZXh0L2h0bWwnKVxuICAgICAgICAgICAgICAgIC5xdWVyeVNlbGVjdG9yKG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgbWl4aW4obW9kZWwsIGV2YWxPYmplY3QobWF0Y2ggPyBlbGVtZW50LmlubmVySFRNTCA6IHJlc3AsIHNyYykpO1xuICAgICAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICAgICAganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbG9hZFRlbXBsYXRlKCkge1xuICAgICAgICB2YXIgaGFzaEluZGV4O1xuXG4gICAgICAgIGlmICghc3JjKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHNyYy5tYXRjaChjb25zdHMuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSBpcyB0aGUgY29udGVudHMgb2YgZWxlbWVudFxuICAgICAgICAgIC8vIGJlbG9uZ2luZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbG9hZE1vZGVsKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJyksIGVsZW1lbnQuaW5uZXJIVE1MLCBkb2N1bWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgdGVtcGxhdGUgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGNvbnN0cy5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICAgIHZhciBpZnJhbWUsIGRvYztcbiAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICAgICAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgICAgICAgICAgICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgICAgIGRvYyA9IGlmcmFtZS5jb250ZW50RG9jdW1lbnQ7XG4gICAgICAgICAgICAgICAgZG9jLndyaXRlbG4ocmVzcCk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRvYyA9IGRvY3VtZW50O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgZG9jLnF1ZXJ5U2VsZWN0b3IobWF0Y2hbMV0pO1xuXG4gICAgICAgICAgICAgIGxvYWRNb2RlbChcbiAgICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJykgOiAnJyxcbiAgICAgICAgICAgICAgICBtYXRjaCA/IGVsZW1lbnQuaW5uZXJIVE1MIDogcmVzcCxcbiAgICAgICAgICAgICAgICBkb2NcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvYWRUZW1wbGF0ZSgpO1xuICAgIH07XG4iLCIvKlxuXG4jIyBNYWluIGZ1bmN0aW9uXG5cbiovXG5cbi8qIGpzaGludCBldmlsOiB0cnVlICovXG4gICAgdmFyIGNvbnN0cyA9IHJlcXVpcmUoJy4vY29uc3RzJyk7XG5cbiAgICBmdW5jdGlvbiBqdG1wbCgpIHtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgdmFyIHRhcmdldCwgdCwgdGVtcGxhdGUsIG1vZGVsO1xuXG4gICAgICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgICAgIGlmIChbJ0dFVCcsICdQT1NUJ10uaW5kZXhPZihhcmdzWzBdKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKCcuL3hocicpLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbChvYmplY3QpP1xuICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIHJldHVybiBGcmVhayBpbnN0YW5jZVxuICAgICAgICByZXR1cm4gcmVxdWlyZSgnZnJlYWsnKShhcmdzWzBdKTtcbiAgICAgIH1cblxuICAgICAgLy8ganRtcGwodGFyZ2V0KT9cbiAgICAgIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyByZXR1cm4gbW9kZWxcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSkuX19qdG1wbF9fO1xuICAgICAgfVxuXG4gICAgICAvLyBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbFssIG9wdGlvbnNdKT9cbiAgICAgIGVsc2UgaWYgKFxuICAgICAgICAoIGFyZ3NbMF0gJiYgYXJnc1swXS5ub2RlVHlwZSB8fFxuICAgICAgICAgICh0eXBlb2YgYXJnc1swXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICAoIChhcmdzWzFdICYmIHR5cGVvZiBhcmdzWzFdLmFwcGVuZENoaWxkID09PSAnZnVuY3Rpb24nKSB8fFxuICAgICAgICAgICh0eXBlb2YgYXJnc1sxXSA9PT0gJ3N0cmluZycpXG4gICAgICAgICkgJiZcblxuICAgICAgICBhcmdzWzJdICE9PSB1bmRlZmluZWRcblxuICAgICAgKSB7XG5cbiAgICAgICAgdGFyZ2V0ID0gYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlICA/XG4gICAgICAgICAgYXJnc1swXSA6XG4gICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzBdKTtcblxuICAgICAgICB0ZW1wbGF0ZSA9IGFyZ3NbMV0ubWF0Y2goY29uc3RzLlJFX05PREVfSUQpID9cbiAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMV0pLmlubmVySFRNTCA6XG4gICAgICAgICAgYXJnc1sxXTtcblxuICAgICAgICBtb2RlbCA9XG4gICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICAgICAgICBhcmdzWzJdIDpcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSB3cmFwXG4gICAgICAgICAgICBqdG1wbChcbiAgICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnID9cbiAgICAgICAgICAgICAgICAvLyBvYmplY3RcbiAgICAgICAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJyAmJiBhcmdzWzJdLm1hdGNoKGNvbnN0cy5SRV9OT0RFX0lEKSA/XG4gICAgICAgICAgICAgICAgICAvLyBzcmMsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgIHJlcXVpcmUoJy4vbG9hZGVyJylcbiAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1syXSkuaW5uZXJIVE1MKSA6XG5cbiAgICAgICAgICAgICAgICAgIC8vIHNpbXBsZSB2YWx1ZSwgYm94IGl0XG4gICAgICAgICAgICAgICAgICB7Jy4nOiBhcmdzWzJdfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBpZiAodGFyZ2V0Lm5vZGVOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgICAgIHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICB0LmlkID0gdGFyZ2V0LmlkO1xuICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0LCB0YXJnZXQpO1xuICAgICAgICAgIHRhcmdldCA9IHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NvY2lhdGUgdGFyZ2V0IGFuZCBtb2RlbFxuICAgICAgICB0YXJnZXQuX19qdG1wbF9fID0gbW9kZWw7XG5cbiAgICAgICAgLy8gRW1wdHkgdGFyZ2V0XG4gICAgICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICAvLyBBc3NpZ24gY29tcGlsZWQgdGVtcGxhdGVcbiAgICAgICAgLy90YXJnZXQuYXBwZW5kQ2hpbGQocmVxdWlyZSgnLi9jb21waWxlcicpKHRlbXBsYXRlLCBtb2RlbCwgYXJnc1szXSkpO1xuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgZXZhbChcbiAgICAgICAgICAgIGp0bXBsLmNvbXBpbGUoXG4gICAgICAgICAgICAgIGp0bXBsLnBhcnNlKHRlbXBsYXRlKSxcbiAgICAgICAgICAgICAgdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpXG4gICAgICAgICAgICApICsgJyhtb2RlbCknXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuXG5cbi8qXG5cbk9uIHBhZ2UgcmVhZHksIHByb2Nlc3MganRtcGwgdGFyZ2V0c1xuXG4qL1xuXG4gICAgcmVxdWlyZSgnLi9jb250ZW50LWxvYWRlZCcpKHdpbmRvdywgZnVuY3Rpb24oKSB7XG5cbiAgICAgIHZhciBsb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcicpO1xuICAgICAgdmFyIHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qdG1wbF0nKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRhcmdldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgbG9hZGVyKHRhcmdldHNbaV0sIHRhcmdldHNbaV0uZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJykpO1xuICAgICAgfVxuICAgIH0pO1xuXG5cblxuLypcblxuRXhwb3NlIG5ldy1nZW5lcmF0aW9uIGNvbXBpbGVyIGZvciBleHBlcmltZW50aW5nXG5cbiovXG5cbiAgICBqdG1wbC5wYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbiAgICBqdG1wbC5jb21waWxlID0gcmVxdWlyZSgnLi9jb21waWxlJyk7XG4gICAganRtcGwuZ2V0ID0gZnVuY3Rpb24obW9kZWwsIHByb3ApIHtcbiAgICAgIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICBKU09OLnN0cmluZ2lmeSh2YWwudmFsdWVzKSA6XG4gICAgICAgIHZhbDtcbiAgICB9O1xuXG5cbi8qXG5cblBsdWdpbnNcblxuKi9cblxuICAgIGp0bXBsLnBsdWdpbnMgPSB7XG4gICAgICBpbml0OiBmdW5jdGlvbihhcmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgICAgLy8gQ2FsbCBhc3luYywgYWZ0ZXIganRtcGwgaGFzIGNvbnN0cnVjdGVkIHRoZSBET01cbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYXJnLmNhbGwodGhhdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG5cbi8qXG5cbkV4cG9ydFxuXG4qL1xuICAgIG1vZHVsZS5leHBvcnRzID0ganRtcGw7XG4iLCIvKipcbiAqIFBhcnNlIGEgdGV4dCB0ZW1wbGF0ZSB0byBET00gc3RydWN0dXJlIHJlYWR5IGZvciBjb21waWxpbmdcbiAqIEBzZWUgY29tcGlsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5mdW5jdGlvbiBwYXJzZSh0ZW1wbGF0ZSkge1xuXG4gIHZhciBpZnJhbWUsIGJvZHk7XG5cbiAgZnVuY3Rpb24gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSkge1xuXG4gICAgLy8gcmVwbGFjZSB7e3t0YWd9fX0gd2l0aCB7eyZ0YWd9fVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgvXFx7XFx7XFx7KFtcXFNcXHNdKj8pXFx9XFx9XFx9L2csICd7eyYkMX19Jyk7XG5cbiAgICAvLyAxLiB3cmFwIGVhY2ggbm9uLWF0dHJpYnV0ZSB0YWcgaW4gPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj5cbiAgICAvLyAyLiByZW1vdmUgTXVzdGFjaGUgY29tbWVudHNcbiAgICAvLyBUT0RPOiBoYW5kbGUgdGFncyBpbiBIVE1MIGNvbW1lbnRzXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG1hdGNoMSwgcG9zKSB7XG4gICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaCgvPFtcXHdcXC1dK1tePl0qPyQvKTtcbiAgICAgICAgdmFyIG9wZW5pbmcgPSBoZWFkLm1hdGNoKC88KHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgY2xvc2luZyA9IGhlYWQubWF0Y2goLzxcXC8oc2NyaXB0fFNDUklQVCkvZyk7XG4gICAgICAgIHZhciBpbnNpZGVTY3JpcHQgPVxuICAgICAgICAgICAgKG9wZW5pbmcgJiYgb3BlbmluZy5sZW5ndGggfHwgMCkgPiAoY2xvc2luZyAmJiBjbG9zaW5nLmxlbmd0aCB8fCAwKTtcbiAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgP1xuICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgIGluc2lkZVNjcmlwdCA/XG4gICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICAnPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj4nICsgbWF0Y2gxLnRyaW0oKSArICdcXHgzQy9zY3JpcHQ+JztcbiAgICAgIH1cbiAgICApO1xuICAgIC8vIHByZWZpeCAnc2VsZWN0ZWQnIGFuZCAnY2hlY2tlZCcgYXR0cmlidXRlcyB3aXRoICdqdG1wbC0nXG4gICAgLy8gKHRvIGF2b2lkIFwic3BlY2lhbFwiIHByb2Nlc3NpbmcsIG9oIElFOClcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzpvcHRpb258T1BUSU9OKVtePl0qPykoPzpzZWxlY3RlZHxTRUxFQ1RFRCk9L2csXG4gICAgICAnJDFqdG1wbC1zZWxlY3RlZD0nKTtcblxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/OmlucHV0fElOUFVUKVtePl0qPykoPzpjaGVja2VkfENIRUNLRUQpPS9nLFxuICAgICAgJyQxanRtcGwtY2hlY2tlZD0nKTtcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIHRlbXBsYXRlID0gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSk7XG4gIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICBpZnJhbWUuY29udGVudERvY3VtZW50LndyaXRlbG4oJzwhZG9jdHlwZSBodG1sPlxcbjxodG1sPjxib2R5PicgKyB0ZW1wbGF0ZSArICc8L2JvZHk+PC9odG1sPicpO1xuICBib2R5ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5ib2R5O1xuICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiLypcblxuUmVxdWVzdHMgQVBJXG5cbiovXG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGxlbiwgcHJvcCwgcHJvcHMsIHJlcXVlc3Q7XG4gICAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAvLyBMYXN0IGZ1bmN0aW9uIGFyZ3VtZW50XG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnJlZHVjZShcbiAgICAgICAgZnVuY3Rpb24gKHByZXYsIGN1cnIpIHtcbiAgICAgICAgICByZXR1cm4gdHlwZW9mIGN1cnIgPT09ICdmdW5jdGlvbicgPyBjdXJyIDogcHJldjtcbiAgICAgICAgfSxcbiAgICAgICAgbnVsbFxuICAgICAgKTtcblxuICAgICAgdmFyIG9wdHMgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG5cbiAgICAgIGlmICh0eXBlb2Ygb3B0cyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGkgPSAwLCBwcm9wcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9wdHMpLCBsZW4gPSBwcm9wcy5sZW5ndGg7XG4gICAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHByb3AgPSBwcm9wc1tpXTtcbiAgICAgICAgeGhyW3Byb3BdID0gb3B0c1twcm9wXTtcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdCA9XG4gICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ3N0cmluZycpID9cblxuICAgICAgICAgIC8vIFN0cmluZyBwYXJhbWV0ZXJzXG4gICAgICAgICAgYXJnc1syXSA6XG5cbiAgICAgICAgICAodHlwZW9mIGFyZ3NbMl0gPT09ICdvYmplY3QnKSA/XG5cbiAgICAgICAgICAgIC8vIE9iamVjdCBwYXJhbWV0ZXJzLiBTZXJpYWxpemUgdG8gVVJJXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhhcmdzWzJdKS5tYXAoXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geCArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChhcmdzWzJdW3hdKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKS5qb2luKCcmJykgOlxuXG4gICAgICAgICAgICAvLyBObyBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAnJztcblxuICAgICAgdmFyIG9ubG9hZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHZhciByZXNwO1xuXG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXNwID0gdGhpcy5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgcmVzcCwgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgIGlmICh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSB7XG4gICAgICAgICAgICBvbmxvYWQuY2FsbCh0aGlzLCAnZG9uZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdqdG1wbCBYSFIgZXJyb3I6ICcgKyB0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB4aHIub3BlbihhcmdzWzBdLCBhcmdzWzFdLFxuICAgICAgICAob3B0cy5hc3luYyAhPT0gdW5kZWZpbmVkID8gb3B0cy5hc3luYyA6IHRydWUpLFxuICAgICAgICBvcHRzLnVzZXIsIG9wdHMucGFzc3dvcmQpO1xuXG4gICAgICB4aHIuc2VuZChyZXF1ZXN0KTtcblxuICAgICAgcmV0dXJuIHhocjtcblxuICAgIH07XG4iXX0=
(8)
});
