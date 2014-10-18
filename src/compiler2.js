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

