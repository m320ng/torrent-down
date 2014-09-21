var cheerio = require("cheerio");
var async = require('async');
var engine = require('../engine');

var name = 'dakdown';
var host = 'dakdown.net';
var typelist = {
	'movie': '영화',
	'kortv': '한국TV',
	'fortv': '외국TV',
	'ani': '애니메이션',
	'music': '음악',
};
var mapping = {
	'한국예능': 'kortv',
	'한국시사': 'kortv',
};

var Engine = module.exports = function() {
	var navi = engine.http();
	this.name = name;
	this.typelist = typelist;
	this.mapping = mapping;

	this.verify = function(callback) {
		var self = this;
		navi.head(host, '/', function(err) {
			if (err) {
				console.log('['+name+'] error');
			} else {
				console.log('['+name+'] verify');
				self.enable = true;
			}
			callback(err);
		});
	};

	this.search = function(type, keyword, page, callback) {
		console.log('['+name+'] search');
		var path = '/bbs/board.php?bo_table='+type+'&sca=&sfl=wr_subject&stx='+engine.urlencode(keyword, 'euc-kr')+'&sop=and';
		if (page && page > 1) path += '&page=' + page;
		//console.log(path);
		navi.get(host, path, 'euc-kr', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			var result = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+type)!=-1) {
					result.push({
						value: href.substring(2),
						title: $(this).text(),
						info: 'http://'+host+href.substring(2),
					});
				}
			});

			callback(false, result);
		});
	};

	this.download = function(value, name, callback) {
		navi.get(host, value, 'euc-kr', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			name = name.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '');

			var tasks = [];
			var filenames = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && href.indexOf('javascript:file_download')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					var index = tasks.length;
					//name = $(this).text();
					//console.log(filelink);
					tasks.push(function(next) {
						navi.download(host, filelink, name+(index>0?'('+index+')':''), 'euc-kr', function(err, filename) {
							console.log(filename + ' saved');
							filenames.push(filename);
							next();
						});
					});
				}
			});
			async.parallel(tasks, function() {
				callback(false, filenames);
			});

		});
	};

	return this;
};

Engine.get = function() {
	return new Engine();
};