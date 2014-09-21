var cheerio = require("cheerio");
var async = require('async');
var engine = require('../engine');

var name = 'torrentdada';
var host = 'http://www.torrentdada.com';
var typelist = {
	'TV_Variety': '예능',
	'TV_Docu': '시사교양',
	'TV_Drama': '드라마',
	'Movie_01': '해외영화',
	'Movie_02': '국내영화',
	'MP3': '음악',
	'Anime': '애니',
};
var mapping = {
	'한국예능': 'B24',
	'한국시사': 'B25',
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
		
		var path = '/?_filter=search&act=&vid=&mid='+type+'&category=&search_target=title&search_keyword='+engine.urlencode(keyword, 'utf-8');
		if (page && page > 1) path += '&page=' + page;
		//console.log(path);
		navi.get(host, path, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			$('#hot_list').remove(); // 인기게시물제거

			var result = [];
			var skip = {};
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && /document_srl\=[0-9]+/.test(href) && href.indexOf('mid='+type)!=-1) {
					href = href.replace(/&amp;/g,'&');
					if (!skip[href]) {
						skip[href] = $(this).text().replace(/[\t\n\r]/g,'');
					} else {
						if ($(this).text().length > skip[href].length) {
							skip[href] = $(this).text();
						}
					}
				}
			});
			for (var k in skip) {
				result.push({
					value:k,
					title:skip[k],
					info: 'http://'+host+k,
				});
			}

			callback(false, result);
		});
	};

	this.download = function(value, name, callback) {
		navi.get(host, value, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			name = name.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '');

			var tasks = [];
			var filenames = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && href.indexOf('module=file')!=-1 && /file_srl\=[0-9]+/.test(href)) {
					href = href.replace(/&amp;/g,'&');
					//console.log(name);
					//console.log(href);
					var filelink = href;
					var index = tasks.length;
					//name = $(this).text();
					tasks.push(function(next) {
						navi.download(host, filelink, '', 'utf-8', function(err, filename) {
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