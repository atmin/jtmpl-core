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

},{}],6:[function(_dereq_,module,exports){
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

},{}],7:[function(_dereq_,module,exports){
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

_dereq_('./content-loaded')(window, function() {

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

},{"./compile":4,"./content-loaded":5,"./loader":6,"./parse":8,"./utemplate":9,"./xhr":10,"freak":1}],8:[function(_dereq_,module,exports){
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

},{}],9:[function(_dereq_,module,exports){
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

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1hdHRyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1ub2RlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2NvbnRlbnQtbG9hZGVkLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbG9hZGVyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvbWFpbi5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3BhcnNlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvdXRlbXBsYXRlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMveGhyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZyZWFrKG9iaiwgcm9vdCwgcGFyZW50LCBwcm9wKSB7XG5cbiAgdmFyIGxpc3RlbmVycyA9IHtcbiAgICAnY2hhbmdlJzoge30sXG4gICAgJ3VwZGF0ZSc6IHt9LFxuICAgICdpbnNlcnQnOiB7fSxcbiAgICAnZGVsZXRlJzoge31cbiAgfTtcbiAgdmFyIF9kZXBlbmRlbnRQcm9wcyA9IHt9O1xuICB2YXIgX2RlcGVuZGVudENvbnRleHRzID0ge307XG4gIHZhciBjYWNoZSA9IHt9O1xuICB2YXIgY2hpbGRyZW4gPSB7fTtcblxuICAvLyBBc3NlcnQgY29uZGl0aW9uXG4gIGZ1bmN0aW9uIGFzc2VydChjb25kLCBtc2cpIHtcbiAgICBpZiAoIWNvbmQpIHtcbiAgICAgIHRocm93IG1zZyB8fCAnYXNzZXJ0aW9uIGZhaWxlZCc7XG4gICAgfVxuICB9XG5cbiAgLy8gTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXRcbiAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBwcm9wZXJ0aWVzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvcGVydGllcyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbcHJvcHNbaV1dID0gcHJvcGVydGllc1twcm9wc1tpXV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVlcEVxdWFsKHgsIHkpIHtcbiAgICBpZiAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJlxuICAgICAgICB0eXBlb2YgeSA9PT0gXCJvYmplY3RcIiAmJiB5ICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChPYmplY3Qua2V5cyh4KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKHkpLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIHByb3AgaW4geCkge1xuICAgICAgICBpZiAoeC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGlmICh5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh4W3Byb3BdLCB5W3Byb3BdKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSBpZiAoeCAhPT0geSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gRXZlbnQgZnVuY3Rpb25zXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IFsnc3RyaW5nJywgJ251bWJlciddLmluZGV4T2YodHlwZW9mIGFyZ3VtZW50c1sxXSkgPiAtMSA/XG4gICAgICBhcmd1bWVudHNbMV0gOiBudWxsO1xuICAgIHZhciBjYWxsYmFjayA9XG4gICAgICB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgYXJndW1lbnRzWzFdIDpcbiAgICAgICAgdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgYXJndW1lbnRzWzJdIDogbnVsbDtcblxuICAgIC8vIEFyZ3MgY2hlY2tcbiAgICBhc3NlcnQoWydjaGFuZ2UnLCAndXBkYXRlJywgJ2luc2VydCcsICdkZWxldGUnXS5pbmRleE9mKGV2ZW50KSA+IC0xKTtcbiAgICBhc3NlcnQoXG4gICAgICAoWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xICYmIHByb3AgIT09IG51bGwpIHx8XG4gICAgICAoWydpbnNlcnQnLCAnZGVsZXRlJywgJ3VwZGF0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCA9PT0gbnVsbClcbiAgICApO1xuXG4gICAgLy8gSW5pdCBsaXN0ZW5lcnMgZm9yIHByb3BcbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgLy8gQWxyZWFkeSByZWdpc3RlcmVkP1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYWxsIG9yIHNwZWNpZmllZCBsaXN0ZW5lcnMgZ2l2ZW4gZXZlbnQgYW5kIHByb3BlcnR5XG4gIGZ1bmN0aW9uIG9mZigpIHtcbiAgICB2YXIgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgdmFyIHByb3AgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJyA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKCFsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdKSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgYWxsIHByb3BlcnR5IHdhdGNoZXJzP1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0gPSBbXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBSZW1vdmUgc3BlY2lmaWMgY2FsbGJhY2tcbiAgICAgIGkgPSBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGkgPiAtMSkge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxuXG4gIC8vIHRyaWdnZXIoJ2NoYW5nZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ3VwZGF0ZScsIHByb3ApXG4gIC8vIHRyaWdnZXIoJ2luc2VydCcgb3IgJ2RlbGV0ZScsIGluZGV4LCBjb3VudClcbiAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgYSwgYikge1xuICAgIHZhciBoYW5kbGVycyA9IChsaXN0ZW5lcnNbZXZlbnRdW1snY2hhbmdlJ10uaW5kZXhPZihldmVudCkgPiAtMSA/IGEgOiBudWxsXSB8fCBbXSk7XG4gICAgdmFyIGksIGxlbiA9IGhhbmRsZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGhhbmRsZXJzW2ldLmNhbGwoaW5zdGFuY2UsIGEsIGIpO1xuICAgIH07XG4gIH1cblxuICAvLyBFeHBvcnQgbW9kZWwgdG8gSlNPTiBzdHJpbmdcbiAgLy8gTk9UIGV4cG9ydGVkOlxuICAvLyAtIHByb3BlcnRpZXMgc3RhcnRpbmcgd2l0aCBfIChQeXRob24gcHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbnZlbnRpb24pXG4gIC8vIC0gY29tcHV0ZWQgcHJvcGVydGllcyAoZGVyaXZlZCBmcm9tIG5vcm1hbCBwcm9wZXJ0aWVzKVxuICBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgZnVuY3Rpb24gZmlsdGVyKG9iaikge1xuICAgICAgdmFyIGtleSwgZmlsdGVyZWQgPSBBcnJheS5pc0FycmF5KG9iaikgPyBbXSA6IHt9O1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IGZpbHRlcihvYmpba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9ialtrZXldICE9PSAnZnVuY3Rpb24nICYmIGtleVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmaWx0ZXIob2JqKSk7XG4gIH1cblxuICAvLyBMb2FkIG1vZGVsIGZyb20gSlNPTiBzdHJpbmcgb3Igb2JqZWN0XG4gIGZ1bmN0aW9uIGZyb21KU09OKGRhdGEpIHtcbiAgICB2YXIga2V5O1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH1cbiAgICBmb3IgKGtleSBpbiBkYXRhKSB7XG4gICAgICBpbnN0YW5jZShrZXksIGRhdGFba2V5XSk7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBrZXkpO1xuICAgIH1cbiAgICBpbnN0YW5jZS5sZW4gPSBvYmoubGVuZ3RoO1xuICB9XG5cbiAgLy8gVXBkYXRlIGhhbmRsZXI6IHJlY2FsY3VsYXRlIGRlcGVuZGVudCBwcm9wZXJ0aWVzLFxuICAvLyB0cmlnZ2VyIGNoYW5nZSBpZiBuZWNlc3NhcnlcbiAgZnVuY3Rpb24gdXBkYXRlKHByb3ApIHtcbiAgICBpZiAoIWRlZXBFcXVhbChjYWNoZVtwcm9wXSwgZ2V0KHByb3AsIGZ1bmN0aW9uKCkge30sIHRydWUpKSkge1xuICAgICAgdHJpZ2dlcignY2hhbmdlJywgcHJvcCk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGRlcGVuZGVudHNcbiAgICBmb3IgKHZhciBpID0gMCwgZGVwID0gX2RlcGVuZGVudFByb3BzW3Byb3BdIHx8IFtdLCBsZW4gPSBkZXAubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlbGV0ZSBjaGlsZHJlbltkZXBbaV1dO1xuICAgICAgX2RlcGVuZGVudENvbnRleHRzW3Byb3BdW2ldLnRyaWdnZXIoJ3VwZGF0ZScsIGRlcFtpXSk7XG4gICAgfVxuXG4gICAgaWYgKGluc3RhbmNlLnBhcmVudCkge1xuICAgICAgLy8gTm90aWZ5IGNvbXB1dGVkIHByb3BlcnRpZXMsIGRlcGVuZGluZyBvbiBwYXJlbnQgb2JqZWN0XG4gICAgICBpbnN0YW5jZS5wYXJlbnQudHJpZ2dlcigndXBkYXRlJywgaW5zdGFuY2UucHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJveHkgdGhlIGFjY2Vzc29yIGZ1bmN0aW9uIHRvIHJlY29yZFxuICAvLyBhbGwgYWNjZXNzZWQgcHJvcGVydGllc1xuICBmdW5jdGlvbiBnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSB7XG4gICAgZnVuY3Rpb24gdHJhY2tlcihjb250ZXh0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oX3Byb3AsIF9hcmcpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0pIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0gPSBbXTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLmluZGV4T2YocHJvcCkgPT09IC0xKSB7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50UHJvcHNbX3Byb3BdLnB1c2gocHJvcCk7XG4gICAgICAgICAgY29udGV4dC5fZGVwZW5kZW50Q29udGV4dHNbX3Byb3BdLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXh0KF9wcm9wLCBfYXJnLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRyYWNrZXIoaW5zdGFuY2UpO1xuICAgIGNvbnN0cnVjdChyZXN1bHQpO1xuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgIHJlc3VsdC5wYXJlbnQgPSB0cmFja2VyKHBhcmVudCk7XG4gICAgfVxuICAgIHJlc3VsdC5yb290ID0gdHJhY2tlcihyb290IHx8IGluc3RhbmNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2hhbGxvdyBjbG9uZSBhbiBvYmplY3RcbiAgZnVuY3Rpb24gc2hhbGxvd0Nsb25lKG9iaikge1xuICAgIHZhciBrZXksIGNsb25lO1xuICAgIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNsb25lID0ge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgY2xvbmVba2V5XSA9IG9ialtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNsb25lID0gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cblxuICAvLyBHZXR0ZXIgZm9yIHByb3AsIGlmIGNhbGxiYWNrIGlzIGdpdmVuXG4gIC8vIGNhbiByZXR1cm4gYXN5bmMgdmFsdWVcbiAgZnVuY3Rpb24gZ2V0KHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciB2YWwgPSBvYmpbcHJvcF07XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhbCA9IHZhbC5jYWxsKGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApLCBjYWxsYmFjayk7XG4gICAgICBpZiAoIXNraXBDYWNoaW5nKSB7XG4gICAgICAgIGNhY2hlW3Byb3BdID0gKHZhbCA9PT0gdW5kZWZpbmVkKSA/IHZhbCA6IHNoYWxsb3dDbG9uZSh2YWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgIGNhY2hlW3Byb3BdID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0dGVyKHByb3AsIGNhbGxiYWNrLCBza2lwQ2FjaGluZykge1xuICAgIHZhciByZXN1bHQgPSBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKTtcblxuICAgIHJldHVybiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gJ29iamVjdCcgP1xuICAgICAgLy8gV3JhcCBvYmplY3RcbiAgICAgIGNoaWxkcmVuW3Byb3BdID9cbiAgICAgICAgY2hpbGRyZW5bcHJvcF0gOlxuICAgICAgICBjaGlsZHJlbltwcm9wXSA9IGZyZWFrKHJlc3VsdCwgcm9vdCB8fCBpbnN0YW5jZSwgaW5zdGFuY2UsIHByb3ApIDpcbiAgICAgIC8vIFNpbXBsZSB2YWx1ZVxuICAgICAgcmVzdWx0O1xuICB9XG5cbiAgLy8gU2V0IHByb3AgdG8gdmFsXG4gIGZ1bmN0aW9uIHNldHRlcihwcm9wLCB2YWwpIHtcbiAgICB2YXIgb2xkVmFsID0gZ2V0KHByb3ApO1xuXG4gICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5IHNldHRlclxuICAgICAgb2JqW3Byb3BdLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIHZhbCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gU2ltcGxlIHByb3BlcnR5XG4gICAgICBvYmpbcHJvcF0gPSB2YWw7XG4gICAgICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGRlbGV0ZSBjYWNoZVtwcm9wXTtcbiAgICAgICAgZGVsZXRlIGNoaWxkcmVuW3Byb3BdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvbGRWYWwgIT09IHZhbCkge1xuICAgICAgdHJpZ2dlcigndXBkYXRlJywgcHJvcCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRnVuY3Rpb25hbCBhY2Nlc3NvciwgdW5pZnkgZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgZnVuY3Rpb24gYWNjZXNzb3IocHJvcCwgYXJnLCBza2lwQ2FjaGluZykge1xuICAgIHJldHVybiAoXG4gICAgICAoYXJnID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJykgP1xuICAgICAgICBnZXR0ZXIgOiBzZXR0ZXJcbiAgICApKHByb3AsIGFyZywgc2tpcENhY2hpbmcpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgZnVuY3Rpb24gY29uc3RydWN0KHRhcmdldCkge1xuICAgIG1peGluKHRhcmdldCwge1xuICAgICAgdmFsdWVzOiBvYmosXG4gICAgICBwYXJlbnQ6IHBhcmVudCB8fCBudWxsLFxuICAgICAgcm9vdDogcm9vdCB8fCB0YXJnZXQsXG4gICAgICBwcm9wOiBwcm9wID09PSB1bmRlZmluZWQgPyBudWxsIDogcHJvcCxcbiAgICAgIC8vIC5vbihldmVudFssIHByb3BdLCBjYWxsYmFjaylcbiAgICAgIG9uOiBvbixcbiAgICAgIC8vIC5vZmYoZXZlbnRbLCBwcm9wXVssIGNhbGxiYWNrXSlcbiAgICAgIG9mZjogb2ZmLFxuICAgICAgLy8gLnRyaWdnZXIoZXZlbnRbLCBwcm9wXSlcbiAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICB0b0pTT046IHRvSlNPTixcbiAgICAgIC8vIERlcHJlY2F0ZWQuIEl0IGhhcyBhbHdheXMgYmVlbiBicm9rZW4sIGFueXdheVxuICAgICAgLy8gV2lsbCB0aGluayBob3cgdG8gaW1wbGVtZW50IHByb3Blcmx5XG4gICAgICBmcm9tSlNPTjogZnJvbUpTT04sXG4gICAgICAvLyBJbnRlcm5hbDogZGVwZW5kZW5jeSB0cmFja2luZ1xuICAgICAgX2RlcGVuZGVudFByb3BzOiBfZGVwZW5kZW50UHJvcHMsXG4gICAgICBfZGVwZW5kZW50Q29udGV4dHM6IF9kZXBlbmRlbnRDb250ZXh0c1xuICAgIH0pO1xuXG4gICAgLy8gV3JhcCBtdXRhdGluZyBhcnJheSBtZXRob2QgdG8gdXBkYXRlXG4gICAgLy8gc3RhdGUgYW5kIG5vdGlmeSBsaXN0ZW5lcnNcbiAgICBmdW5jdGlvbiB3cmFwQXJyYXlNZXRob2QobWV0aG9kLCBmdW5jKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXVttZXRob2RdLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5sZW4gPSB0aGlzLnZhbHVlcy5sZW5ndGg7XG4gICAgICAgIGNhY2hlID0ge307XG4gICAgICAgIGNoaWxkcmVuID0ge307XG4gICAgICAgIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdGFyZ2V0LnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCB0YXJnZXQucHJvcCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICAgIG1peGluKHRhcmdldCwge1xuICAgICAgICAvLyBGdW5jdGlvbiBwcm90b3R5cGUgYWxyZWFkeSBjb250YWlucyBsZW5ndGhcbiAgICAgICAgLy8gYGxlbmAgc3BlY2lmaWVzIGFycmF5IGxlbmd0aFxuICAgICAgICBsZW46IG9iai5sZW5ndGgsXG5cbiAgICAgICAgcG9wOiB3cmFwQXJyYXlNZXRob2QoJ3BvcCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIHRoaXMubGVuLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcHVzaDogd3JhcEFycmF5TWV0aG9kKCdwdXNoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgdGhpcy5sZW4gLSAxLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgcmV2ZXJzZTogd3JhcEFycmF5TWV0aG9kKCdyZXZlcnNlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc2hpZnQ6IHdyYXBBcnJheU1ldGhvZCgnc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgdW5zaGlmdDogd3JhcEFycmF5TWV0aG9kKCd1bnNoaWZ0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgMSk7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNvcnQ6IHdyYXBBcnJheU1ldGhvZCgnc29ydCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgIH0pLFxuXG4gICAgICAgIHNwbGljZTogd3JhcEFycmF5TWV0aG9kKCdzcGxpY2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHMubGVuZ3RoIC0gMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvbigndXBkYXRlJywgdXBkYXRlKTtcblxuICAvLyBDcmVhdGUgZnJlYWsgaW5zdGFuY2VcbiAgdmFyIGluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGFjY2Vzc29yLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgLy8gQXR0YWNoIGluc3RhbmNlIG1lbWJlcnNcbiAgY29uc3RydWN0KGluc3RhbmNlKTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENvbW1vbkpTIGV4cG9ydFxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSBtb2R1bGUuZXhwb3J0cyA9IGZyZWFrO1xuIiwidmFyIFJFX0RFTElNSVRFRF9WQVIgPSAvXlxce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9JC87XG5cblxuLypcbiAqIEF0dHJpYnV0ZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoqXG4gICAqIHZhbHVlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICd2YWx1ZScgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGp0bXBsLl9nZXQobW9kZWwsIHByb3ApO1xuICAgICAgICAgICAgaWYgKG5vZGVbYXR0cl0gIT09IHZhbCkge1xuICAgICAgICAgICAgICBub2RlW2F0dHJdID0gdmFsIHx8ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHRleHQgaW5wdXQ/XG4gICAgICAgICAgdmFyIGV2ZW50VHlwZSA9IFsndGV4dCcsICdwYXNzd29yZCddLmluZGV4T2Yobm9kZS50eXBlKSA+IC0xID9cbiAgICAgICAgICAgICdrZXl1cCcgOiAnY2hhbmdlJzsgLy8gSUU5IGluY29yZWN0bHkgcmVwb3J0cyBpdCBzdXBwb3J0cyBpbnB1dCBldmVudFxuXG4gICAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBtb2RlbChwcm9wLCBub2RlW2F0dHJdKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBzZWxlY3RlZD1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChhdHRyID09PSAnanRtcGwtc2VsZWN0ZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoc2VsZWN0c1VwZGF0aW5nW2ldKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAodmFyIGogPSAwLCBsZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXVtqXS5zZWxlY3RlZCA9IHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtqXShwcm9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGUuc2VsZWN0ZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ09QVElPTicpIHtcblxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhc3luYywgYXMgcGFyZW50Tm9kZSBpcyBzdGlsbCBkb2N1bWVudEZyYWdtZW50XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgaSA9IHNlbGVjdHMuaW5kZXhPZihub2RlLnBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgPHNlbGVjdD4gdG8gbGlzdFxuICAgICAgICAgICAgICAgIGkgPSBzZWxlY3RzLnB1c2gobm9kZS5wYXJlbnROb2RlKSAtIDE7XG4gICAgICAgICAgICAgICAgLy8gSW5pdCBvcHRpb25zXG4gICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9ucy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICAvLyBJbml0IG9wdGlvbnMgY29udGV4dHNcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoIGNoYW5nZSBsaXN0ZW5lclxuICAgICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGVjdHNVcGRhdGluZ1tpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBvaSA9IDAsIG9sZW4gPSBzZWxlY3RPcHRpb25zW2ldLmxlbmd0aDsgb2kgPCBvbGVuOyBvaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0c1tpXVtvaV0ocHJvcCwgc2VsZWN0T3B0aW9uc1tpXVtvaV0uc2VsZWN0ZWQpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc2VsZWN0c1VwZGF0aW5nW2ldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gUmVtZW1iZXIgb3B0aW9uIGFuZCBjb250ZXh0XG4gICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNbaV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBtb2RlbChwcm9wLCB0aGlzLnNlbGVjdGVkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGNoZWNrZWQ9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ2p0bXBsLWNoZWNrZWQnICYmIG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm5hbWUpIHtcbiAgICAgICAgICAgICAgaWYgKHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF1baV0uY2hlY2tlZCA9IHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBub2RlLmNoZWNrZWQgPSBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyByYWRpbyBncm91cD9cbiAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgaWYgKCFyYWRpb0dyb3Vwc1tub2RlLm5hbWVdKSB7XG4gICAgICAgICAgICAgIC8vIEluaXQgcmFkaW8gZ3JvdXAgKFswXTogbm9kZSwgWzFdOiBtb2RlbClcbiAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXSA9IFtbXSwgW11dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQWRkIGlucHV0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAvLyBBZGQgY29udGV4dCB0byByYWRpbyBncm91cFxuICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXS5wdXNoKG1vZGVsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSAncmFkaW8nICYmIG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgYWxsIGlucHV0cyBmcm9tIHRoZSBncm91cFxuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMV1baV0ocHJvcCwgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1VwZGF0aW5nW25vZGUubmFtZV0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAvLyBVcGRhdGUgY3VycmVudCBpbnB1dCBvbmx5XG4gICAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGUuY2hlY2tlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KGNoYW5nZSk7XG4gICAgICAgIH1cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIGF0dHJpYnV0ZT1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0ganRtcGwuX2dldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICByZXR1cm4gdmFsID9cbiAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKSA6XG4gICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogRmFsbGJhY2sgcnVsZSwgcHJvY2VzcyB2aWEgQHNlZSB1dGVtcGxhdGVcbiAgICogU3RyaXAganRtcGwtIHByZWZpeFxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHJldHVybiB7XG4gICAgICBwcm9wOiBub2RlLmdldEF0dHJpYnV0ZShhdHRyKSxcbiAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG4gICAgICAgIHZhciBhdHRyTmFtZSA9IGF0dHIucmVwbGFjZSgnanRtcGwtJywgJycpO1xuICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXG4gICAgICAgICAgICBhdHRyTmFtZSxcbiAgICAgICAgICAgIGp0bXBsLnV0ZW1wbGF0ZShwcm9wLCBtb2RlbCwgY2hhbmdlKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY2hhbmdlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG5dO1xuIiwiLypcbiAqIE5vZGUgcnVsZXNcbiAqXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gW1xuXG4gIC8qIGpzaGludCBldmlsOiB0cnVlICovXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7dmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZiAobm9kZS5pbm5lckhUTUwubWF0Y2goL15bXFx3XFwuXFwtXSskLykpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBub2RlLmlubmVySFRNTCxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShqdG1wbC5fZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJyk7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGV4dE5vZGUpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRleHROb2RlLmRhdGEgPSBqdG1wbC5fZ2V0KG1vZGVsLCBwcm9wKSB8fCAnJztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7JnZhcn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14mKFtcXHdcXC5cXC1dKykkLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYm9keScpO1xuICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgcmVuZGVyaW5nXG4gICAgICAgICAgICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGFuY2hvci5wcmV2aW91c1NpYmxpbmcpO1xuICAgICAgICAgICAgICBsZW5ndGgtLTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gbW9kZWwocHJvcCkgfHwgJyc7XG4gICAgICAgICAgICBsZW5ndGggPSBlbC5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmcmFnLmFwcGVuZENoaWxkKGVsLmNoaWxkTm9kZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGZyYWcsIGFuY2hvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3s+cGFydGlhbH19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgLy8gbWF0Y2g6IFsxXT12YXJfbmFtZSwgWzJdPSdzaW5nbGUtcXVvdGVkJyBbM109XCJkb3VibGUtcXVvdGVkXCJcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvPihbXFx3XFwuXFwtXSspfCcoW15cXCddKilcXCd8XCIoW15cIl0qKVwiLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2gsXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBtYXRjaCkge1xuXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIHZhciB0YXJnZXQ7XG5cbiAgICAgICAgICBmdW5jdGlvbiBsb2FkZXIoKSB7XG4gICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgICB0YXJnZXQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGp0bXBsLmxvYWRlcihcbiAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICBtYXRjaFsxXSA/XG4gICAgICAgICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICAgICAgICBtb2RlbChtYXRjaFsxXSkgOlxuICAgICAgICAgICAgICAgIC8vIExpdGVyYWxcbiAgICAgICAgICAgICAgICBtYXRjaFsyXSB8fCBtYXRjaFszXSxcbiAgICAgICAgICAgICAgbW9kZWxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChtYXRjaFsxXSkge1xuICAgICAgICAgICAgLy8gVmFyaWFibGVcbiAgICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBtYXRjaFsxXSwgbG9hZGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICAvLyBMb2FkIGFzeW5jXG4gICAgICAgICAgc2V0VGltZW91dChsb2FkZXIpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3sjc2VjdGlvbn19XG4gICAqL1xuICBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5pbm5lckhUTUwubWF0Y2goL14jKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcbiAgICAgICAgICAvLyBIb3cgbWFueSBjaGlsZE5vZGVzIGluIG9uZSBzZWN0aW9uIGl0ZW1cbiAgICAgICAgICB2YXIgY2h1bmtTaXplO1xuXG4gICAgICAgICAgZnVuY3Rpb24gdXBkYXRlKGkpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGkgKiBjaHVua1NpemU7XG4gICAgICAgICAgICAgIHZhciBzaXplID0gY2h1bmtTaXplO1xuXG4gICAgICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQocGFyZW50LmNoaWxkTm9kZXNbcG9zIC0gMV0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoXG4gICAgICAgICAgICAgICAgZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwocHJvcCkoaSkpJyksXG4gICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkTm9kZXNbcG9zXVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBpbnNlcnQoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBzaXplID0gY291bnQgKiBjaHVua1NpemU7XG4gICAgICAgICAgICB2YXIgaSwgZnJhZ21lbnQ7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKHByb3ApKGluZGV4ICsgaSkpJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGZyYWdtZW50LCBwYXJlbnQuY2hpbGROb2Rlc1twb3NdKTtcbiAgICAgICAgICAgIGxlbmd0aCA9IGxlbmd0aCArIHNpemU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnVuY3Rpb24gZGVsKGluZGV4LCBjb3VudCkge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgdmFyIGFuY2hvckluZGV4ID0gW10uaW5kZXhPZi5jYWxsKHBhcmVudC5jaGlsZE5vZGVzLCBhbmNob3IpO1xuICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaW5kZXggKiBjaHVua1NpemU7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGNvdW50ICogY2h1bmtTaXplO1xuXG4gICAgICAgICAgICBsZW5ndGggPSBsZW5ndGggLSBzaXplO1xuXG4gICAgICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChwYXJlbnQuY2hpbGROb2Rlc1twb3NdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGluc2VydCk7XG4gICAgICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgZGVsKTtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ3JlbmRlcmluZyAnICsgdmFsLmxlbiArICcgdmFsdWVzJyk7XG4gICAgICAgICAgICAgIHZhciBmdW5jID0gZXZhbCh0ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgIHZhciBjaGlsZCwgY2hpbGRNb2RlbDtcbiAgICAgICAgICAgICAgZm9yIChpID0gMCwgbGVuID0gdmFsLnZhbHVlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIFRPRE86IGltcGxlbWVudCBldmVudCBkZWxlZ2F0aW9uIGZvciBhcnJheSBpbmRleGVzXG4gICAgICAgICAgICAgICAgLy8gQWxzbywgdXNpbmcgdmFsLnZhbHVlc1tpXSBpbnN0ZWFkIG9mIHZhbFtpXVxuICAgICAgICAgICAgICAgIC8vIHNhdmVzIEEgTE9UIG9mIGhlYXAgbWVtb3J5LiBGaWd1cmUgb3V0IGhvdyB0byBkb1xuICAgICAgICAgICAgICAgIC8vIG9uIGRlbWFuZCBtb2RlbCBjcmVhdGlvbi5cbiAgICAgICAgICAgICAgICB2YWwub24oJ2NoYW5nZScsIGksIHVwZGF0ZShpKSk7XG4gICAgICAgICAgICAgICAgLy9yZW5kZXIuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcodmFsKGkpKScpKTtcbiAgICAgICAgICAgICAgICAvL3JlbmRlci5hcHBlbmRDaGlsZChmdW5jKHZhbC52YWx1ZXNbaV0pKTtcbiAgICAgICAgICAgICAgICBjaGlsZE1vZGVsID0gdmFsKGkpO1xuICAgICAgICAgICAgICAgIGNoaWxkID0gZnVuYyhjaGlsZE1vZGVsKTtcbiAgICAgICAgICAgICAgICBjaGlsZC5fX2p0bXBsX18gPSBjaGlsZE1vZGVsO1xuICAgICAgICAgICAgICAgIHJlbmRlci5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGNodW5rU2l6ZSA9IH5+KGxlbmd0aCAvIGxlbik7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9iamVjdD9cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKHZhbCknKTtcbiAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLl9fanRtcGxfXyA9IG1vZGVsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoISF2YWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXIgPSBldmFsKHRlbXBsYXRlICsgJyhtb2RlbCknKTtcbiAgICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY2h1bmtTaXplID0gbGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuXG4gIC8qKlxuICAgKiB7e15pbnZlcnRlZF9zZWN0aW9ufX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXlxcXihbXFx3XFwuXFwtXSspJC8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgYmxvY2s6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCwgdGVtcGxhdGUpIHtcblxuICAgICAgICAgIC8vIEFuY2hvciBub2RlIGZvciBrZWVwaW5nIHNlY3Rpb24gbG9jYXRpb25cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgLy8gTnVtYmVyIG9mIHJlbmRlcmVkIG5vZGVzXG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gcHJvcCA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChwcm9wKTtcbiAgICAgICAgICAgIHZhciBpLCBsZW4sIHJlbmRlcjtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcnJheT9cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB2YWwub24oJ2luc2VydCcsIGNoYW5nZSk7XG4gICAgICAgICAgICAgIHZhbC5vbignZGVsZXRlJywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgICAgICAgIGlmICh2YWwubGVuID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGV2YWwodGVtcGxhdGUgKyAnKHZhbChpKSknKSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocmVuZGVyLCBhbmNob3IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgICBtb2RlbC5vbignY2hhbmdlJywgcHJvcCwgY2hhbmdlKTtcbiAgICAgICAgfVxuXG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuICAvKlxuICAgKiBGYWxsYmFjayBydWxlLCBub3QgcmVjb2duaXplZCBqdG1wbCB0YWdcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJ1JFTU9WRU1FTEFURVInKSk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXTtcbiIsIi8qKlxuICogQ29tcGlsZSBhIHRlbXBsYXRlLCBwYXJzZWQgYnkgQHNlZSBwYXJzZVxuICpcbiAqIEBwYXJhbSB7ZG9jdW1lbnRGcmFnbWVudH0gdGVtcGxhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfHVuZGVmaW5lZH0gc291cmNlVVJMIC0gaW5jbHVkZSBzb3VyY2VVUkwgdG8gYWlkIGRlYnVnZ2luZ1xuICpcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gRnVuY3Rpb24gYm9keSwgYWNjZXB0aW5nIEZyZWFrIGluc3RhbmNlIHBhcmFtZXRlciwgc3VpdGFibGUgZm9yIGV2YWwoKVxuICovXG5mdW5jdGlvbiBjb21waWxlKHRlbXBsYXRlLCBzb3VyY2VVUkwsIGRlcHRoKSB7XG5cbiAgdmFyIHJpLCBydWxlcywgcmxlbjtcbiAgdmFyIG1hdGNoLCBibG9jaztcblxuICAvLyBHZW5lcmF0ZSBkeW5hbWljIGZ1bmN0aW9uIGJvZHlcbiAgdmFyIGZ1bmMgPSAnKGZ1bmN0aW9uKG1vZGVsKSB7XFxuJyArXG4gICAgJ3ZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpLCBub2RlO1xcblxcbic7XG5cbiAgaWYgKCFkZXB0aCkge1xuICAgIC8vIEdsb2JhbCBib29ra2VlcGluZ1xuICAgIGZ1bmMgKz1cbiAgICAgICd2YXIgcmFkaW9Hcm91cHMgPSB7fTtcXG4nICtcbiAgICAgICd2YXIgcmFkaW9Hcm91cHNVcGRhdGluZyA9IHt9O1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RzID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdHNVcGRhdGluZyA9IFtdO1xcbicgK1xuICAgICAgJ3ZhciBzZWxlY3RPcHRpb25zID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdE9wdGlvbnNDb250ZXh0cyA9IFtdO1xcblxcbic7XG4gIH1cblxuICAvLyBXcmFwIG1vZGVsIGluIGEgRnJlYWsgaW5zdGFuY2UsIGlmIG5lY2Vzc2FyeVxuICBmdW5jICs9ICdtb2RlbCA9IHR5cGVvZiBtb2RlbCA9PT0gXCJmdW5jdGlvblwiID8nICtcbiAgICAnbW9kZWwgOiAnICtcbiAgICAndHlwZW9mIG1vZGVsID09PSBcIm9iamVjdFwiID8nICtcbiAgICAgICdqdG1wbChtb2RlbCkgOicgK1xuICAgICAgJ2p0bXBsKHtcIi5cIjogbW9kZWx9KTtcXG5cXG4nO1xuXG4gIC8vIEl0ZXJhdGUgY2hpbGROb2Rlc1xuICBmb3IgKHZhciBpID0gMCwgY2hpbGROb2RlcyA9IHRlbXBsYXRlLmNoaWxkTm9kZXMsIGxlbiA9IGNoaWxkTm9kZXMubGVuZ3RoLCBub2RlO1xuICAgICAgIGkgPCBsZW47IGkrKykge1xuXG4gICAgbm9kZSA9IGNoaWxkTm9kZXNbaV07XG5cbiAgICBzd2l0Y2ggKG5vZGUubm9kZVR5cGUpIHtcblxuICAgICAgLy8gRWxlbWVudCBub2RlXG4gICAgICBjYXNlIDE6XG5cbiAgICAgICAgLy8ganRtcGwgdGFnP1xuICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ1NDUklQVCcgJiYgbm9kZS50eXBlID09PSAndGV4dC9qdG1wbC10YWcnKSB7XG5cbiAgICAgICAgICBmb3IgKHJpID0gMCwgcnVsZXMgPSByZXF1aXJlKCcuL2NvbXBpbGUtcnVsZXMtbm9kZScpLCBybGVuID0gcnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgICByaSA8IHJsZW47IHJpKyspIHtcblxuICAgICAgICAgICAgbWF0Y2ggPSBydWxlc1tyaV0obm9kZSk7XG5cbiAgICAgICAgICAgIC8vIFJ1bGUgZm91bmQ/XG4gICAgICAgICAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgICAgICAgICAvLyBCbG9jayB0YWc/XG4gICAgICAgICAgICAgIGlmIChtYXRjaC5ibG9jaykge1xuXG4gICAgICAgICAgICAgICAgLy8gRmV0Y2ggYmxvY2sgdGVtcGxhdGVcbiAgICAgICAgICAgICAgICBibG9jayA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGkrKztcbiAgICAgICAgICAgICAgICAgICAgKGkgPCBsZW4pICYmICFtYXRjaEVuZEJsb2NrKG1hdGNoLmJsb2NrLCBjaGlsZE5vZGVzW2ldLmlubmVySFRNTCB8fCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIGkrKykge1xuICAgICAgICAgICAgICAgICAgYmxvY2suYXBwZW5kQ2hpbGQoY2hpbGROb2Rlc1tpXS5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgICAgIHRocm93ICdqdG1wbDogVW5jbG9zZWQgJyArIG1hdGNoLmJsb2NrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArXG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG1hdGNoLmJsb2NrKSArICcsICcgKyAgIC8vIHByb3BcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgICAgICAgICAgICAgLy8gdGVtcGxhdGVcbiAgICAgICAgICAgICAgICAgICAgICBjb21waWxlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYmxvY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VVUkwgJiYgKHNvdXJjZVVSTCArICctJyArIG5vZGUuaW5uZXJIVE1MICsgJ1snICsgaSArICddJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAoZGVwdGggfHwgMCkgKyAxXG4gICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICApICsgJyk7JztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBJbmxpbmUgdGFnXG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICcoZnJhZywgbW9kZWwsICcgKyBKU09OLnN0cmluZ2lmeShtYXRjaC5wcm9wKSArICcpO1xcbic7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBTa2lwIHJlbWFpbmluZyBydWxlc1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IC8vIGVuZCBpdGVyYXRpbmcgbm9kZSBydWxlc1xuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGVsZW1lbnRcbiAgICAgICAgICBmdW5jICs9ICdub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIicgKyBub2RlLm5vZGVOYW1lICsgJ1wiKTtcXG4nO1xuXG4gICAgICAgICAgLy8gUHJvY2VzcyBhdHRyaWJ1dGVzXG4gICAgICAgICAgZm9yICh2YXIgYWkgPSAwLCBhdHRyaWJ1dGVzID0gbm9kZS5hdHRyaWJ1dGVzLCBhbGVuID0gYXR0cmlidXRlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICBhaSA8IGFsZW47IGFpKyspIHtcblxuICAgICAgICAgICAgZm9yIChyaSA9IDAsIHJ1bGVzID0gcmVxdWlyZSgnLi9jb21waWxlLXJ1bGVzLWF0dHInKSwgcmxlbiA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICByaSA8IHJsZW47IHJpKyspIHtcblxuICAgICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlLCBhdHRyaWJ1dGVzW2FpXS5uYW1lLnRvTG93ZXJDYXNlKCkpO1xuXG4gICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgICAgLy8gTWF0Y2ggZm91bmQsIGFwcGVuZCBydWxlIHRvIGZ1bmNcbiAgICAgICAgICAgICAgICBmdW5jICs9ICcoJyArIG1hdGNoLnJ1bGUudG9TdHJpbmcoKSArICcpJyArXG4gICAgICAgICAgICAgICAgICAnKG5vZGUsICcgK1xuICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYXR0cmlidXRlc1thaV0ubmFtZSkgKyAvLyBhdHRyXG4gICAgICAgICAgICAgICAgICAnLCBtb2RlbCwgJyArXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShtYXRjaC5wcm9wKSArICAgICAgICAgIC8vIHByb3BcbiAgICAgICAgICAgICAgICAgICcpO1xcbic7XG5cbiAgICAgICAgICAgICAgICAvLyBTa2lwIG90aGVyIGF0dHJpYnV0ZSBydWxlc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgIT09ICdJTlBVVCcpIHtcbiAgICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBpbGVcbiAgICAgICAgICAgIGZ1bmMgKz0gJ25vZGUuYXBwZW5kQ2hpbGQoJyArXG4gICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5ub2RlTmFtZSArICdbJyArIGkgKyAnXScpLFxuICAgICAgICAgICAgKGRlcHRoIHx8IDApICsgMVxuICAgICAgICAgICAgKSArICcobW9kZWwpKTtcXG4nO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEFwcGVuZCB0byBmcmFnbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuXG5cbiAgICAgIC8vIFRleHQgbm9kZVxuICAgICAgY2FzZSAzOlxuICAgICAgICBmdW5jICs9ICdmcmFnLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG5vZGUuZGF0YSkgKyAnKSk7XFxuJztcbiAgICAgICAgYnJlYWs7XG5cblxuICAgICAgLy8gQ29tbWVudCBub2RlXG4gICAgICBjYXNlIDg6XG4gICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShub2RlLmRhdGEpICsgJykpO1xcbic7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgfSAvLyBlbmQgc3dpdGNoXG4gIH0gLy8gZW5kIGl0ZXJhdGUgY2hpbGROb2Rlc1xuXG4gIGZ1bmMgKz0gJ3JldHVybiBmcmFnOyB9KSc7XG4gIGZ1bmMgKz0gc291cmNlVVJMID9cbiAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc291cmNlVVJMICsgJ1xcbi8vIyBzb3VyY2VVUkw9JyArIHNvdXJjZVVSTCArICdcXG4nIDpcbiAgICAnJztcblxuICByZXR1cm4gZnVuYztcbn1cblxuXG5cblxuZnVuY3Rpb24gbWF0Y2hFbmRCbG9jayhibG9jaywgc3RyKSB7XG4gIHZhciBtYXRjaCA9IHN0ci5tYXRjaCgvXFwvKFtcXHdcXC5cXC1dKyk/Lyk7XG4gIHJldHVybiBtYXRjaCA/XG4gICAgYmxvY2sgPT09ICcnIHx8ICFtYXRjaFsxXSB8fCBtYXRjaFsxXSA9PT0gYmxvY2sgOlxuICAgIGZhbHNlO1xufVxuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBpbGU7XG4iLCIvKiFcbiAqIGNvbnRlbnRsb2FkZWQuanNcbiAqXG4gKiBBdXRob3I6IERpZWdvIFBlcmluaSAoZGllZ28ucGVyaW5pIGF0IGdtYWlsLmNvbSlcbiAqIFN1bW1hcnk6IGNyb3NzLWJyb3dzZXIgd3JhcHBlciBmb3IgRE9NQ29udGVudExvYWRlZFxuICogVXBkYXRlZDogMjAxMDEwMjBcbiAqIExpY2Vuc2U6IE1JVFxuICogVmVyc2lvbjogMS4yXG4gKlxuICogVVJMOlxuICogaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL0NvbnRlbnRMb2FkZWQvXG4gKiBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vQ29udGVudExvYWRlZC9NSVQtTElDRU5TRVxuICpcbiAqL1xuXG4vLyBAd2luIHdpbmRvdyByZWZlcmVuY2Vcbi8vIEBmbiBmdW5jdGlvbiByZWZlcmVuY2Vcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29udGVudExvYWRlZCh3aW4sIGZuKSB7XG5cblx0dmFyIGRvbmUgPSBmYWxzZSwgdG9wID0gdHJ1ZSxcblxuXHRkb2MgPSB3aW4uZG9jdW1lbnQsXG5cdHJvb3QgPSBkb2MuZG9jdW1lbnRFbGVtZW50LFxuXHRtb2Rlcm4gPSBkb2MuYWRkRXZlbnRMaXN0ZW5lcixcblxuXHRhZGQgPSBtb2Rlcm4gPyAnYWRkRXZlbnRMaXN0ZW5lcicgOiAnYXR0YWNoRXZlbnQnLFxuXHRyZW0gPSBtb2Rlcm4gPyAncmVtb3ZlRXZlbnRMaXN0ZW5lcicgOiAnZGV0YWNoRXZlbnQnLFxuXHRwcmUgPSBtb2Rlcm4gPyAnJyA6ICdvbicsXG5cblx0aW5pdCA9IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoZS50eXBlID09ICdyZWFkeXN0YXRlY2hhbmdlJyAmJiBkb2MucmVhZHlTdGF0ZSAhPSAnY29tcGxldGUnKSByZXR1cm47XG5cdFx0KGUudHlwZSA9PSAnbG9hZCcgPyB3aW4gOiBkb2MpW3JlbV0ocHJlICsgZS50eXBlLCBpbml0LCBmYWxzZSk7XG5cdFx0aWYgKCFkb25lICYmIChkb25lID0gdHJ1ZSkpIGZuLmNhbGwod2luLCBlLnR5cGUgfHwgZSk7XG5cdH0sXG5cblx0cG9sbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRyeSB7IHJvb3QuZG9TY3JvbGwoJ2xlZnQnKTsgfSBjYXRjaChlKSB7IHNldFRpbWVvdXQocG9sbCwgNTApOyByZXR1cm47IH1cblx0XHRpbml0KCdwb2xsJyk7XG5cdH07XG5cblx0aWYgKGRvYy5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpIGZuLmNhbGwod2luLCAnbGF6eScpO1xuXHRlbHNlIHtcblx0XHRpZiAoIW1vZGVybiAmJiByb290LmRvU2Nyb2xsKSB7XG5cdFx0XHR0cnkgeyB0b3AgPSAhd2luLmZyYW1lRWxlbWVudDsgfSBjYXRjaChlKSB7IH1cblx0XHRcdGlmICh0b3ApIHBvbGwoKTtcblx0XHR9XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0LCBmYWxzZSk7XG5cdFx0ZG9jW2FkZF0ocHJlICsgJ3JlYWR5c3RhdGVjaGFuZ2UnLCBpbml0LCBmYWxzZSk7XG5cdFx0d2luW2FkZF0ocHJlICsgJ2xvYWQnLCBpbml0LCBmYWxzZSk7XG5cdH1cblxufTtcbiIsIi8qXG5cbkV2YWx1YXRlIG9iamVjdCBmcm9tIGxpdGVyYWwgb3IgQ29tbW9uSlMgbW9kdWxlXG5cbiovXG5cbiAgICAvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYywgbW9kZWwpIHtcblxuICAgICAgbW9kZWwgPSBtb2RlbCB8fCB7fTtcbiAgICAgIGlmICh0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbW9kZWwgPSBqdG1wbChtb2RlbCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICBpZiAoLy8gUGx1Z2luXG4gICAgICAgICAgICAgIChwcm9wLmluZGV4T2YoJ19fJykgPT09IDAgJiZcbiAgICAgICAgICAgICAgICBwcm9wLmxhc3RJbmRleE9mKCdfXycpID09PSBwcm9wLmxlbmd0aCAtIDIpIHx8XG4gICAgICAgICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICAgICAgICAgIHR5cGVvZiBwcm9wZXJ0aWVzW3Byb3BdID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnZhbHVlc1twcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldC52YWx1ZXNbcHJvcF0gPSBwcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRhcmdldCBkb2Vzbid0IGFscmVhZHkgaGF2ZSBwcm9wP1xuICAgICAgICAgICAgaWYgKHRhcmdldChwcm9wKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldChwcm9wLCBwcm9wZXJ0aWVzW3Byb3BdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYXBwbHlQbHVnaW5zKCkge1xuICAgICAgICB2YXIgcHJvcCwgYXJnO1xuICAgICAgICBmb3IgKHByb3AgaW4ganRtcGwucGx1Z2lucykge1xuICAgICAgICAgIHBsdWdpbiA9IGp0bXBsLnBsdWdpbnNbcHJvcF07XG4gICAgICAgICAgYXJnID0gbW9kZWwudmFsdWVzWydfXycgKyBwcm9wICsgJ19fJ107XG4gICAgICAgICAgaWYgKHR5cGVvZiBwbHVnaW4gPT09ICdmdW5jdGlvbicgJiYgYXJnICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBsdWdpbi5jYWxsKG1vZGVsLCBhcmcsIHRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGV2YWxPYmplY3QoYm9keSwgc3JjKSB7XG4gICAgICAgIHZhciByZXN1bHQsIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcbiAgICAgICAgc3JjID0gc3JjID9cbiAgICAgICAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc3JjICtcbiAgICAgICAgICAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc3JjIDpcbiAgICAgICAgICAnJztcbiAgICAgICAgaWYgKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSB7XG4gICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgIHJldHVybiBldmFsKCdyZXN1bHQ9JyArIGJvZHkgKyBzcmMpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICBldmFsKGJvZHkgKyBzcmMpO1xuICAgICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGp0bXBsLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gRWxlbWVudCBpbiB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KGVsZW1lbnQuaW5uZXJIVE1MLCBzcmMpKTtcbiAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgbW9kZWwgdmlhIFhIUlxuICAgICAgICAgIC8vIE9sZGVyIElFcyBjb21wbGFpbiBpZiBVUkwgY29udGFpbnMgaGFzaFxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChqdG1wbC5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgbmV3IERPTVBhcnNlcigpXG4gICAgICAgICAgICAgICAgLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJylcbiAgICAgICAgICAgICAgICAucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG4gICAgICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLCBzcmMpKTtcbiAgICAgICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRUZW1wbGF0ZSgpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcblxuICAgICAgICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gICAgICAgIGlmIChzcmMubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSBpcyB0aGUgY29udGVudHMgb2YgZWxlbWVudFxuICAgICAgICAgIC8vIGJlbG9uZ2luZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbG9hZE1vZGVsKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJyksIGVsZW1lbnQuaW5uZXJIVE1MLCBkb2N1bWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgdGVtcGxhdGUgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGp0bXBsLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGlmcmFtZSwgZG9jO1xuICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgICAgICAgICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgICAgZG9jID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudDtcbiAgICAgICAgICAgICAgICBkb2Mud3JpdGVsbihyZXNwKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jID0gZG9jdW1lbnQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBkb2MucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG5cbiAgICAgICAgICAgICAgbG9hZE1vZGVsKFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSA6ICcnLFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLFxuICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9hZFRlbXBsYXRlKCk7XG4gICAgfTtcbiIsIi8qXG4gKiBNYWluIGZ1bmN0aW9uXG4gKi9cbi8qIGpzaGludCBldmlsOiB0cnVlICovXG5mdW5jdGlvbiBqdG1wbCgpIHtcbiAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gIHZhciB0YXJnZXQsIHQsIHRlbXBsYXRlLCBtb2RlbDtcblxuICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgaWYgKFsnR0VUJywgJ1BPU1QnXS5pbmRleE9mKGFyZ3NbMF0pID4gLTEpIHtcbiAgICByZXR1cm4gcmVxdWlyZSgnLi94aHInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgfVxuXG4gIC8vIGp0bXBsKG9iamVjdCk/XG4gIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0Jykge1xuICAgIC8vIHJldHVybiBGcmVhayBpbnN0YW5jZVxuICAgIHJldHVybiByZXF1aXJlKCdmcmVhaycpKGFyZ3NbMF0pO1xuICB9XG5cbiAgLy8ganRtcGwodGFyZ2V0KT9cbiAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gcmV0dXJuIG1vZGVsXG4gICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSkuX19qdG1wbF9fO1xuICB9XG5cbiAgLy8ganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gIGVsc2UgaWYgKFxuICAgICggYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlIHx8XG4gICAgICAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKVxuICAgICkgJiZcblxuICAgICggKGFyZ3NbMV0gJiYgdHlwZW9mIGFyZ3NbMV0uYXBwZW5kQ2hpbGQgPT09ICdmdW5jdGlvbicpIHx8XG4gICAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKVxuICAgICkgJiZcblxuICAgIGFyZ3NbMl0gIT09IHVuZGVmaW5lZFxuXG4gICkge1xuXG4gICAgdGFyZ2V0ID0gYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlICA/XG4gICAgICBhcmdzWzBdIDpcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICB0ZW1wbGF0ZSA9IGFyZ3NbMV0ubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkgP1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgYXJnc1sxXTtcblxuICAgIG1vZGVsID1cbiAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICAgIGFyZ3NbMl0gOlxuICAgICAgICAvLyBvdGhlcndpc2Ugd3JhcFxuICAgICAgICBqdG1wbChcbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgLy8gb2JqZWN0XG4gICAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMl0ubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgICAgICAvLyBzcmMsIGxvYWQgaXRcbiAgICAgICAgICAgICAgcmVxdWlyZSgnLi9sb2FkZXInKVxuICAgICAgICAgICAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMl0pLmlubmVySFRNTCkgOlxuXG4gICAgICAgICAgICAgIC8vIHNpbXBsZSB2YWx1ZSwgYm94IGl0XG4gICAgICAgICAgICAgIHsnLic6IGFyZ3NbMl19XG4gICAgICAgICk7XG5cbiAgICBpZiAodGFyZ2V0Lm5vZGVOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgdC5pZCA9IHRhcmdldC5pZDtcbiAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0LCB0YXJnZXQpO1xuICAgICAgdGFyZ2V0ID0gdDtcbiAgICB9XG5cbiAgICAvLyBBc3NvY2lhdGUgdGFyZ2V0IGFuZCBtb2RlbFxuICAgIHRhcmdldC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgIC8vIEVtcHR5IHRhcmdldFxuICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgIC8vdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoXG4gICAgICBldmFsKFxuICAgICAgICBqdG1wbC5jb21waWxlKFxuICAgICAgICAgIGp0bXBsLnBhcnNlKHRlbXBsYXRlKSxcbiAgICAgICAgICB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJylcbiAgICAgICAgKSArICcobW9kZWwpJ1xuICAgICAgKVxuICAgICk7XG4gIH1cbn1cblxuXG5cbi8qXG4gKiBPbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcbiAqL1xuXG5yZXF1aXJlKCcuL2NvbnRlbnQtbG9hZGVkJykod2luZG93LCBmdW5jdGlvbigpIHtcblxuICB2YXIgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbiAgdmFyIHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qdG1wbF0nKTtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGFyZ2V0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxvYWRlcih0YXJnZXRzW2ldLCB0YXJnZXRzW2ldLmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpKTtcbiAgfVxufSk7XG5cblxuLypcbiAqIEV4cG9ydCBzdHVmZlxuICovXG5qdG1wbC5SRV9OT0RFX0lEID0gL14jW1xcd1xcLlxcLV0rJC87XG5qdG1wbC5SRV9FTkRTX1dJVEhfTk9ERV9JRCA9IC8uKygjW1xcd1xcLlxcLV0rKSQvO1xuXG5qdG1wbC5wYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbmp0bXBsLmNvbXBpbGUgPSByZXF1aXJlKCcuL2NvbXBpbGUnKTtcbmp0bXBsLmxvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG5qdG1wbC51dGVtcGxhdGUgPSByZXF1aXJlKCcuL3V0ZW1wbGF0ZScpO1xuanRtcGwuX2dldCA9IGZ1bmN0aW9uKG1vZGVsLCBwcm9wKSB7XG4gIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSA/XG4gICAgSlNPTi5zdHJpbmdpZnkodmFsLnZhbHVlcykgOlxuICAgIHZhbDtcbn07XG5cblxuLypcbiAqIFBsdWdpbnNcbiAqL1xuanRtcGwucGx1Z2lucyA9IHtcbiAgaW5pdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgIC8vIENhbGwgYXN5bmMsIGFmdGVyIGp0bXBsIGhhcyBjb25zdHJ1Y3RlZCB0aGUgRE9NXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBhcmcuY2FsbCh0aGF0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKlxuICogRXhwb3J0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0ganRtcGw7XG4iLCIvKipcbiAqIFBhcnNlIGEgdGV4dCB0ZW1wbGF0ZSB0byBET00gc3RydWN0dXJlIHJlYWR5IGZvciBjb21waWxpbmdcbiAqIEBzZWUgY29tcGlsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5mdW5jdGlvbiBwYXJzZSh0ZW1wbGF0ZSkge1xuXG4gIHZhciBpZnJhbWUsIGJvZHk7XG5cbiAgZnVuY3Rpb24gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSkge1xuXG4gICAgLy8gcmVwbGFjZSB7e3t0YWd9fX0gd2l0aCB7eyZ0YWd9fVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgvXFx7XFx7XFx7KFtcXFNcXHNdKj8pXFx9XFx9XFx9L2csICd7eyYkMX19Jyk7XG5cbiAgICAvLyAxLiB3cmFwIGVhY2ggbm9uLWF0dHJpYnV0ZSB0YWcgaW4gPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj5cbiAgICAvLyAyLiByZW1vdmUgTXVzdGFjaGUgY29tbWVudHNcbiAgICAvLyBUT0RPOiBoYW5kbGUgdGFncyBpbiBIVE1MIGNvbW1lbnRzXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG1hdGNoMSwgcG9zKSB7XG4gICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaCgvPFtcXHdcXC1dK1tePl0qPyQvKTtcbiAgICAgICAgdmFyIG9wZW5pbmcgPSBoZWFkLm1hdGNoKC88KHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgY2xvc2luZyA9IGhlYWQubWF0Y2goLzxcXC8oc2NyaXB0fFNDUklQVCkvZyk7XG4gICAgICAgIHZhciBpbnNpZGVTY3JpcHQgPVxuICAgICAgICAgICAgKG9wZW5pbmcgJiYgb3BlbmluZy5sZW5ndGggfHwgMCkgPiAoY2xvc2luZyAmJiBjbG9zaW5nLmxlbmd0aCB8fCAwKTtcbiAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgP1xuICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgIGluc2lkZVNjcmlwdCA/XG4gICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICAnPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj4nICsgbWF0Y2gxLnRyaW0oKSArICdcXHgzQy9zY3JpcHQ+JztcbiAgICAgIH1cbiAgICApO1xuICAgIC8vIHByZWZpeCAnc2VsZWN0ZWQnIGFuZCAnY2hlY2tlZCcgYXR0cmlidXRlcyB3aXRoICdqdG1wbC0nXG4gICAgLy8gKHRvIGF2b2lkIFwic3BlY2lhbFwiIHByb2Nlc3NpbmcsIG9oIElFOClcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzpvcHRpb258T1BUSU9OKVtePl0qPykoPzpzZWxlY3RlZHxTRUxFQ1RFRCk9L2csXG4gICAgICAnJDFqdG1wbC1zZWxlY3RlZD0nKTtcblxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/OmlucHV0fElOUFVUKVtePl0qPykoPzpjaGVja2VkfENIRUNLRUQpPS9nLFxuICAgICAgJyQxanRtcGwtY2hlY2tlZD0nKTtcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIHRlbXBsYXRlID0gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSk7XG4gIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICBpZnJhbWUuY29udGVudERvY3VtZW50LndyaXRlbG4oJzwhZG9jdHlwZSBodG1sPlxcbjxodG1sPjxib2R5PicgKyB0ZW1wbGF0ZSArICc8L2JvZHk+PC9odG1sPicpO1xuICBib2R5ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5ib2R5O1xuICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiLyoqXG4gKiB1dGVtcGxhdGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1vZGVsIC0gZGF0YSBhcyBGcmVhayBpbnN0YW5jZVxuICogQHBhcmFtIHtvcHRpb25hbCBmdW5jdGlvbn0gb25DaGFuZ2UgLSB3aWxsIGJlIGNhbGxlZCB3aGVuZXZlciB1c2VkIG1vZGVsIHByb3BlcnR5IGNoYW5nZXNcbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHJlbmRlcmVkIHRlbXBsYXRlIHVzaW5nIG1vZGVsXG4gKlxuICogQmFzaWMgdGVtcGxhdGUgcmVuZGVyaW5nLlxuICogU3VwcG9ydGVkIHRhZ3M6IHt7dmFyaWFibGV9fSwge3sjc2VjdGlvbn19LCB7e15pbnZlcnRlZF9zZWN0aW9ufX1cbiAqIChzaG9ydCBjbG9zaW5nIHRhZ3Mge3svfX0gc3VwcG9ydGVkKVxuICpcbiAqIERvZXMgTk9UIHN1cHBvcnQgbmVzdGVkIHNlY3Rpb25zLCBzbyBzaW1wbGUgcGFyc2luZyB2aWEgcmVnZXggaXMgcG9zc2libGUuXG4gKi9cbmZ1bmN0aW9uIHV0ZW1wbGF0ZSh0ZW1wbGF0ZSwgbW9kZWwsIG9uQ2hhbmdlKSB7XG4gIHJldHVybiB0ZW1wbGF0ZVxuICAgIC8vIHt7I3NlY3Rpb259fSBzZWN0aW9uQm9keSB7ey99fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyMoW1xcd1xcLlxcLV0rKVxcfVxcfSguKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgb3BlblRhZywgYm9keSwgY2xvc2VUYWcsIHBvcykge1xuICAgICAgICBpZiAoY2xvc2VUYWcgIT09ICcnICYmIGNsb3NlVGFnICE9PSBvcGVuVGFnKSB7XG4gICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgb3BlblRhZztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG9wZW5UYWcsIG9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdmFsID0gb3BlblRhZyA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChvcGVuVGFnKTtcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkgP1xuICAgICAgICAgICAgLy8gQXJyYXlcbiAgICAgICAgICAgICh2YWwubGVuID4gMCkgP1xuICAgICAgICAgICAgICAvLyBOb24tZW1wdHlcbiAgICAgICAgICAgICAgdmFsLnZhbHVlc1xuICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZWwsIGkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB1dGVtcGxhdGUoYm9keS5yZXBsYWNlKC9cXHtcXHtcXC5cXH1cXH0vZywgJ3t7JyArIGkgKyAnfX0nKSwgdmFsLCBvbkNoYW5nZSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuam9pbignJykgOlxuICAgICAgICAgICAgICAvLyBFbXB0eVxuICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAvLyBPYmplY3Qgb3IgYm9vbGVhbj9cbiAgICAgICAgICAgICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkgP1xuICAgICAgICAgICAgICAvLyBPYmplY3RcbiAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIHZhbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICAgICghIXZhbCkgP1xuICAgICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgICAnJztcbiAgICAgIH1cbiAgICApXG4gICAgLy8ge3teaW52ZXJ0ZWRfc2VjdGlvbn19IHNlY3Rpb25Cb2R5IHt7L319XG4gICAgLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7XFxeKFtcXHdcXC5cXC1dKylcXH1cXH0oLis/KVxce1xce1xcLyhbXFx3XFwuXFwtXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG9wZW5UYWcsIGJvZHksIGNsb3NlVGFnLCBwb3MpIHtcbiAgICAgICAgaWYgKGNsb3NlVGFnICE9PSAnJyAmJiBjbG9zZVRhZyAhPT0gb3BlblRhZykge1xuICAgICAgICAgIHRocm93ICdqdG1wbDogVW5jbG9zZWQgJyArIG9wZW5UYWc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBvbkNoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBvcGVuVGFnLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IG9wZW5UYWcgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwob3BlblRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpID9cbiAgICAgICAgICAgIC8vIEFycmF5XG4gICAgICAgICAgICAodmFsLmxlbiA9PT0gMCkgP1xuICAgICAgICAgICAgICAvLyBFbXB0eVxuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgbW9kZWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgIC8vIE5vbi1lbXB0eVxuICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgICghdmFsKSA/XG4gICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgJyc7XG4gICAgICB9XG4gICAgKVxuICAgIC8vIHt7dmFyaWFibGV9fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgdmFyaWFibGUsIHBvcykge1xuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHZhcmlhYmxlLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1vZGVsKHZhcmlhYmxlKSA9PT0gdW5kZWZpbmVkID8gJycgOiBtb2RlbCh2YXJpYWJsZSkgKyAnJztcbiAgICAgIH1cbiAgICApO1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSB1dGVtcGxhdGU7XG4iLCIvKlxuXG5SZXF1ZXN0cyBBUElcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGVuLCBwcm9wLCBwcm9wcywgcmVxdWVzdDtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIC8vIExhc3QgZnVuY3Rpb24gYXJndW1lbnRcbiAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucmVkdWNlKFxuICAgICAgICBmdW5jdGlvbiAocHJldiwgY3Vycikge1xuICAgICAgICAgIHJldHVybiB0eXBlb2YgY3VyciA9PT0gJ2Z1bmN0aW9uJyA/IGN1cnIgOiBwcmV2O1xuICAgICAgICB9LFxuICAgICAgICBudWxsXG4gICAgICApO1xuXG4gICAgICB2YXIgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcblxuICAgICAgaWYgKHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIGZvciAoaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3B0cyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgcHJvcCA9IHByb3BzW2ldO1xuICAgICAgICB4aHJbcHJvcF0gPSBvcHRzW3Byb3BdO1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0ID1cbiAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJykgP1xuXG4gICAgICAgICAgLy8gU3RyaW5nIHBhcmFtZXRlcnNcbiAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcpID9cblxuICAgICAgICAgICAgLy8gT2JqZWN0IHBhcmFtZXRlcnMuIFNlcmlhbGl6ZSB0byBVUklcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGFyZ3NbMl0pLm1hcChcbiAgICAgICAgICAgICAgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3NbMl1beF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLmpvaW4oJyYnKSA6XG5cbiAgICAgICAgICAgIC8vIE5vIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICcnO1xuXG4gICAgICB2YXIgb25sb2FkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIHJlc3A7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3AgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJlc3AgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCByZXNwLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgaWYgKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApIHtcbiAgICAgICAgICAgIG9ubG9hZC5jYWxsKHRoaXMsICdkb25lJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2p0bXBsIFhIUiBlcnJvcjogJyArIHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vcGVuKGFyZ3NbMF0sIGFyZ3NbMV0sXG4gICAgICAgIChvcHRzLmFzeW5jICE9PSB1bmRlZmluZWQgPyBvcHRzLmFzeW5jIDogdHJ1ZSksXG4gICAgICAgIG9wdHMudXNlciwgb3B0cy5wYXNzd29yZCk7XG5cbiAgICAgIHhoci5zZW5kKHJlcXVlc3QpO1xuXG4gICAgICByZXR1cm4geGhyO1xuXG4gICAgfTtcbiJdfQ==
(7)
});
