var cheerio = require("cheerio");
var async = require("async");
var HttpClient = require('./http-client.js');

var SimpleEngine = module.exports = function(opt) {
	var navi = HttpClient.get();
	this.name = opt.name;
	this.host = opt.host;
	this.typelist = opt.typelist;
	this.mapping = opt.mapping;
	this.charset = opt.charset;

	this.search_path = opt.search_path;
	this.search_filter = opt.search_filter;

	this.listlink_match = opt.listlink_match;
	this.listlink_filter = opt.listlink_filter;

	this.download_match = opt.download_match;
	this.download_filter = opt.download_filter;

	this.verify = function(callback) {
		var self = this;
		navi.request({method:'HEAD', host:self.host, path:'/'}, function(err) {
			if (err) {
				console.log('['+self.name+'] error');
			} else {
				console.log('['+self.name+'] verify');
				self.enable = true;
			}
			callback(err);
		});
	};

	this.search = function(type, keyword, page, callback) {
		console.log('['+this.name+'] search');
		var path = this.search_path({type:type,keyword:keyword,page:page});
		var self = this;
		navi.request({host:self.host, path:path, encoding:self.charset}, function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			self.search_filter($);

			var result = [];
			$(self.listlink_match).each(function() {
				var item = self.listlink_filter($(this), {type:type,keyword:HttpClient.urlencode(keyword, self.charset),page:page});
				if (item) {
					item.value = item.link;
					result.push(item);
				}
			});

			callback(false, result);
		});
	};

	this.download = function(value, name, callback) {
		var self = this;
console.log('>>'+self.host);
console.log('>>'+value);
		navi.request({host:self.host, path:value, encoding:self.charset}, function(err, body) {
			if (err) {
				return callback(1, body);
			}
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			var dirname = name.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '');
			var tasks = [];
			var filenames = [];
			var messages = [];
			$(self.download_match).each(function(item, index) {
				var file = self.download_filter($(this));
				if (file && file.link) {
					var noname = dirname+(index>0?'('+index+')':'');
					var time = +new Date();
					tasks.push(function(next) {
						navi.download(self.host, file.link, __dirname+'/tmp/'+time, self.charset, function(err, ret) {
							if (err) {
								messages.push(noname+' '+ret);
							} else {
								console.log(ret);
								if (file.name) ret.name = file.name;
								filenames.push(ret);
							}
							next();
						});
					});
				}
			});
			async.parallel(tasks, function() {
				callback(false, {
					message: messages.join('\n'),
					files: filenames
				});
			});

		});
	};

	return this;
};
