var async = require('async')
var path = require('path');
var fs = require('fs');

//load engines 
var engines = [];
function load_engines() {
	console.log('load engines');
	engines = [];
	var files = fs.readdirSync(path.join(__dirname, '/engines'));
	files.forEach(function(file) {
		engines.push(require(path.join(__dirname,'/engines',file)).get());
	});
}

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

var auto_verify_timer = null;
function auto_verify_engines(now) {
	if (auto_verify_timer) {
		clearTimeout(auto_verify_timer);
		auto_verify_timer = null;
	}
	if (now) {
		verify_engines(function(err) {
			console.log('auto verify');
			auto_verify_engines();
		});
		return;
	}
	auto_verify_timer = setTimeout(function() {
		verify_engines(function(err) {
			console.log('auto verify');
			auto_verify_engines();
		});
	}, 60*60*1000);
}

// init
console.log('engine-loader init');
load_engines();
auto_verify_engines();

var watch_timer = null;
fs.watch(__dirname+'/engines').on('change', function (event, filename) {
	if (!watch_timer) {
		watch_timer = setTimeout(function() { watch_timer = null }, 1000); 
		console.log(event);
		if (event == 'change') {
			console.log('watch:' + filename + ' ' + event);
			delete require.cache[path.join(__dirname,'engines/'+filename)];
			load_engines();
			auto_verify_engines(true);
		}
	}
});

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