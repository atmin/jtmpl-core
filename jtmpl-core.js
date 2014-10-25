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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvbm9kZV9tb2R1bGVzL2ZyZWFrL2ZyZWFrLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1hdHRyLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS1ydWxlcy1ub2RlLmpzIiwiL2hvbWUvYS9kZXYvanRtcGwtY29yZS9zcmMvY29tcGlsZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL2xvYWRlci5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL21haW4uanMiLCIvaG9tZS9hL2Rldi9qdG1wbC1jb3JlL3NyYy9wYXJzZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3V0ZW1wbGF0ZS5qcyIsIi9ob21lL2EvZGV2L2p0bXBsLWNvcmUvc3JjL3hoci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnJlYWsob2JqLCByb290LCBwYXJlbnQsIHByb3ApIHtcblxuICB2YXIgbGlzdGVuZXJzID0ge1xuICAgICdjaGFuZ2UnOiB7fSxcbiAgICAndXBkYXRlJzoge30sXG4gICAgJ2luc2VydCc6IHt9LFxuICAgICdkZWxldGUnOiB7fVxuICB9O1xuICB2YXIgX2RlcGVuZGVudFByb3BzID0ge307XG4gIHZhciBfZGVwZW5kZW50Q29udGV4dHMgPSB7fTtcbiAgdmFyIGNhY2hlID0ge307XG4gIHZhciBjaGlsZHJlbiA9IHt9O1xuXG4gIC8vIEFzc2VydCBjb25kaXRpb25cbiAgZnVuY3Rpb24gYXNzZXJ0KGNvbmQsIG1zZykge1xuICAgIGlmICghY29uZCkge1xuICAgICAgdGhyb3cgbXNnIHx8ICdhc3NlcnRpb24gZmFpbGVkJztcbiAgICB9XG4gIH1cblxuICAvLyBNaXggcHJvcGVydGllcyBpbnRvIHRhcmdldFxuICBmdW5jdGlvbiBtaXhpbih0YXJnZXQsIHByb3BlcnRpZXMpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wZXJ0aWVzKSwgbGVuID0gcHJvcHMubGVuZ3RoO1xuICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtwcm9wc1tpXV0gPSBwcm9wZXJ0aWVzW3Byb3BzW2ldXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWVwRXF1YWwoeCwgeSkge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmXG4gICAgICAgIHR5cGVvZiB5ID09PSBcIm9iamVjdFwiICYmIHkgIT09IG51bGwpIHtcblxuICAgICAgaWYgKE9iamVjdC5rZXlzKHgpLmxlbmd0aCAhPT0gT2JqZWN0LmtleXMoeSkubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgcHJvcCBpbiB4KSB7XG4gICAgICAgIGlmICh4Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgaWYgKHkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIGlmICghZGVlcEVxdWFsKHhbcHJvcF0sIHlbcHJvcF0pKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmICh4ICE9PSB5KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBFdmVudCBmdW5jdGlvbnNcbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgdmFyIGV2ZW50ID0gYXJndW1lbnRzWzBdO1xuICAgIHZhciBwcm9wID0gWydzdHJpbmcnLCAnbnVtYmVyJ10uaW5kZXhPZih0eXBlb2YgYXJndW1lbnRzWzFdKSA+IC0xID9cbiAgICAgIGFyZ3VtZW50c1sxXSA6IG51bGw7XG4gICAgdmFyIGNhbGxiYWNrID1cbiAgICAgIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICBhcmd1bWVudHNbMV0gOlxuICAgICAgICB0eXBlb2YgYXJndW1lbnRzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgICBhcmd1bWVudHNbMl0gOiBudWxsO1xuXG4gICAgLy8gQXJncyBjaGVja1xuICAgIGFzc2VydChbJ2NoYW5nZScsICd1cGRhdGUnLCAnaW5zZXJ0JywgJ2RlbGV0ZSddLmluZGV4T2YoZXZlbnQpID4gLTEpO1xuICAgIGFzc2VydChcbiAgICAgIChbJ2NoYW5nZSddLmluZGV4T2YoZXZlbnQpID4gLTEgJiYgcHJvcCAhPT0gbnVsbCkgfHxcbiAgICAgIChbJ2luc2VydCcsICdkZWxldGUnLCAndXBkYXRlJ10uaW5kZXhPZihldmVudCkgPiAtMSAmJiBwcm9wID09PSBudWxsKVxuICAgICk7XG5cbiAgICAvLyBJbml0IGxpc3RlbmVycyBmb3IgcHJvcFxuICAgIGlmICghbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICAvLyBBbHJlYWR5IHJlZ2lzdGVyZWQ/XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjaykgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnRdW3Byb3BdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgb3Igc3BlY2lmaWVkIGxpc3RlbmVycyBnaXZlbiBldmVudCBhbmQgcHJvcGVydHlcbiAgZnVuY3Rpb24gb2ZmKCkge1xuICAgIHZhciBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICB2YXIgcHJvcCA9IHR5cGVvZiBhcmd1bWVudHNbMV0gPT09ICdzdHJpbmcnID8gYXJndW1lbnRzWzFdIDogbnVsbDtcbiAgICB2YXIgY2FsbGJhY2sgPVxuICAgICAgdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgIGFyZ3VtZW50c1sxXSA6XG4gICAgICAgIHR5cGVvZiBhcmd1bWVudHNbMl0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgIGFyZ3VtZW50c1syXSA6IG51bGw7XG4gICAgdmFyIGk7XG5cbiAgICBpZiAoIWxpc3RlbmVyc1tldmVudF1bcHJvcF0pIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBhbGwgcHJvcGVydHkgd2F0Y2hlcnM/XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50XVtwcm9wXSA9IFtdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIFJlbW92ZSBzcGVjaWZpYyBjYWxsYmFja1xuICAgICAgaSA9IGxpc3RlbmVyc1tldmVudF1bcHJvcF0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICBpZiAoaSA+IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF1bcHJvcF0uc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cblxuICB9XG5cbiAgLy8gdHJpZ2dlcignY2hhbmdlJywgcHJvcClcbiAgLy8gdHJpZ2dlcigndXBkYXRlJywgcHJvcClcbiAgLy8gdHJpZ2dlcignaW5zZXJ0JyBvciAnZGVsZXRlJywgaW5kZXgsIGNvdW50KVxuICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBhLCBiKSB7XG4gICAgdmFyIGhhbmRsZXJzID0gKGxpc3RlbmVyc1tldmVudF1bWydjaGFuZ2UnXS5pbmRleE9mKGV2ZW50KSA+IC0xID8gYSA6IG51bGxdIHx8IFtdKTtcbiAgICB2YXIgaSwgbGVuID0gaGFuZGxlcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaGFuZGxlcnNbaV0uY2FsbChpbnN0YW5jZSwgYSwgYik7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4cG9ydCBtb2RlbCB0byBKU09OIHN0cmluZ1xuICAvLyBOT1QgZXhwb3J0ZWQ6XG4gIC8vIC0gcHJvcGVydGllcyBzdGFydGluZyB3aXRoIF8gKFB5dGhvbiBwcml2YXRlIHByb3BlcnRpZXMgY29udmVudGlvbilcbiAgLy8gLSBjb21wdXRlZCBwcm9wZXJ0aWVzIChkZXJpdmVkIGZyb20gbm9ybWFsIHByb3BlcnRpZXMpXG4gIGZ1bmN0aW9uIHRvSlNPTigpIHtcbiAgICBmdW5jdGlvbiBmaWx0ZXIob2JqKSB7XG4gICAgICB2YXIga2V5LCBmaWx0ZXJlZCA9IEFycmF5LmlzQXJyYXkob2JqKSA/IFtdIDoge307XG4gICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZmlsdGVyKG9ialtrZXldKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb2JqW2tleV0gIT09ICdmdW5jdGlvbicgJiYga2V5WzBdICE9PSAnXycpIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZpbHRlcihvYmopKTtcbiAgfVxuXG4gIC8vIExvYWQgbW9kZWwgZnJvbSBKU09OIHN0cmluZyBvciBvYmplY3RcbiAgZnVuY3Rpb24gZnJvbUpTT04oZGF0YSkge1xuICAgIHZhciBrZXk7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfVxuICAgIGZvciAoa2V5IGluIGRhdGEpIHtcbiAgICAgIGluc3RhbmNlKGtleSwgZGF0YVtrZXldKTtcbiAgICAgIHRyaWdnZXIoJ3VwZGF0ZScsIGtleSk7XG4gICAgfVxuICAgIGluc3RhbmNlLmxlbiA9IG9iai5sZW5ndGg7XG4gIH1cblxuICAvLyBVcGRhdGUgaGFuZGxlcjogcmVjYWxjdWxhdGUgZGVwZW5kZW50IHByb3BlcnRpZXMsXG4gIC8vIHRyaWdnZXIgY2hhbmdlIGlmIG5lY2Vzc2FyeVxuICBmdW5jdGlvbiB1cGRhdGUocHJvcCkge1xuICAgIGlmICghZGVlcEVxdWFsKGNhY2hlW3Byb3BdLCBnZXQocHJvcCwgZnVuY3Rpb24oKSB7fSwgdHJ1ZSkpKSB7XG4gICAgICB0cmlnZ2VyKCdjaGFuZ2UnLCBwcm9wKTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgZGVwZW5kZW50c1xuICAgIGZvciAodmFyIGkgPSAwLCBkZXAgPSBfZGVwZW5kZW50UHJvcHNbcHJvcF0gfHwgW10sIGxlbiA9IGRlcC5sZW5ndGg7XG4gICAgICAgIGkgPCBsZW47IGkrKykge1xuICAgICAgZGVsZXRlIGNoaWxkcmVuW2RlcFtpXV07XG4gICAgICBfZGVwZW5kZW50Q29udGV4dHNbcHJvcF1baV0udHJpZ2dlcigndXBkYXRlJywgZGVwW2ldKTtcbiAgICB9XG5cbiAgICBpZiAoaW5zdGFuY2UucGFyZW50KSB7XG4gICAgICAvLyBOb3RpZnkgY29tcHV0ZWQgcHJvcGVydGllcywgZGVwZW5kaW5nIG9uIHBhcmVudCBvYmplY3RcbiAgICAgIGluc3RhbmNlLnBhcmVudC50cmlnZ2VyKCd1cGRhdGUnLCBpbnN0YW5jZS5wcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBQcm94eSB0aGUgYWNjZXNzb3IgZnVuY3Rpb24gdG8gcmVjb3JkXG4gIC8vIGFsbCBhY2Nlc3NlZCBwcm9wZXJ0aWVzXG4gIGZ1bmN0aW9uIGdldERlcGVuZGVuY3lUcmFja2VyKHByb3ApIHtcbiAgICBmdW5jdGlvbiB0cmFja2VyKGNvbnRleHQpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbihfcHJvcCwgX2FyZykge1xuICAgICAgICBpZiAoIWNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSkge1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudFByb3BzW19wcm9wXSA9IFtdO1xuICAgICAgICAgIGNvbnRleHQuX2RlcGVuZGVudENvbnRleHRzW19wcm9wXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0uaW5kZXhPZihwcm9wKSA9PT0gLTEpIHtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRQcm9wc1tfcHJvcF0ucHVzaChwcm9wKTtcbiAgICAgICAgICBjb250ZXh0Ll9kZXBlbmRlbnRDb250ZXh0c1tfcHJvcF0ucHVzaChpbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRleHQoX3Byb3AsIF9hcmcsIHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gdHJhY2tlcihpbnN0YW5jZSk7XG4gICAgY29uc3RydWN0KHJlc3VsdCk7XG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgcmVzdWx0LnBhcmVudCA9IHRyYWNrZXIocGFyZW50KTtcbiAgICB9XG4gICAgcmVzdWx0LnJvb3QgPSB0cmFja2VyKHJvb3QgfHwgaW5zdGFuY2UpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBTaGFsbG93IGNsb25lIGFuIG9iamVjdFxuICBmdW5jdGlvbiBzaGFsbG93Q2xvbmUob2JqKSB7XG4gICAgdmFyIGtleSwgY2xvbmU7XG4gICAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgY2xvbmUgPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICBjbG9uZVtrZXldID0gb2JqW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY2xvbmUgPSBvYmo7XG4gICAgfVxuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIC8vIEdldHRlciBmb3IgcHJvcCwgaWYgY2FsbGJhY2sgaXMgZ2l2ZW5cbiAgLy8gY2FuIHJldHVybiBhc3luYyB2YWx1ZVxuICBmdW5jdGlvbiBnZXQocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHZhbCA9IG9ialtwcm9wXTtcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFsID0gdmFsLmNhbGwoZ2V0RGVwZW5kZW5jeVRyYWNrZXIocHJvcCksIGNhbGxiYWNrKTtcbiAgICAgIGlmICghc2tpcENhY2hpbmcpIHtcbiAgICAgICAgY2FjaGVbcHJvcF0gPSAodmFsID09PSB1bmRlZmluZWQpID8gdmFsIDogc2hhbGxvd0Nsb25lKHZhbCk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKCFza2lwQ2FjaGluZykge1xuICAgICAgY2FjaGVbcHJvcF0gPSB2YWw7XG4gICAgfVxuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBmdW5jdGlvbiBnZXR0ZXIocHJvcCwgY2FsbGJhY2ssIHNraXBDYWNoaW5nKSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldChwcm9wLCBjYWxsYmFjaywgc2tpcENhY2hpbmcpO1xuXG4gICAgcmV0dXJuIHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0JyA/XG4gICAgICAvLyBXcmFwIG9iamVjdFxuICAgICAgY2hpbGRyZW5bcHJvcF0gP1xuICAgICAgICBjaGlsZHJlbltwcm9wXSA6XG4gICAgICAgIGNoaWxkcmVuW3Byb3BdID0gZnJlYWsocmVzdWx0LCByb290IHx8IGluc3RhbmNlLCBpbnN0YW5jZSwgcHJvcCkgOlxuICAgICAgLy8gU2ltcGxlIHZhbHVlXG4gICAgICByZXN1bHQ7XG4gIH1cblxuICAvLyBTZXQgcHJvcCB0byB2YWxcbiAgZnVuY3Rpb24gc2V0dGVyKHByb3AsIHZhbCkge1xuICAgIHZhciBvbGRWYWwgPSBnZXQocHJvcCk7XG5cbiAgICBpZiAodHlwZW9mIG9ialtwcm9wXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydHkgc2V0dGVyXG4gICAgICBvYmpbcHJvcF0uY2FsbChnZXREZXBlbmRlbmN5VHJhY2tlcihwcm9wKSwgdmFsKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBTaW1wbGUgcHJvcGVydHlcbiAgICAgIG9ialtwcm9wXSA9IHZhbDtcbiAgICAgIGlmICh2YWwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZGVsZXRlIGNhY2hlW3Byb3BdO1xuICAgICAgICBkZWxldGUgY2hpbGRyZW5bcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9sZFZhbCAhPT0gdmFsKSB7XG4gICAgICB0cmlnZ2VyKCd1cGRhdGUnLCBwcm9wKTtcbiAgICB9XG4gIH1cblxuICAvLyBGdW5jdGlvbmFsIGFjY2Vzc29yLCB1bmlmeSBnZXR0ZXIgYW5kIHNldHRlclxuICBmdW5jdGlvbiBhY2Nlc3Nvcihwcm9wLCBhcmcsIHNraXBDYWNoaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIChhcmcgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nKSA/XG4gICAgICAgIGdldHRlciA6IHNldHRlclxuICAgICkocHJvcCwgYXJnLCBza2lwQ2FjaGluZyk7XG4gIH1cblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBmdW5jdGlvbiBjb25zdHJ1Y3QodGFyZ2V0KSB7XG4gICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICB2YWx1ZXM6IG9iaixcbiAgICAgIHBhcmVudDogcGFyZW50IHx8IG51bGwsXG4gICAgICByb290OiByb290IHx8IHRhcmdldCxcbiAgICAgIHByb3A6IHByb3AgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBwcm9wLFxuICAgICAgLy8gLm9uKGV2ZW50WywgcHJvcF0sIGNhbGxiYWNrKVxuICAgICAgb246IG9uLFxuICAgICAgLy8gLm9mZihldmVudFssIHByb3BdWywgY2FsbGJhY2tdKVxuICAgICAgb2ZmOiBvZmYsXG4gICAgICAvLyAudHJpZ2dlcihldmVudFssIHByb3BdKVxuICAgICAgdHJpZ2dlcjogdHJpZ2dlcixcbiAgICAgIHRvSlNPTjogdG9KU09OLFxuICAgICAgLy8gRGVwcmVjYXRlZC4gSXQgaGFzIGFsd2F5cyBiZWVuIGJyb2tlbiwgYW55d2F5XG4gICAgICAvLyBXaWxsIHRoaW5rIGhvdyB0byBpbXBsZW1lbnQgcHJvcGVybHlcbiAgICAgIGZyb21KU09OOiBmcm9tSlNPTixcbiAgICAgIC8vIEludGVybmFsOiBkZXBlbmRlbmN5IHRyYWNraW5nXG4gICAgICBfZGVwZW5kZW50UHJvcHM6IF9kZXBlbmRlbnRQcm9wcyxcbiAgICAgIF9kZXBlbmRlbnRDb250ZXh0czogX2RlcGVuZGVudENvbnRleHRzXG4gICAgfSk7XG5cbiAgICAvLyBXcmFwIG11dGF0aW5nIGFycmF5IG1ldGhvZCB0byB1cGRhdGVcbiAgICAvLyBzdGF0ZSBhbmQgbm90aWZ5IGxpc3RlbmVyc1xuICAgIGZ1bmN0aW9uIHdyYXBBcnJheU1ldGhvZChtZXRob2QsIGZ1bmMpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdW21ldGhvZF0uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICB0aGlzLmxlbiA9IHRoaXMudmFsdWVzLmxlbmd0aDtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgY2hpbGRyZW4gPSB7fTtcbiAgICAgICAgZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB0YXJnZXQucGFyZW50LnRyaWdnZXIoJ3VwZGF0ZScsIHRhcmdldC5wcm9wKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgbWl4aW4odGFyZ2V0LCB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHByb3RvdHlwZSBhbHJlYWR5IGNvbnRhaW5zIGxlbmd0aFxuICAgICAgICAvLyBgbGVuYCBzcGVjaWZpZXMgYXJyYXkgbGVuZ3RoXG4gICAgICAgIGxlbjogb2JqLmxlbmd0aCxcblxuICAgICAgICBwb3A6IHdyYXBBcnJheU1ldGhvZCgncG9wJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgdGhpcy5sZW4sIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICBwdXNoOiB3cmFwQXJyYXlNZXRob2QoJ3B1c2gnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCB0aGlzLmxlbiAtIDEsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICByZXZlcnNlOiB3cmFwQXJyYXlNZXRob2QoJ3JldmVyc2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdkZWxldGUnLCAwLCB0aGlzLmxlbik7XG4gICAgICAgICAgdHJpZ2dlcignaW5zZXJ0JywgMCwgdGhpcy5sZW4pO1xuICAgICAgICB9KSxcblxuICAgICAgICBzaGlmdDogd3JhcEFycmF5TWV0aG9kKCdzaGlmdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIDAsIDEpO1xuICAgICAgICB9KSxcblxuICAgICAgICB1bnNoaWZ0OiB3cmFwQXJyYXlNZXRob2QoJ3Vuc2hpZnQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCAwLCAxKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc29ydDogd3JhcEFycmF5TWV0aG9kKCdzb3J0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdHJpZ2dlcignZGVsZXRlJywgMCwgdGhpcy5sZW4pO1xuICAgICAgICAgIHRyaWdnZXIoJ2luc2VydCcsIDAsIHRoaXMubGVuKTtcbiAgICAgICAgfSksXG5cbiAgICAgICAgc3BsaWNlOiB3cmFwQXJyYXlNZXRob2QoJ3NwbGljZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgICAgIHRyaWdnZXIoJ2RlbGV0ZScsIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKCdpbnNlcnQnLCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50cy5sZW5ndGggLSAyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIG9uKCd1cGRhdGUnLCB1cGRhdGUpO1xuXG4gIC8vIENyZWF0ZSBmcmVhayBpbnN0YW5jZVxuICB2YXIgaW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gYWNjZXNzb3IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICAvLyBBdHRhY2ggaW5zdGFuY2UgbWVtYmVyc1xuICBjb25zdHJ1Y3QoaW5zdGFuY2UpO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ29tbW9uSlMgZXhwb3J0XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcpIG1vZHVsZS5leHBvcnRzID0gZnJlYWs7XG4iLCJ2YXIgUkVfREVMSU1JVEVEX1ZBUiA9IC9eXFx7XFx7KFtcXHdcXC5cXC1dKylcXH1cXH0kLztcblxuXG4vKlxuICogQXR0cmlidXRlIHJ1bGVzXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IFtcblxuICAvKipcbiAgICogdmFsdWU9XCJ7e3Zhcn19XCJcbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUsIGF0dHIpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKS5tYXRjaChSRV9ERUxJTUlURURfVkFSKTtcbiAgICBpZiAoYXR0ciA9PT0gJ3ZhbHVlJyAmJiBtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG1hdGNoWzFdLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKG5vZGUsIGF0dHIsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0ganRtcGwuX2dldChtb2RlbCwgcHJvcCk7XG4gICAgICAgICAgICBpZiAobm9kZVthdHRyXSAhPT0gdmFsKSB7XG4gICAgICAgICAgICAgIG5vZGVbYXR0cl0gPSB2YWwgfHwgJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gdGV4dCBpbnB1dD9cbiAgICAgICAgICB2YXIgZXZlbnRUeXBlID0gWyd0ZXh0JywgJ3Bhc3N3b3JkJ10uaW5kZXhPZihub2RlLnR5cGUpID4gLTEgP1xuICAgICAgICAgICAgJ2tleXVwJyA6ICdjaGFuZ2UnOyAvLyBJRTkgaW5jb3JlY3RseSByZXBvcnRzIGl0IHN1cHBvcnRzIGlucHV0IGV2ZW50XG5cbiAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG1vZGVsKHByb3AsIG5vZGVbYXR0cl0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG5cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG5cbiAgLyoqXG4gICAqIHNlbGVjdGVkPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKGF0dHIgPT09ICdqdG1wbC1zZWxlY3RlZCcgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdPUFRJT04nKSB7XG4gICAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgIGlmIChzZWxlY3RzVXBkYXRpbmdbaV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDAsIGxlbiA9IHNlbGVjdE9wdGlvbnNbaV0ubGVuZ3RoOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zW2ldW2pdLnNlbGVjdGVkID0gc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldW2pdKHByb3ApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZS5zZWxlY3RlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnT1BUSU9OJykge1xuXG4gICAgICAgICAgICAvLyBQcm9jZXNzIGFzeW5jLCBhcyBwYXJlbnROb2RlIGlzIHN0aWxsIGRvY3VtZW50RnJhZ21lbnRcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBpID0gc2VsZWN0cy5pbmRleE9mKG5vZGUucGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgIGlmIChpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIC8vIEFkZCA8c2VsZWN0PiB0byBsaXN0XG4gICAgICAgICAgICAgICAgaSA9IHNlbGVjdHMucHVzaChub2RlLnBhcmVudE5vZGUpIC0gMTtcbiAgICAgICAgICAgICAgICAvLyBJbml0IG9wdGlvbnNcbiAgICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zLnB1c2goW10pO1xuICAgICAgICAgICAgICAgIC8vIEluaXQgb3B0aW9ucyBjb250ZXh0c1xuICAgICAgICAgICAgICAgIHNlbGVjdE9wdGlvbnNDb250ZXh0cy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICAvLyBBdHRhY2ggY2hhbmdlIGxpc3RlbmVyXG4gICAgICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgc2VsZWN0c1VwZGF0aW5nW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGZvciAodmFyIG9pID0gMCwgb2xlbiA9IHNlbGVjdE9wdGlvbnNbaV0ubGVuZ3RoOyBvaSA8IG9sZW47IG9pKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc0NvbnRleHRzW2ldW29pXShwcm9wLCBzZWxlY3RPcHRpb25zW2ldW29pXS5zZWxlY3RlZCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzZWxlY3RzVXBkYXRpbmdbaV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBSZW1lbWJlciBvcHRpb24gYW5kIGNvbnRleHRcbiAgICAgICAgICAgICAgc2VsZWN0T3B0aW9uc1tpXS5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgICBzZWxlY3RPcHRpb25zQ29udGV4dHNbaV0ucHVzaChtb2RlbCk7XG4gICAgICAgICAgICB9LCAwKTtcblxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIG1vZGVsKHByb3AsIHRoaXMuc2VsZWN0ZWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgc2V0VGltZW91dChjaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogY2hlY2tlZD1cInt7dmFyfX1cIlxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSwgYXR0cikge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLm1hdGNoKFJFX0RFTElNSVRFRF9WQVIpO1xuICAgIGlmIChhdHRyID09PSAnanRtcGwtY2hlY2tlZCcgJiYgbWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihub2RlLCBhdHRyLCBtb2RlbCwgcHJvcCkge1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubmFtZSkge1xuICAgICAgICAgICAgICBpZiAocmFkaW9Hcm91cHNVcGRhdGluZ1tub2RlLm5hbWVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVswXVtpXS5jaGVja2VkID0gcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGUuY2hlY2tlZCA9IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHJhZGlvIGdyb3VwP1xuICAgICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICBpZiAoIXJhZGlvR3JvdXBzW25vZGUubmFtZV0pIHtcbiAgICAgICAgICAgICAgLy8gSW5pdCByYWRpbyBncm91cCAoWzBdOiBub2RlLCBbMV06IG1vZGVsKVxuICAgICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdID0gW1tdLCBbXV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBBZGQgaW5wdXQgdG8gcmFkaW8gZ3JvdXBcbiAgICAgICAgICAgIHJhZGlvR3JvdXBzW25vZGUubmFtZV1bMF0ucHVzaChub2RlKTtcbiAgICAgICAgICAgIC8vIEFkZCBjb250ZXh0IHRvIHJhZGlvIGdyb3VwXG4gICAgICAgICAgICByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzFdLnB1c2gobW9kZWwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChub2RlLnR5cGUgPT09ICdyYWRpbycgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICAgIHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSA9IHRydWU7XG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSBhbGwgaW5wdXRzIGZyb20gdGhlIGdyb3VwXG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmFkaW9Hcm91cHNbbm9kZS5uYW1lXVsxXVtpXShwcm9wLCByYWRpb0dyb3Vwc1tub2RlLm5hbWVdWzBdW2ldLmNoZWNrZWQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJhZGlvR3JvdXBzVXBkYXRpbmdbbm9kZS5uYW1lXSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSBjdXJyZW50IGlucHV0IG9ubHlcbiAgICAgICAgICAgICAgbW9kZWwocHJvcCwgbm9kZS5jaGVja2VkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFRpbWVvdXQoY2hhbmdlKTtcbiAgICAgICAgfVxuXG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICogYXR0cmlidXRlPVwie3t2YXJ9fVwiXG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgdmFyIG1hdGNoID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cikubWF0Y2goUkVfREVMSU1JVEVEX1ZBUik7XG4gICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBqdG1wbC5fZ2V0KG1vZGVsLCBwcm9wKTtcbiAgICAgICAgICAgIHJldHVybiB2YWwgP1xuICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyLCB2YWwpIDpcbiAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiBGYWxsYmFjayBydWxlLCBwcm9jZXNzIHZpYSBAc2VlIHV0ZW1wbGF0ZVxuICAgKiBTdHJpcCBqdG1wbC0gcHJlZml4XG4gICAqL1xuICBmdW5jdGlvbihub2RlLCBhdHRyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3A6IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpLFxuICAgICAgcnVsZTogZnVuY3Rpb24obm9kZSwgYXR0ciwgbW9kZWwsIHByb3ApIHtcbiAgICAgICAgdmFyIGF0dHJOYW1lID0gYXR0ci5yZXBsYWNlKCdqdG1wbC0nLCAnJyk7XG4gICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShcbiAgICAgICAgICAgIGF0dHJOYW1lLFxuICAgICAgICAgICAganRtcGwudXRlbXBsYXRlKHByb3AsIG1vZGVsLCBjaGFuZ2UpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjaGFuZ2UoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbl07XG4iLCIvKlxuICogTm9kZSBydWxlc1xuICpcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBbXG5cbiAgLyoganNoaW50IGV2aWw6IHRydWUgKi9cblxuXG5cblxuICAvKipcbiAgICoge3t2YXJ9fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIGlmIChub2RlLmlubmVySFRNTC5tYXRjaCgvXltcXHdcXC5cXC1dKyQvKSkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIHByb3A6IG5vZGUuaW5uZXJIVE1MLFxuXG4gICAgICAgIHJ1bGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb2RlbCwgcHJvcCkge1xuICAgICAgICAgIHZhciB0ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGp0bXBsLl9nZXQobW9kZWwsIHByb3ApIHx8ICcnKTtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGp0bXBsLl9nZXQobW9kZWwsIHByb3ApIHx8ICcnO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuXG5cblxuICAvKipcbiAgICoge3smdmFyfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXiYoW1xcd1xcLlxcLV0rKSQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7XG5cbiAgICAgICAgcHJvcDogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wKSB7XG5cbiAgICAgICAgICAvLyBBbmNob3Igbm9kZSBmb3Iga2VlcGluZyBzZWN0aW9uIGxvY2F0aW9uXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIC8vIE51bWJlciBvZiByZW5kZXJlZCBub2Rlc1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICAgICAgZnVuY3Rpb24gY2hhbmdlKCkge1xuICAgICAgICAgICAgdmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib2R5Jyk7XG4gICAgICAgICAgICB2YXIgaTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCByZW5kZXJpbmdcbiAgICAgICAgICAgIHdoaWxlIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYW5jaG9yLnByZXZpb3VzU2libGluZyk7XG4gICAgICAgICAgICAgIGxlbmd0aC0tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbC5pbm5lckhUTUwgPSBtb2RlbChwcm9wKSB8fCAnJztcbiAgICAgICAgICAgIGxlbmd0aCA9IGVsLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoZWwuY2hpbGROb2Rlc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZnJhZywgYW5jaG9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICB9XG5cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiB7ez5wYXJ0aWFsfX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAvLyBtYXRjaDogWzFdPXZhcl9uYW1lLCBbMl09J3NpbmdsZS1xdW90ZWQnIFszXT1cImRvdWJsZS1xdW90ZWRcIlxuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC8+KFtcXHdcXC5cXC1dKyl8JyhbXlxcJ10qKVxcJ3xcIihbXlwiXSopXCIvKTtcblxuICAgIGlmIChtYXRjaCkge1xuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBwcm9wOiBtYXRjaCxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIG1hdGNoKSB7XG5cbiAgICAgICAgICB2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgnJyk7XG4gICAgICAgICAgdmFyIHRhcmdldDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGxvYWRlcigpIHtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICAgIHRhcmdldCA9IGFuY2hvci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAganRtcGwubG9hZGVyKFxuICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgIG1hdGNoWzFdID9cbiAgICAgICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgICAgIG1vZGVsKG1hdGNoWzFdKSA6XG4gICAgICAgICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgICAgICAgIG1hdGNoWzJdIHx8IG1hdGNoWzNdLFxuICAgICAgICAgICAgICBtb2RlbFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAvLyBWYXJpYWJsZVxuICAgICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG1hdGNoWzFdLCBsb2FkZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIC8vIExvYWQgYXN5bmNcbiAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRlcik7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG4gIC8qKlxuICAgKiB7eyNzZWN0aW9ufX1cbiAgICovXG4gIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbWF0Y2ggPSBub2RlLmlubmVySFRNTC5tYXRjaCgvXiMoW1xcd1xcLlxcLV0rKSQvKTtcblxuICAgIGlmIChtYXRjaCkge1xuXG4gICAgICByZXR1cm4ge1xuXG4gICAgICAgIGJsb2NrOiBtYXRjaFsxXSxcblxuICAgICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9kZWwsIHByb3AsIHRlbXBsYXRlKSB7XG5cbiAgICAgICAgICAvLyBBbmNob3Igbm9kZSBmb3Iga2VlcGluZyBzZWN0aW9uIGxvY2F0aW9uXG4gICAgICAgICAgdmFyIGFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJycpO1xuICAgICAgICAgIC8vIE51bWJlciBvZiByZW5kZXJlZCBub2Rlc1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuICAgICAgICAgIC8vIEhvdyBtYW55IGNoaWxkTm9kZXMgaW4gb25lIHNlY3Rpb24gaXRlbVxuICAgICAgICAgIHZhciBjaHVua1NpemU7XG5cbiAgICAgICAgICBmdW5jdGlvbiB1cGRhdGUoaSkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgICAgdmFyIHBvcyA9IGFuY2hvckluZGV4IC0gbGVuZ3RoICsgaSAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgICAgdmFyIHNpemUgPSBjaHVua1NpemU7XG5cbiAgICAgICAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChwYXJlbnQuY2hpbGROb2Rlc1twb3MgLSAxXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShcbiAgICAgICAgICAgICAgICBldmFsKHRlbXBsYXRlICsgJyhtb2RlbChwcm9wKShpKSknKSxcbiAgICAgICAgICAgICAgICBwYXJlbnQuY2hpbGROb2Rlc1twb3NdXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGluc2VydChpbmRleCwgY291bnQpIHtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBhbmNob3IucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIHZhciBhbmNob3JJbmRleCA9IFtdLmluZGV4T2YuY2FsbChwYXJlbnQuY2hpbGROb2RlcywgYW5jaG9yKTtcbiAgICAgICAgICAgIHZhciBwb3MgPSBhbmNob3JJbmRleCAtIGxlbmd0aCArIGluZGV4ICogY2h1bmtTaXplO1xuICAgICAgICAgICAgdmFyIHNpemUgPSBjb3VudCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBpLCBmcmFnbWVudDtcblxuICAgICAgICAgICAgZm9yIChpID0gMCwgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICAgICAgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwocHJvcCkoaW5kZXggKyBpKSknKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgbGVuZ3RoID0gbGVuZ3RoICsgc2l6ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmdW5jdGlvbiBkZWwoaW5kZXgsIGNvdW50KSB7XG4gICAgICAgICAgICB2YXIgcGFyZW50ID0gYW5jaG9yLnBhcmVudE5vZGU7XG4gICAgICAgICAgICB2YXIgYW5jaG9ySW5kZXggPSBbXS5pbmRleE9mLmNhbGwocGFyZW50LmNoaWxkTm9kZXMsIGFuY2hvcik7XG4gICAgICAgICAgICB2YXIgcG9zID0gYW5jaG9ySW5kZXggLSBsZW5ndGggKyBpbmRleCAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgIHZhciBzaXplID0gY291bnQgKiBjaHVua1NpemU7XG5cbiAgICAgICAgICAgIGxlbmd0aCA9IGxlbmd0aCAtIHNpemU7XG5cbiAgICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHBhcmVudC5jaGlsZE5vZGVzW3Bvc10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgaW5zZXJ0KTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBkZWwpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygncmVuZGVyaW5nICcgKyB2YWwubGVuICsgJyB2YWx1ZXMnKTtcbiAgICAgICAgICAgICAgdmFyIGZ1bmMgPSBldmFsKHRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgdmFyIGNoaWxkLCBjaGlsZE1vZGVsO1xuICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB2YWwudmFsdWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IGV2ZW50IGRlbGVnYXRpb24gZm9yIGFycmF5IGluZGV4ZXNcbiAgICAgICAgICAgICAgICAvLyBBbHNvLCB1c2luZyB2YWwudmFsdWVzW2ldIGluc3RlYWQgb2YgdmFsW2ldXG4gICAgICAgICAgICAgICAgLy8gc2F2ZXMgQSBMT1Qgb2YgaGVhcCBtZW1vcnkuIEZpZ3VyZSBvdXQgaG93IHRvIGRvXG4gICAgICAgICAgICAgICAgLy8gb24gZGVtYW5kIG1vZGVsIGNyZWF0aW9uLlxuICAgICAgICAgICAgICAgIHZhbC5vbignY2hhbmdlJywgaSwgdXBkYXRlKGkpKTtcbiAgICAgICAgICAgICAgICAvL3JlbmRlci5hcHBlbmRDaGlsZChldmFsKHRlbXBsYXRlICsgJyh2YWwoaSkpJykpO1xuICAgICAgICAgICAgICAgIC8vcmVuZGVyLmFwcGVuZENoaWxkKGZ1bmModmFsLnZhbHVlc1tpXSkpO1xuICAgICAgICAgICAgICAgIGNoaWxkTW9kZWwgPSB2YWwoaSk7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBmdW5jKGNoaWxkTW9kZWwpO1xuICAgICAgICAgICAgICAgIGNoaWxkLl9fanRtcGxfXyA9IGNoaWxkTW9kZWw7XG4gICAgICAgICAgICAgICAgcmVuZGVyLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgY2h1bmtTaXplID0gfn4obGVuZ3RoIC8gbGVuKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT2JqZWN0P1xuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcodmFsKScpO1xuICAgICAgICAgICAgICBsZW5ndGggPSByZW5kZXIuY2hpbGROb2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIGNodW5rU2l6ZSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuX19qdG1wbF9fID0gbW9kZWw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghIXZhbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlciA9IGV2YWwodGVtcGxhdGUgKyAnKG1vZGVsKScpO1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjaHVua1NpemUgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGFuY2hvcik7XG4gICAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHByb3AsIGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG5cblxuXG5cbiAgLyoqXG4gICAqIHt7XmludmVydGVkX3NlY3Rpb259fVxuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBtYXRjaCA9IG5vZGUuaW5uZXJIVE1MLm1hdGNoKC9eXFxeKFtcXHdcXC5cXC1dKykkLyk7XG5cbiAgICBpZiAobWF0Y2gpIHtcblxuICAgICAgcmV0dXJuIHtcblxuICAgICAgICBibG9jazogbWF0Y2hbMV0sXG5cbiAgICAgICAgcnVsZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vZGVsLCBwcm9wLCB0ZW1wbGF0ZSkge1xuXG4gICAgICAgICAgLy8gQW5jaG9yIG5vZGUgZm9yIGtlZXBpbmcgc2VjdGlvbiBsb2NhdGlvblxuICAgICAgICAgIHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCcnKTtcbiAgICAgICAgICAvLyBOdW1iZXIgb2YgcmVuZGVyZWQgbm9kZXNcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBwcm9wID09PSAnLicgPyBtb2RlbCA6IG1vZGVsKHByb3ApO1xuICAgICAgICAgICAgdmFyIGksIGxlbiwgcmVuZGVyO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgb2xkIHJlbmRlcmluZ1xuICAgICAgICAgICAgd2hpbGUgKGxlbmd0aCkge1xuICAgICAgICAgICAgICBhbmNob3IucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhbmNob3IucHJldmlvdXNTaWJsaW5nKTtcbiAgICAgICAgICAgICAgbGVuZ3RoLS07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFycmF5P1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgdmFsLmxlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHZhbC5vbignaW5zZXJ0JywgY2hhbmdlKTtcbiAgICAgICAgICAgICAgdmFsLm9uKCdkZWxldGUnLCBjaGFuZ2UpO1xuICAgICAgICAgICAgICByZW5kZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHZhbC5sZW4gPT09IDApIHtcbiAgICAgICAgICAgICAgICByZW5kZXIuYXBwZW5kQ2hpbGQoZXZhbCh0ZW1wbGF0ZSArICcodmFsKGkpKScpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGxlbmd0aCA9IHJlbmRlci5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgYW5jaG9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHJlbmRlciwgYW5jaG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENhc3QgdG8gYm9vbGVhblxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGlmICghdmFsKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyID0gZXZhbCh0ZW1wbGF0ZSArICcobW9kZWwpJyk7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVuZGVyLmNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGFuY2hvci5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZW5kZXIsIGFuY2hvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChhbmNob3IpO1xuICAgICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBwcm9wLCBjaGFuZ2UpO1xuICAgICAgICB9XG5cblxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cblxuXG4gIC8qXG4gICAqIEZhbGxiYWNrIHJ1bGUsIG5vdCByZWNvZ25pemVkIGp0bXBsIHRhZ1xuICAgKi9cbiAgZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiB7XG4gICAgICBydWxlOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnUkVNT1ZFTUVMQVRFUicpKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5dO1xuIiwiLyoqXG4gKiBDb21waWxlIGEgdGVtcGxhdGUsIHBhcnNlZCBieSBAc2VlIHBhcnNlXG4gKlxuICogQHBhcmFtIHtkb2N1bWVudEZyYWdtZW50fSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtzdHJpbmd8dW5kZWZpbmVkfSBzb3VyY2VVUkwgLSBpbmNsdWRlIHNvdXJjZVVSTCB0byBhaWQgZGVidWdnaW5nXG4gKlxuICogQHJldHVybnMge3N0cmluZ30gLSBGdW5jdGlvbiBib2R5LCBhY2NlcHRpbmcgRnJlYWsgaW5zdGFuY2UgcGFyYW1ldGVyLCBzdWl0YWJsZSBmb3IgZXZhbCgpXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUodGVtcGxhdGUsIHNvdXJjZVVSTCwgZGVwdGgpIHtcblxuICB2YXIgcmksIHJ1bGVzLCBybGVuO1xuICB2YXIgbWF0Y2gsIGJsb2NrO1xuXG4gIC8vIEdlbmVyYXRlIGR5bmFtaWMgZnVuY3Rpb24gYm9keVxuICB2YXIgZnVuYyA9ICcoZnVuY3Rpb24obW9kZWwpIHtcXG4nICtcbiAgICAndmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksIG5vZGU7XFxuXFxuJztcblxuICBpZiAoIWRlcHRoKSB7XG4gICAgLy8gR2xvYmFsIGJvb2trZWVwaW5nXG4gICAgZnVuYyArPVxuICAgICAgJ3ZhciByYWRpb0dyb3VwcyA9IHt9O1xcbicgK1xuICAgICAgJ3ZhciByYWRpb0dyb3Vwc1VwZGF0aW5nID0ge307XFxuJyArXG4gICAgICAndmFyIHNlbGVjdHMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0c1VwZGF0aW5nID0gW107XFxuJyArXG4gICAgICAndmFyIHNlbGVjdE9wdGlvbnMgPSBbXTtcXG4nICtcbiAgICAgICd2YXIgc2VsZWN0T3B0aW9uc0NvbnRleHRzID0gW107XFxuXFxuJztcbiAgfVxuXG4gIC8vIFdyYXAgbW9kZWwgaW4gYSBGcmVhayBpbnN0YW5jZSwgaWYgbmVjZXNzYXJ5XG4gIGZ1bmMgKz0gJ21vZGVsID0gdHlwZW9mIG1vZGVsID09PSBcImZ1bmN0aW9uXCIgPycgK1xuICAgICdtb2RlbCA6ICcgK1xuICAgICd0eXBlb2YgbW9kZWwgPT09IFwib2JqZWN0XCIgPycgK1xuICAgICAgJ2p0bXBsKG1vZGVsKSA6JyArXG4gICAgICAnanRtcGwoe1wiLlwiOiBtb2RlbH0pO1xcblxcbic7XG5cbiAgLy8gSXRlcmF0ZSBjaGlsZE5vZGVzXG4gIGZvciAodmFyIGkgPSAwLCBjaGlsZE5vZGVzID0gdGVtcGxhdGUuY2hpbGROb2RlcywgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGgsIG5vZGU7XG4gICAgICAgaSA8IGxlbjsgaSsrKSB7XG5cbiAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcblxuICAgIHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXG4gICAgICAvLyBFbGVtZW50IG5vZGVcbiAgICAgIGNhc2UgMTpcblxuICAgICAgICAvLyBqdG1wbCB0YWc/XG4gICAgICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnU0NSSVBUJyAmJiBub2RlLnR5cGUgPT09ICd0ZXh0L2p0bXBsLXRhZycpIHtcblxuICAgICAgICAgIGZvciAocmkgPSAwLCBydWxlcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1ydWxlcy1ub2RlJyksIHJsZW4gPSBydWxlcy5sZW5ndGg7XG4gICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICBtYXRjaCA9IHJ1bGVzW3JpXShub2RlKTtcblxuICAgICAgICAgICAgLy8gUnVsZSBmb3VuZD9cbiAgICAgICAgICAgIGlmIChtYXRjaCkge1xuXG4gICAgICAgICAgICAgIC8vIEJsb2NrIHRhZz9cbiAgICAgICAgICAgICAgaWYgKG1hdGNoLmJsb2NrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBGZXRjaCBibG9jayB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgIGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAoaSsrO1xuICAgICAgICAgICAgICAgICAgICAoaSA8IGxlbikgJiYgIW1hdGNoRW5kQmxvY2sobWF0Y2guYmxvY2ssIGNoaWxkTm9kZXNbaV0uaW5uZXJIVE1MIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgaSsrKSB7XG4gICAgICAgICAgICAgICAgICBibG9jay5hcHBlbmRDaGlsZChjaGlsZE5vZGVzW2ldLmNsb25lTm9kZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgbWF0Y2guYmxvY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgICAnKGZyYWcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkobWF0Y2guYmxvY2spICsgJywgJyArICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBibG9jayxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVVSTCAmJiAoc291cmNlVVJMICsgJy0nICsgbm9kZS5pbm5lckhUTUwgKyAnWycgKyBpICsgJ10nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIChkZXB0aCB8fCAwKSArIDFcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICkgKyAnKTsnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIElubGluZSB0YWdcbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZnVuYyArPSAnKCcgKyBtYXRjaC5ydWxlLnRvU3RyaW5nKCkgKyAnKScgK1xuICAgICAgICAgICAgICAgICAgJyhmcmFnLCBtb2RlbCwgJyArIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgJyk7XFxuJztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFNraXAgcmVtYWluaW5nIHJ1bGVzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gZW5kIGl0ZXJhdGluZyBub2RlIHJ1bGVzXG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBDcmVhdGUgZWxlbWVudFxuICAgICAgICAgIGZ1bmMgKz0gJ25vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiJyArIG5vZGUubm9kZU5hbWUgKyAnXCIpO1xcbic7XG5cbiAgICAgICAgICAvLyBQcm9jZXNzIGF0dHJpYnV0ZXNcbiAgICAgICAgICBmb3IgKHZhciBhaSA9IDAsIGF0dHJpYnV0ZXMgPSBub2RlLmF0dHJpYnV0ZXMsIGFsZW4gPSBhdHRyaWJ1dGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgIGFpIDwgYWxlbjsgYWkrKykge1xuXG4gICAgICAgICAgICBmb3IgKHJpID0gMCwgcnVsZXMgPSByZXF1aXJlKCcuL2NvbXBpbGUtcnVsZXMtYXR0cicpLCBybGVuID0gcnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHJpIDwgcmxlbjsgcmkrKykge1xuXG4gICAgICAgICAgICAgIG1hdGNoID0gcnVsZXNbcmldKG5vZGUsIGF0dHJpYnV0ZXNbYWldLm5hbWUudG9Mb3dlckNhc2UoKSk7XG5cbiAgICAgICAgICAgICAgaWYgKG1hdGNoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNYXRjaCBmb3VuZCwgYXBwZW5kIHJ1bGUgdG8gZnVuY1xuICAgICAgICAgICAgICAgIGZ1bmMgKz0gJygnICsgbWF0Y2gucnVsZS50b1N0cmluZygpICsgJyknICtcbiAgICAgICAgICAgICAgICAgICcobm9kZSwgJyArXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShhdHRyaWJ1dGVzW2FpXS5uYW1lKSArIC8vIGF0dHJcbiAgICAgICAgICAgICAgICAgICcsIG1vZGVsLCAnICtcbiAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG1hdGNoLnByb3ApICsgICAgICAgICAgLy8gcHJvcFxuICAgICAgICAgICAgICAgICAgJyk7XFxuJztcblxuICAgICAgICAgICAgICAgIC8vIFNraXAgb3RoZXIgYXR0cmlidXRlIHJ1bGVzXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm9kZS5ub2RlTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgICAgICAgLy8gUmVjdXJzaXZlbHkgY29tcGlsZVxuICAgICAgICAgICAgZnVuYyArPSAnbm9kZS5hcHBlbmRDaGlsZCgnICtcbiAgICAgICAgICAgICAgY29tcGlsZShcbiAgICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgc291cmNlVVJMICYmIChzb3VyY2VVUkwgKyAnLScgKyBub2RlLm5vZGVOYW1lICsgJ1snICsgaSArICddJyksXG4gICAgICAgICAgICAoZGVwdGggfHwgMCkgKyAxXG4gICAgICAgICAgICApICsgJyhtb2RlbCkpO1xcbic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQXBwZW5kIHRvIGZyYWdtZW50XG4gICAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChub2RlKTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWs7XG5cblxuICAgICAgLy8gVGV4dCBub2RlXG4gICAgICBjYXNlIDM6XG4gICAgICAgIGZ1bmMgKz0gJ2ZyYWcuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkobm9kZS5kYXRhKSArICcpKTtcXG4nO1xuICAgICAgICBicmVhaztcblxuXG4gICAgICAvLyBDb21tZW50IG5vZGVcbiAgICAgIGNhc2UgODpcbiAgICAgICAgZnVuYyArPSAnZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVDb21tZW50KCcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KG5vZGUuZGF0YSkgKyAnKSk7XFxuJztcbiAgICAgICAgYnJlYWs7XG5cbiAgICB9IC8vIGVuZCBzd2l0Y2hcbiAgfSAvLyBlbmQgaXRlcmF0ZSBjaGlsZE5vZGVzXG5cbiAgZnVuYyArPSAncmV0dXJuIGZyYWc7IH0pJztcbiAgZnVuYyArPSBzb3VyY2VVUkwgP1xuICAgICdcXG4vL0Agc291cmNlVVJMPScgKyBzb3VyY2VVUkwgKyAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc291cmNlVVJMICsgJ1xcbicgOlxuICAgICcnO1xuXG4gIHJldHVybiBmdW5jO1xufVxuXG5cblxuXG5mdW5jdGlvbiBtYXRjaEVuZEJsb2NrKGJsb2NrLCBzdHIpIHtcbiAgdmFyIG1hdGNoID0gc3RyLm1hdGNoKC9cXC8oW1xcd1xcLlxcLV0rKT8vKTtcbiAgcmV0dXJuIG1hdGNoID9cbiAgICBibG9jayA9PT0gJycgfHwgIW1hdGNoWzFdIHx8IG1hdGNoWzFdID09PSBibG9jayA6XG4gICAgZmFsc2U7XG59XG5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcGlsZTtcbiIsIi8qXG5cbkV2YWx1YXRlIG9iamVjdCBmcm9tIGxpdGVyYWwgb3IgQ29tbW9uSlMgbW9kdWxlXG5cbiovXG5cbiAgICAvKiBqc2hpbnQgZXZpbDp0cnVlICovXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYywgbW9kZWwpIHtcblxuICAgICAgbW9kZWwgPSBtb2RlbCB8fCB7fTtcbiAgICAgIGlmICh0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbW9kZWwgPSBqdG1wbChtb2RlbCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIG1peGluKHRhcmdldCwgcHJvcGVydGllcykge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICBpZiAoLy8gUGx1Z2luXG4gICAgICAgICAgICAgIChwcm9wLmluZGV4T2YoJ19fJykgPT09IDAgJiZcbiAgICAgICAgICAgICAgICBwcm9wLmxhc3RJbmRleE9mKCdfXycpID09PSBwcm9wLmxlbmd0aCAtIDIpIHx8XG4gICAgICAgICAgICAgIC8vIENvbXB1dGVkIHByb3BlcnR5XG4gICAgICAgICAgICAgIHR5cGVvZiBwcm9wZXJ0aWVzW3Byb3BdID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnZhbHVlc1twcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldC52YWx1ZXNbcHJvcF0gPSBwcm9wZXJ0aWVzW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRhcmdldCBkb2Vzbid0IGFscmVhZHkgaGF2ZSBwcm9wP1xuICAgICAgICAgICAgaWYgKHRhcmdldChwcm9wKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRhcmdldChwcm9wLCBwcm9wZXJ0aWVzW3Byb3BdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYXBwbHlQbHVnaW5zKCkge1xuICAgICAgICB2YXIgcHJvcCwgYXJnO1xuICAgICAgICBmb3IgKHByb3AgaW4ganRtcGwucGx1Z2lucykge1xuICAgICAgICAgIHBsdWdpbiA9IGp0bXBsLnBsdWdpbnNbcHJvcF07XG4gICAgICAgICAgYXJnID0gbW9kZWwudmFsdWVzWydfXycgKyBwcm9wICsgJ19fJ107XG4gICAgICAgICAgaWYgKHR5cGVvZiBwbHVnaW4gPT09ICdmdW5jdGlvbicgJiYgYXJnICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBsdWdpbi5jYWxsKG1vZGVsLCBhcmcsIHRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGV2YWxPYmplY3QoYm9keSwgc3JjKSB7XG4gICAgICAgIHZhciByZXN1bHQsIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcbiAgICAgICAgc3JjID0gc3JjID9cbiAgICAgICAgICAnXFxuLy9AIHNvdXJjZVVSTD0nICsgc3JjICtcbiAgICAgICAgICAnXFxuLy8jIHNvdXJjZVVSTD0nICsgc3JjIDpcbiAgICAgICAgICAnJztcbiAgICAgICAgaWYgKGJvZHkubWF0Y2goL15cXHMqe1tcXFNcXHNdKn1cXHMqJC8pKSB7XG4gICAgICAgICAgLy8gTGl0ZXJhbFxuICAgICAgICAgIHJldHVybiBldmFsKCdyZXN1bHQ9JyArIGJvZHkgKyBzcmMpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgICAgICBldmFsKGJvZHkgKyBzcmMpO1xuICAgICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRNb2RlbChzcmMsIHRlbXBsYXRlLCBkb2MpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcbiAgICAgICAgaWYgKCFzcmMpIHtcbiAgICAgICAgICAvLyBObyBzb3VyY2VcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3JjLm1hdGNoKGp0bXBsLlJFX05PREVfSUQpKSB7XG4gICAgICAgICAgLy8gRWxlbWVudCBpbiB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2MucXVlcnlTZWxlY3RvcihzcmMpO1xuICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KGVsZW1lbnQuaW5uZXJIVE1MLCBzcmMpKTtcbiAgICAgICAgICBhcHBseVBsdWdpbnMoKTtcbiAgICAgICAgICBqdG1wbCh0YXJnZXQsIHRlbXBsYXRlLCBtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgbW9kZWwgdmlhIFhIUlxuICAgICAgICAgIC8vIE9sZGVyIElFcyBjb21wbGFpbiBpZiBVUkwgY29udGFpbnMgaGFzaFxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgIHZhciBtYXRjaCA9IHNyYy5tYXRjaChqdG1wbC5SRV9FTkRTX1dJVEhfTk9ERV9JRCk7XG4gICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gbWF0Y2ggJiYgbmV3IERPTVBhcnNlcigpXG4gICAgICAgICAgICAgICAgLnBhcnNlRnJvbVN0cmluZyhyZXNwLCAndGV4dC9odG1sJylcbiAgICAgICAgICAgICAgICAucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG4gICAgICAgICAgICAgIG1peGluKG1vZGVsLCBldmFsT2JqZWN0KG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLCBzcmMpKTtcbiAgICAgICAgICAgICAgYXBwbHlQbHVnaW5zKCk7XG4gICAgICAgICAgICAgIGp0bXBsKHRhcmdldCwgdGVtcGxhdGUsIG1vZGVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGxvYWRUZW1wbGF0ZSgpIHtcbiAgICAgICAgdmFyIGhhc2hJbmRleDtcblxuICAgICAgICBpZiAoIXNyYykgcmV0dXJuO1xuXG4gICAgICAgIGlmIChzcmMubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSBpcyB0aGUgY29udGVudHMgb2YgZWxlbWVudFxuICAgICAgICAgIC8vIGJlbG9uZ2luZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNyYyk7XG4gICAgICAgICAgbG9hZE1vZGVsKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsJyksIGVsZW1lbnQuaW5uZXJIVE1MLCBkb2N1bWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaEluZGV4ID0gc3JjLmluZGV4T2YoJyMnKTtcbiAgICAgICAgICAvLyBHZXQgdGVtcGxhdGUgdmlhIFhIUlxuICAgICAgICAgIGp0bXBsKCdHRVQnLCBoYXNoSW5kZXggPiAtMSA/IHNyYy5zdWJzdHJpbmcoMCwgaGFzaEluZGV4KSA6IHNyYyxcbiAgICAgICAgICAgIGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgICAgdmFyIG1hdGNoID0gc3JjLm1hdGNoKGp0bXBsLlJFX0VORFNfV0lUSF9OT0RFX0lEKTtcbiAgICAgICAgICAgICAgdmFyIGlmcmFtZSwgZG9jO1xuICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgICAgICAgICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgICAgZG9jID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudDtcbiAgICAgICAgICAgICAgICBkb2Mud3JpdGVsbihyZXNwKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZG9jID0gZG9jdW1lbnQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBtYXRjaCAmJiBkb2MucXVlcnlTZWxlY3RvcihtYXRjaFsxXSk7XG5cbiAgICAgICAgICAgICAgbG9hZE1vZGVsKFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwnKSA6ICcnLFxuICAgICAgICAgICAgICAgIG1hdGNoID8gZWxlbWVudC5pbm5lckhUTUwgOiByZXNwLFxuICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9hZFRlbXBsYXRlKCk7XG4gICAgfTtcbiIsIi8qXG4gKiBNYWluIGZ1bmN0aW9uXG4gKi9cbi8qIGpzaGludCBldmlsOiB0cnVlICovXG5mdW5jdGlvbiBqdG1wbCgpIHtcbiAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gIHZhciB0YXJnZXQsIHQsIHRlbXBsYXRlLCBtb2RlbDtcblxuICAvLyBqdG1wbCgnSFRUUF9NRVRIT0QnLCB1cmxbLCBwYXJhbWV0ZXJzWywgY2FsbGJhY2tbLCBvcHRpb25zXV1dKT9cbiAgaWYgKFsnR0VUJywgJ1BPU1QnXS5pbmRleE9mKGFyZ3NbMF0pID4gLTEpIHtcbiAgICByZXR1cm4gcmVxdWlyZSgnLi94aHInKS5hcHBseShudWxsLCBhcmdzKTtcbiAgfVxuXG4gIC8vIGp0bXBsKG9iamVjdCk/XG4gIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0Jykge1xuICAgIC8vIHJldHVybiBGcmVhayBpbnN0YW5jZVxuICAgIHJldHVybiByZXF1aXJlKCdmcmVhaycpKGFyZ3NbMF0pO1xuICB9XG5cbiAgLy8ganRtcGwodGFyZ2V0KT9cbiAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gcmV0dXJuIG1vZGVsXG4gICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSkuX19qdG1wbF9fO1xuICB9XG5cbiAgLy8ganRtcGwodGFyZ2V0LCB0ZW1wbGF0ZSwgbW9kZWxbLCBvcHRpb25zXSk/XG4gIGVsc2UgaWYgKFxuICAgICggYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlIHx8XG4gICAgICAodHlwZW9mIGFyZ3NbMF0gPT09ICdzdHJpbmcnKVxuICAgICkgJiZcblxuICAgICggKGFyZ3NbMV0gJiYgdHlwZW9mIGFyZ3NbMV0uYXBwZW5kQ2hpbGQgPT09ICdmdW5jdGlvbicpIHx8XG4gICAgICAodHlwZW9mIGFyZ3NbMV0gPT09ICdzdHJpbmcnKVxuICAgICkgJiZcblxuICAgIGFyZ3NbMl0gIT09IHVuZGVmaW5lZFxuXG4gICkge1xuXG4gICAgdGFyZ2V0ID0gYXJnc1swXSAmJiBhcmdzWzBdLm5vZGVUeXBlICA/XG4gICAgICBhcmdzWzBdIDpcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJnc1swXSk7XG5cbiAgICB0ZW1wbGF0ZSA9IGFyZ3NbMV0ubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkgP1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzWzFdKS5pbm5lckhUTUwgOlxuICAgICAgYXJnc1sxXTtcblxuICAgIG1vZGVsID1cbiAgICAgIHR5cGVvZiBhcmdzWzJdID09PSAnZnVuY3Rpb24nID9cbiAgICAgICAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICAgIGFyZ3NbMl0gOlxuICAgICAgICAvLyBvdGhlcndpc2Ugd3JhcFxuICAgICAgICBqdG1wbChcbiAgICAgICAgICB0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgLy8gb2JqZWN0XG4gICAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICAgdHlwZW9mIGFyZ3NbMl0gPT09ICdzdHJpbmcnICYmIGFyZ3NbMl0ubWF0Y2goanRtcGwuUkVfTk9ERV9JRCkgP1xuICAgICAgICAgICAgICAvLyBzcmMsIGxvYWQgaXRcbiAgICAgICAgICAgICAgcmVxdWlyZSgnLi9sb2FkZXInKVxuICAgICAgICAgICAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3NbMl0pLmlubmVySFRNTCkgOlxuXG4gICAgICAgICAgICAgIC8vIHNpbXBsZSB2YWx1ZSwgYm94IGl0XG4gICAgICAgICAgICAgIHsnLic6IGFyZ3NbMl19XG4gICAgICAgICk7XG5cbiAgICBpZiAodGFyZ2V0Lm5vZGVOYW1lID09PSAnU0NSSVBUJykge1xuICAgICAgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgdC5pZCA9IHRhcmdldC5pZDtcbiAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0LCB0YXJnZXQpO1xuICAgICAgdGFyZ2V0ID0gdDtcbiAgICB9XG5cbiAgICAvLyBBc3NvY2lhdGUgdGFyZ2V0IGFuZCBtb2RlbFxuICAgIHRhcmdldC5fX2p0bXBsX18gPSBtb2RlbDtcblxuICAgIC8vIEVtcHR5IHRhcmdldFxuICAgIHRhcmdldC5pbm5lckhUTUwgPSAnJztcblxuICAgIC8vIEFzc2lnbiBjb21waWxlZCB0ZW1wbGF0ZVxuICAgIC8vdGFyZ2V0LmFwcGVuZENoaWxkKHJlcXVpcmUoJy4vY29tcGlsZXInKSh0ZW1wbGF0ZSwgbW9kZWwsIGFyZ3NbM10pKTtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoXG4gICAgICBldmFsKFxuICAgICAgICBqdG1wbC5jb21waWxlKFxuICAgICAgICAgIGp0bXBsLnBhcnNlKHRlbXBsYXRlKSxcbiAgICAgICAgICB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWp0bXBsJylcbiAgICAgICAgKSArICcobW9kZWwpJ1xuICAgICAgKVxuICAgICk7XG4gIH1cbn1cblxuXG5cbi8qXG4gKiBPbiBwYWdlIHJlYWR5LCBwcm9jZXNzIGp0bXBsIHRhcmdldHNcbiAqL1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICB2YXIgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbiAgdmFyIHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qdG1wbF0nKTtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGFyZ2V0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxvYWRlcih0YXJnZXRzW2ldLCB0YXJnZXRzW2ldLmdldEF0dHJpYnV0ZSgnZGF0YS1qdG1wbCcpKTtcbiAgfVxufSk7XG5cblxuLypcbiAqIEV4cG9ydCBzdHVmZlxuICovXG5qdG1wbC5SRV9OT0RFX0lEID0gL14jW1xcd1xcLlxcLV0rJC87XG5qdG1wbC5SRV9FTkRTX1dJVEhfTk9ERV9JRCA9IC8uKygjW1xcd1xcLlxcLV0rKSQvO1xuXG5qdG1wbC5wYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbmp0bXBsLmNvbXBpbGUgPSByZXF1aXJlKCcuL2NvbXBpbGUnKTtcbmp0bXBsLmxvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG5qdG1wbC51dGVtcGxhdGUgPSByZXF1aXJlKCcuL3V0ZW1wbGF0ZScpO1xuanRtcGwuX2dldCA9IGZ1bmN0aW9uKG1vZGVsLCBwcm9wKSB7XG4gIHZhciB2YWwgPSBtb2RlbChwcm9wKTtcbiAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSA/XG4gICAgSlNPTi5zdHJpbmdpZnkodmFsLnZhbHVlcykgOlxuICAgIHZhbDtcbn07XG5cblxuLypcbiAqIFBsdWdpbnNcbiAqL1xuanRtcGwucGx1Z2lucyA9IHtcbiAgaW5pdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgIC8vIENhbGwgYXN5bmMsIGFmdGVyIGp0bXBsIGhhcyBjb25zdHJ1Y3RlZCB0aGUgRE9NXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBhcmcuY2FsbCh0aGF0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKlxuICogRXhwb3J0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0ganRtcGw7XG4iLCIvKipcbiAqIFBhcnNlIGEgdGV4dCB0ZW1wbGF0ZSB0byBET00gc3RydWN0dXJlIHJlYWR5IGZvciBjb21waWxpbmdcbiAqIEBzZWUgY29tcGlsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZVxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5mdW5jdGlvbiBwYXJzZSh0ZW1wbGF0ZSkge1xuXG4gIHZhciBpZnJhbWUsIGJvZHk7XG5cbiAgZnVuY3Rpb24gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSkge1xuXG4gICAgLy8gcmVwbGFjZSB7e3t0YWd9fX0gd2l0aCB7eyZ0YWd9fVxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgvXFx7XFx7XFx7KFtcXFNcXHNdKj8pXFx9XFx9XFx9L2csICd7eyYkMX19Jyk7XG5cbiAgICAvLyAxLiB3cmFwIGVhY2ggbm9uLWF0dHJpYnV0ZSB0YWcgaW4gPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj5cbiAgICAvLyAyLiByZW1vdmUgTXVzdGFjaGUgY29tbWVudHNcbiAgICAvLyBUT0RPOiBoYW5kbGUgdGFncyBpbiBIVE1MIGNvbW1lbnRzXG4gICAgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFxTXFxzXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG1hdGNoMSwgcG9zKSB7XG4gICAgICAgIHZhciBoZWFkID0gdGVtcGxhdGUuc2xpY2UoMCwgcG9zKTtcbiAgICAgICAgdmFyIGluc2lkZVRhZyA9ICEhaGVhZC5tYXRjaCgvPFtcXHdcXC1dK1tePl0qPyQvKTtcbiAgICAgICAgdmFyIG9wZW5pbmcgPSBoZWFkLm1hdGNoKC88KHNjcmlwdHxTQ1JJUFQpL2cpO1xuICAgICAgICB2YXIgY2xvc2luZyA9IGhlYWQubWF0Y2goLzxcXC8oc2NyaXB0fFNDUklQVCkvZyk7XG4gICAgICAgIHZhciBpbnNpZGVTY3JpcHQgPVxuICAgICAgICAgICAgKG9wZW5pbmcgJiYgb3BlbmluZy5sZW5ndGggfHwgMCkgPiAoY2xvc2luZyAmJiBjbG9zaW5nLmxlbmd0aCB8fCAwKTtcbiAgICAgICAgdmFyIGluc2lkZUNvbW1lbnQgPSAhIWhlYWQubWF0Y2goLzwhLS1cXHMqJC8pO1xuICAgICAgICB2YXIgaXNNdXN0YWNoZUNvbW1lbnQgPSBtYXRjaDEuaW5kZXhPZignIScpID09PSAwO1xuXG4gICAgICAgIHJldHVybiBpbnNpZGVUYWcgfHwgaW5zaWRlQ29tbWVudCA/XG4gICAgICAgICAgaXNNdXN0YWNoZUNvbW1lbnQgP1xuICAgICAgICAgICAgJycgOlxuICAgICAgICAgICAgbWF0Y2ggOlxuICAgICAgICAgIGluc2lkZVNjcmlwdCA/XG4gICAgICAgICAgICBtYXRjaCA6XG4gICAgICAgICAgICAnPHNjcmlwdCB0eXBlPVwidGV4dC9qdG1wbC10YWdcIj4nICsgbWF0Y2gxLnRyaW0oKSArICdcXHgzQy9zY3JpcHQ+JztcbiAgICAgIH1cbiAgICApO1xuICAgIC8vIHByZWZpeCAnc2VsZWN0ZWQnIGFuZCAnY2hlY2tlZCcgYXR0cmlidXRlcyB3aXRoICdqdG1wbC0nXG4gICAgLy8gKHRvIGF2b2lkIFwic3BlY2lhbFwiIHByb2Nlc3NpbmcsIG9oIElFOClcbiAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoXG4gICAgICAvKDwoPzpvcHRpb258T1BUSU9OKVtePl0qPykoPzpzZWxlY3RlZHxTRUxFQ1RFRCk9L2csXG4gICAgICAnJDFqdG1wbC1zZWxlY3RlZD0nKTtcblxuICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShcbiAgICAgIC8oPCg/OmlucHV0fElOUFVUKVtePl0qPykoPzpjaGVja2VkfENIRUNLRUQpPS9nLFxuICAgICAgJyQxanRtcGwtY2hlY2tlZD0nKTtcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIHRlbXBsYXRlID0gcHJlcHJvY2Vzcyh0ZW1wbGF0ZSk7XG4gIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICBpZnJhbWUuY29udGVudERvY3VtZW50LndyaXRlbG4oJzwhZG9jdHlwZSBodG1sPlxcbjxodG1sPjxib2R5PicgKyB0ZW1wbGF0ZSArICc8L2JvZHk+PC9odG1sPicpO1xuICBib2R5ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5ib2R5O1xuICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG5cbiAgcmV0dXJuIGJvZHk7XG59XG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiLyoqXG4gKiB1dGVtcGxhdGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1vZGVsIC0gZGF0YSBhcyBGcmVhayBpbnN0YW5jZVxuICogQHBhcmFtIHtvcHRpb25hbCBmdW5jdGlvbn0gb25DaGFuZ2UgLSB3aWxsIGJlIGNhbGxlZCB3aGVuZXZlciB1c2VkIG1vZGVsIHByb3BlcnR5IGNoYW5nZXNcbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHJlbmRlcmVkIHRlbXBsYXRlIHVzaW5nIG1vZGVsXG4gKlxuICogQmFzaWMgdGVtcGxhdGUgcmVuZGVyaW5nLlxuICogU3VwcG9ydGVkIHRhZ3M6IHt7dmFyaWFibGV9fSwge3sjc2VjdGlvbn19LCB7e15pbnZlcnRlZF9zZWN0aW9ufX1cbiAqIChzaG9ydCBjbG9zaW5nIHRhZ3Mge3svfX0gc3VwcG9ydGVkKVxuICpcbiAqIERvZXMgTk9UIHN1cHBvcnQgbmVzdGVkIHNlY3Rpb25zLCBzbyBzaW1wbGUgcGFyc2luZyB2aWEgcmVnZXggaXMgcG9zc2libGUuXG4gKi9cbmZ1bmN0aW9uIHV0ZW1wbGF0ZSh0ZW1wbGF0ZSwgbW9kZWwsIG9uQ2hhbmdlKSB7XG4gIHJldHVybiB0ZW1wbGF0ZVxuICAgIC8vIHt7I3NlY3Rpb259fSBzZWN0aW9uQm9keSB7ey99fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyMoW1xcd1xcLlxcLV0rKVxcfVxcfSguKz8pXFx7XFx7XFwvKFtcXHdcXC5cXC1dKj8pXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgb3BlblRhZywgYm9keSwgY2xvc2VUYWcsIHBvcykge1xuICAgICAgICBpZiAoY2xvc2VUYWcgIT09ICcnICYmIGNsb3NlVGFnICE9PSBvcGVuVGFnKSB7XG4gICAgICAgICAgdGhyb3cgJ2p0bXBsOiBVbmNsb3NlZCAnICsgb3BlblRhZztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIG9wZW5UYWcsIG9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdmFsID0gb3BlblRhZyA9PT0gJy4nID8gbW9kZWwgOiBtb2RlbChvcGVuVGFnKTtcbiAgICAgICAgcmV0dXJuICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gIT09IHVuZGVmaW5lZCkgP1xuICAgICAgICAgICAgLy8gQXJyYXlcbiAgICAgICAgICAgICh2YWwubGVuID4gMCkgP1xuICAgICAgICAgICAgICAvLyBOb24tZW1wdHlcbiAgICAgICAgICAgICAgdmFsLnZhbHVlc1xuICAgICAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oZWwsIGkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB1dGVtcGxhdGUoYm9keS5yZXBsYWNlKC9cXHtcXHtcXC5cXH1cXH0vZywgJ3t7JyArIGkgKyAnfX0nKSwgdmFsLCBvbkNoYW5nZSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuam9pbignJykgOlxuICAgICAgICAgICAgICAvLyBFbXB0eVxuICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAvLyBPYmplY3Qgb3IgYm9vbGVhbj9cbiAgICAgICAgICAgICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nICYmIHZhbC5sZW4gPT09IHVuZGVmaW5lZCkgP1xuICAgICAgICAgICAgICAvLyBPYmplY3RcbiAgICAgICAgICAgICAgdXRlbXBsYXRlKGJvZHksIHZhbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgLy8gQ2FzdCB0byBib29sZWFuXG4gICAgICAgICAgICAgICghIXZhbCkgP1xuICAgICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgICAnJztcbiAgICAgIH1cbiAgICApXG4gICAgLy8ge3teaW52ZXJ0ZWRfc2VjdGlvbn19IHNlY3Rpb25Cb2R5IHt7L319XG4gICAgLnJlcGxhY2UoXG4gICAgICAvXFx7XFx7XFxeKFtcXHdcXC5cXC1dKylcXH1cXH0oLis/KVxce1xce1xcLyhbXFx3XFwuXFwtXSo/KVxcfVxcfS9nLFxuICAgICAgZnVuY3Rpb24obWF0Y2gsIG9wZW5UYWcsIGJvZHksIGNsb3NlVGFnLCBwb3MpIHtcbiAgICAgICAgaWYgKGNsb3NlVGFnICE9PSAnJyAmJiBjbG9zZVRhZyAhPT0gb3BlblRhZykge1xuICAgICAgICAgIHRocm93ICdqdG1wbDogVW5jbG9zZWQgJyArIG9wZW5UYWc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBvbkNoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIG1vZGVsLm9uKCdjaGFuZ2UnLCBvcGVuVGFnLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IG9wZW5UYWcgPT09ICcuJyA/IG1vZGVsIDogbW9kZWwob3BlblRhZyk7XG4gICAgICAgIHJldHVybiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwubGVuICE9PSB1bmRlZmluZWQpID9cbiAgICAgICAgICAgIC8vIEFycmF5XG4gICAgICAgICAgICAodmFsLmxlbiA9PT0gMCkgP1xuICAgICAgICAgICAgICAvLyBFbXB0eVxuICAgICAgICAgICAgICB1dGVtcGxhdGUoYm9keSwgbW9kZWwsIG9uQ2hhbmdlKSA6XG4gICAgICAgICAgICAgIC8vIE5vbi1lbXB0eVxuICAgICAgICAgICAgICAnJyA6XG4gICAgICAgICAgICAvLyBDYXN0IHRvIGJvb2xlYW5cbiAgICAgICAgICAgICghdmFsKSA/XG4gICAgICAgICAgICAgIHV0ZW1wbGF0ZShib2R5LCBtb2RlbCwgb25DaGFuZ2UpIDpcbiAgICAgICAgICAgICAgJyc7XG4gICAgICB9XG4gICAgKVxuICAgIC8vIHt7dmFyaWFibGV9fVxuICAgIC5yZXBsYWNlKFxuICAgICAgL1xce1xceyhbXFx3XFwuXFwtXSspXFx9XFx9L2csXG4gICAgICBmdW5jdGlvbihtYXRjaCwgdmFyaWFibGUsIHBvcykge1xuICAgICAgICBpZiAodHlwZW9mIG9uQ2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgbW9kZWwub24oJ2NoYW5nZScsIHZhcmlhYmxlLCBvbkNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1vZGVsKHZhcmlhYmxlKSA9PT0gdW5kZWZpbmVkID8gJycgOiBtb2RlbCh2YXJpYWJsZSkgKyAnJztcbiAgICAgIH1cbiAgICApO1xufVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSB1dGVtcGxhdGU7XG4iLCIvKlxuXG5SZXF1ZXN0cyBBUElcblxuKi9cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGVuLCBwcm9wLCBwcm9wcywgcmVxdWVzdDtcbiAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIC8vIExhc3QgZnVuY3Rpb24gYXJndW1lbnRcbiAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3MucmVkdWNlKFxuICAgICAgICBmdW5jdGlvbiAocHJldiwgY3Vycikge1xuICAgICAgICAgIHJldHVybiB0eXBlb2YgY3VyciA9PT0gJ2Z1bmN0aW9uJyA/IGN1cnIgOiBwcmV2O1xuICAgICAgICB9LFxuICAgICAgICBudWxsXG4gICAgICApO1xuXG4gICAgICB2YXIgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcblxuICAgICAgaWYgKHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9XG5cbiAgICAgIGZvciAoaSA9IDAsIHByb3BzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob3B0cyksIGxlbiA9IHByb3BzLmxlbmd0aDtcbiAgICAgICAgICBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgcHJvcCA9IHByb3BzW2ldO1xuICAgICAgICB4aHJbcHJvcF0gPSBvcHRzW3Byb3BdO1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0ID1cbiAgICAgICAgKHR5cGVvZiBhcmdzWzJdID09PSAnc3RyaW5nJykgP1xuXG4gICAgICAgICAgLy8gU3RyaW5nIHBhcmFtZXRlcnNcbiAgICAgICAgICBhcmdzWzJdIDpcblxuICAgICAgICAgICh0eXBlb2YgYXJnc1syXSA9PT0gJ29iamVjdCcpID9cblxuICAgICAgICAgICAgLy8gT2JqZWN0IHBhcmFtZXRlcnMuIFNlcmlhbGl6ZSB0byBVUklcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGFyZ3NbMl0pLm1hcChcbiAgICAgICAgICAgICAgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB4ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3NbMl1beF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLmpvaW4oJyYnKSA6XG5cbiAgICAgICAgICAgIC8vIE5vIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICcnO1xuXG4gICAgICB2YXIgb25sb2FkID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIHJlc3A7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3AgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJlc3AgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCByZXNwLCBldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgaWYgKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApIHtcbiAgICAgICAgICAgIG9ubG9hZC5jYWxsKHRoaXMsICdkb25lJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2p0bXBsIFhIUiBlcnJvcjogJyArIHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHhoci5vcGVuKGFyZ3NbMF0sIGFyZ3NbMV0sXG4gICAgICAgIChvcHRzLmFzeW5jICE9PSB1bmRlZmluZWQgPyBvcHRzLmFzeW5jIDogdHJ1ZSksXG4gICAgICAgIG9wdHMudXNlciwgb3B0cy5wYXNzd29yZCk7XG5cbiAgICAgIHhoci5zZW5kKHJlcXVlc3QpO1xuXG4gICAgICByZXR1cm4geGhyO1xuXG4gICAgfTtcbiJdfQ==
(6)
});
