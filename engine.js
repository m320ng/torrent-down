var http = require("http");
var fs = require('fs');
var Iconv = require("iconv").Iconv;
var util = require('util');
var _path = require('path')

var _headers = {
	'Content-Type': 'text/html',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
	'Connection': 'Keep-Alive'
};

var Engine = module.exports = function () {
	if (!(this instanceof Engine)) return new Engine();
	this._cookie = {};
	this._referer = '';

	var self = this;

	this.cookie = function(k, val) {
		if (k==undefined && val==undefined) {
			var _cookie = [];
			for (var k in this._cookie) {
				_cookie.push(k+'='+this._cookie[k]);
			}
			return _cookie.join('; ');
		} else if (val==undefined) {
			return this._cookie[k];
		} else {
			this._cookie[k] = val;
		}
	};
	
	this.mergeCookie = function(cookies) {
		for (var k in cookies) {
			this._cookie[k] = cookies[k];
		}
	};

	this.mergeCookieString = function(cookies) {
		var items = cookies.split('; ')
		var self = this;
		items.forEach(function(item) {
			if (item) {
				var c = item.split('=');
				self._cookie[c[0]] = c[1];
			}
		});
	};

	this._filter = function(header) {
		//console.log(header);
		if (header['set-cookie']) {
			header['set-cookie'].forEach(function(cookie) {
				var item = cookie.split(';')[0];
				if (item) {
					var c = item.split('=');
					self._cookie[c[0]] = c[1];
				}
			});
		}
	};

	this.head = function (host, path, callback) {
		var options = {
			hostname: host,
			port: 80,
			path: path,
			method: 'HEAD',
			headers: _headers
		};
		options.headers['Host'] = host;
		options.headers['Cookie'] = this.cookie();
		if (this._referer) {
			options.headers['Referer'] = this._referer;
		}

		var req = http.request(options, function(res) {
			self._filter(res.headers);
			callback(false, res.headers);
		});
		req.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(true, e.message);
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});
		req.end();
	};

	this.download = function (host, path, name, encoding, callback) {
		var options = {
			hostname: host,
			port: 80,
			path: path,
			encoding: 'binary',
			method: 'GET',
			headers: _headers
		};
		options.headers['Host'] = host;
		options.headers['Cookie'] = this.cookie();
		if (this._referer) {
			options.headers['Referer'] = this._referer;
		}

		var file;
		var filename = '';
		var req = http.request(options, function(res) {
			//if (res.headers['content-type']!='file/unknown' || res.statusCode!=200) {
			if (res.statusCode!=200) {
				if (res.statusCode==302) { // redirection
					self.download(host, res.headers['location'], name, encoding, callback);
					return;
				}
				callback(true, '오류가 발생했습니다. (' + res.statusCode + ')');
				return;
			}
			var dispos = res.headers['content-disposition'];
			if (dispos) {
				var p = dispos.indexOf('filename=');
				if (p!=-1) {
					filename = dispos.substring(p + 'filename='.length);
					if (filename[0]=='"' && filename[filename.length-1]=='"') {
						filename = filename.substring(1, filename.length-1);
					}
					if (filename[0]=="'" && filename[filename.length-1]=="'") {
						filename = filename.substring(1, filename.length-1);
					}
					if (encoding=='utf8' || encoding=='utf-8') {
						filename = decodeURIComponent(filename);
					}
				}
			}

			if (name) {
				var ext = _path.extname(filename);
				filename = name + ext;
			}

			if (!filename) {
				callback(true, '파일명을 선정하지 못했습니다.');
				return;
			}

			file = fs.createWriteStream(filename);
			res.pipe(file);
			file.on('finish', function() {
				file.close(function(err) {
					callback(false, filename);
				});
			});
		});

		req.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(true, e.message);
			if (filename) fs.unlink(filename);
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});

		req.end();
	};

	this.get = function (host, path, encoding, callback) {
		var options = {
			hostname: host,
			port: 80,
			path: path,
			method: 'GET',
			headers: _headers
		};
		options.headers['Host'] = host;
		options.headers['Cookie'] = this.cookie();
		if (this._referer) {
			options.headers['Referer'] = this._referer;
		}
		if (encoding=='euckr' || encoding=='euc-kr') {
			options['encoding'] = 'binary';
		}
		this._referer = 'http://'+host+path;

		var buf = []; //euc-kr
		var data = '';
		var req = http.request(options, function(res) {
			self._filter(res.headers);
			if (encoding=='euckr' || encoding=='euc-kr') {
				res.on('data', function (chunk) {
					buf.push(chunk);
				});
				res.on('end', function() {
					//at this point data is an array of Buffers
					//so we take each octet in each of the buffers
					//and combine them into one big octet array to pass to a
					//new buffer instance constructor
					var buffer = new Buffer(buf.reduce(function(prev, current) {
						return prev.concat(Array.prototype.slice.call(current));
					}, []));

					data = Engine.encode(buffer, 'euc-kr', 'utf-8').toString();
					callback(false, data);
				});
			} else {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function() {
					callback(false, data);
				});
			}
		});

		req.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(true, e.message);
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});

		req.end();
	};

	this.post = function (host, path, post, encoding, callback) {
		var options = {
			hostname: host,
			port: 80,
			path: path,
			method: 'POST',
			headers: _headers
		};
		options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		options.headers['Content-Length'] = post.length;
		options.headers['Host'] = host;
		options.headers['Cookie'] = this.cookie();
		if (this._referer) {
			options.headers['Referer'] = this._referer;
		}
		if (encoding=='euckr' || encoding=='euc-kr') {
			options['encoding'] = 'binary';
		}
		this._referer = 'http://'+host+path;

		var buf = []; //euc-kr
		var data = '';
		var req = http.request(options, function(res) {
			self._filter(res.headers);
			if (encoding=='euckr' || encoding=='euc-kr') {
				res.on('data', function (chunk) {
					buf.push(chunk);
				});
				res.on('end', function() {
					//at this point data is an array of Buffers
					//so we take each octet in each of the buffers
					//and combine them into one big octet array to pass to a
					//new buffer instance constructor
					var buffer = new Buffer(buf.reduce(function(prev, current) {
						return prev.concat(Array.prototype.slice.call(current));
					}, []));

					data = Engine.encode(buffer, 'euc-kr', 'utf-8').toString();
					callback(false, data);
				});
			} else {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function() {
					callback(false, data);
				});
			}
		});

		req.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			callback(true, e.message);
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});

		req.write(post);

		req.end();
	};

	return this;
};

util._extend(Engine, {
	http: function() {
		return Engine();
	},

	encode: function(str, from, to) {
		var iconv = new Iconv(from, to + '//IGNORE');
		return iconv.convert(str);
	},

	urlencode: function(str, encording) {
		if (encording=='euckr' || encording=='euc-kr') {
			var buff = this.encode(str, 'utf-8', 'euc-kr');
			var enc = [];
			for (var i=0; i<buff.length; i++) {
				if ((buff[i] >= 0x30 && buff[i] <= 0x39)
					|| (buff[i] >= 0x41 && buff[i] <= 0x5A)
					|| (buff[i] >= 0x61 && buff[i] <= 0x7A))
				{
					 enc.push(String.fromCharCode(buff[i]));
				} else {
					enc.push('%' + buff[i].toString(16).toUpperCase());
				}
			}
			return enc.join('');
		} else {
			return encodeURIComponent(str);
		}
	}
});
