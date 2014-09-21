var api = require('./engines/torrentcup');
var async = require('async');

var rand = function(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
};

var engine = api.get();
console.log(engine.typelist);
var type = '';
for (var k in engine.typelist) {
	type = k;
	break;
}

var value = '';
async.series([
	function(next) {
		console.log('1');
		engine.verify(next);
	},
	function(next) {
		console.log('2.');
		engine.search(type, '가', function(err, result) {
			console.log(result);
			if (result && result.length) {
				//value = result[rand(0, result.length)];
				value = result[0];
				next();
			} else {
				next('결과없음');
			}
		});
	},
	function(next) {
		engine.download(value.value, value.title, function(err, files) {
			console.log('complete');
			console.log(files);
			next();
		});
	}
], function(err) {
	if(err) console.log(err);
	console.log('end');
});

