var fs = require('fs');
var server = require('webserver').create();
var page = new WebPage();

page.onConsoleMessage = function(msg) {
  // Redirect page console to console
  console.log(msg);
};

page.open('http://localhost:3000/tests/index.html', function() {
  // Give time to tests to evaluate
  setTimeout(function() {
    phantom.exit();
  }, 0);
});

server.listen(3000, function(request, response) {
  console.log('request ' + JSON.stringify(request));
  response.statusCode = 200;
  response.write(fs.read(fs.workingDirectory + request.url));
  response.close();
});
