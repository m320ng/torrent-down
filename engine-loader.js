var async = require('async')
var path = require('path');
var fs = require('fs');

//load engines 
var engines = [];
var files = fs.readdirSync(path.join(__dirname, '/engines'));
files.forEach(function(file) {
	engines.push(require(path.join(__dirname,'/engines',file)).get());
});

/* auto verify
 ------------------------------------------------------------------------------------ */
function verify_engines(callback) {
	var tasks = [];
	var starttime = +new Date();
	engines.forEach(function(item) {
		item.enable = true;
		tasks.push(function(next) {
			item.verify(function(err) {
				var endtime = +new Date();
				item.ping = ((endtime - starttime)/1000).toFixed(2);
				if (err) item.enable = false;
				next();
			});
		});
	});

	async.parallel(tasks, function(err) {
		engines.sort(function(a, b) {
			return a.ping - b.ping;
		});
		if (callback) callback(err);
	});
}
setInterval(function() {
	verify_engines(function(err) {
		console.log('auto verify');
	});
}, 60*60*1000);

module.exports = {
	get: function(name) {
		var current = engines[0];
		engines.forEach(function(item) {
			if (item.name==name) {			
				current = item;
			}
		});
		return current;
	},
	all: function() {
		return engines;
	},
	verify_engines: verify_engines
}