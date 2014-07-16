/*

### Partial 

* {{>"#id"}}
* {{>"//url"}}
* {{>"//url#id"}}
* {{>partialSrc}}

Replaces parent tag contents, always wrap in a tag

*/

    module.exports = function(tag, node, attr, model, options) {
      var consts = require('../consts');
      var match = tag.match(consts.RE_PARTIAL);
      var anchor = document.createComment('');

      var loader = match && 
        function() {
          require('../loader')(
            anchor.parentNode,
            match[1] ?
              // Variable
              model(match[1]) :
              // Literal
              match[2] || match[3],
            model.values
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
