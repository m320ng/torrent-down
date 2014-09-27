var http = require("http");
var fs = require('fs');
var util = require('util');
var querystring = require('querystring');
var async = require('async');
var Iconv = require("iconv").Iconv;
/* dnsmasq 로 해결
var dns = require('dns'), cache = {};
dns._lookup = dns.lookup;
dns.lookup = function(domain, family, done) {
    if (!done) {
        done = family;
        family = null;
    }

    var key = domain+family;
    if (key in cache) {
        var ip = cache[key], 
            ipv = ip.indexOf('.') !== -1 ? 4 : 6;

        return process.nextTick(function() { 
            done(null, ip, ipv);
        });
    }

    dns._lookup(domain, family, function(err, ip, ipv) {
        if (err) return done(err);
        cache[key] = ip;
        done(null, ip, ipv);
    });
};
var dl_queue = [], dl_active=false;
dns.__lookup = dns._lookup;
var dl_lookup = function(){
	var ns = dl_queue.pop();
	dns.__lookup(ns[0], ns[1], function(a,b,c){
		ns[2](a,b,c);
		if(dl_queue.length){
			dl_lookup();
		}
		else{
			dl_active = false;
		}
	});
};
dns._lookup = function(a, b, c){
		dl_queue.push([a, b, c]);
		if(!dl_active){
			dl_active = true;
			dl_lookup();
		}
};
*/
var _headers = {
	'Content-Type': 'text/html',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
	//'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.0.4; en-gb; GT-I9300 Build/IMM76D) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
	'Connection': 'Keep-Alive'
};

var HttpClient = function () {
	if (!(this instanceof HttpClient)) return new HttpClient();
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

	this._filter = function(header, cookies) {
		//console.log(header);
		if (header['set-cookie']) {
			header['set-cookie'].forEach(function(cookie) {
				var item = cookie.split(';')[0];
				if (item) {
					var c = item.split('=');
					if (cookies) {
						cookies[c[0]] = c[1];
					} else {
						self._cookie[c[0]] = c[1];
					}
				}
			});
		}
	};

	this.download = function (host, path, destfile, encoding, callback) {
		var options = {
			host: host,
			port: 80,
			path: path,
			encoding: 'binary',
			method: 'GET',
			headers: {},
		};
		util._extend(options.headers, _headers);
		options.headers['Host'] = host;
		options.headers['Cookie'] = this.cookie();
		if (this._referer) {
			options.headers['Referer'] = this._referer;
		}
		console.log(this._referer);
		delete options.headers['Content-Type'];

		var filename = '';
		var req = http.request(options, function(res) {
			//if (res.headers['content-type']!='file/unknown' || res.statusCode!=200) {
			if (res.statusCode!=200) {
				if (res.statusCode==302) { // redirection
					self.download(host, res.headers['location'], destfile, encoding, callback);
					return;
				}
				callback(true, '오류가 발생했습니다. (' + res.statusCode + ')');
				return;
			}
			console.log(res.headers);
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
					filename = decodeURIComponent(filename.replace(/\+/g, '%20'));
					/*
					if ('euckr,euc-kr'.indexOf(encoding.toLowerCase())!=-1) {
						filename = HttpClient.encode(filename, 'euc-kr', 'utf-8').toString();
					}
					if (encoding=='utf8' || encoding=='utf-8') {
					}
					*/
				}
			}

			var file = fs.createWriteStream(destfile);
			res.pipe(file);
			file.on('finish', function() {
				console.log('file-finish');
				file.close(function() {
					console.log('file-close');
					callback(false, {
						file: destfile,
						name: filename
					});
				});
			});
		});

		req.on('error', function(e) {
			console.log('req-error');
			console.log('problem with request: ' + e.message);
			if (e.code != 'HPE_INVALID_CONSTANT') {
				callback(true, e.message);
			}
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});

		req.end();
	};

	this.request = function(opt, callback) {
		var self = this;
		//host, path, encoding
		var options = {
			port: 80,
			path: '/',
			method: 'GET',
			//agent: false,
			headers: {},
		};
		options.hostname = opt.host;
		if (opt.path) options.path = opt.path;
		if (opt.port) options.port = opt.port;
		if (opt.method) options.method = opt.method;
		if (opt.headers) {
			util._extend(options.headers, opt.headers);
		} else {
			util._extend(options.headers, _headers);
		}
		if (opt.post) {
			options.method = 'POST';
			options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
			options.headers['Content-Length'] = opt.post.length;
		}
		if (opt.addheaders) util._extend(options.headers, opt.addheaders);
		if (opt.encoding && 'euckr,euc-kr'.indexOf(opt.encoding.toLowerCase())!=-1) {
			options['encoding'] = 'binary';
		}
		if (opt.referer) {
			options.headers['Referer'] = opt.referer;
		}
		if (opt.cookies) {
			var cookie_str = querystring.stringify(opt.cookies).replace(/&/g, '; ');
			options.headers['Cookie'] = cookie_str;
		} else {
			options.headers['Cookie'] = this.cookie();
		}
		options.headers['Host'] = opt.host;
		options.headers['Path'] = opt.path;

		//console.log('request::');
		//console.log(options.headers['Cookie']);
		//options.headers['Cookie'] = this.cookie();
		this._referer = 'http://'+opt.host+opt.path;
		//console.log(options.headers);

		var buf = []; //euc-kr
		var data = '';
		var req = http.request(options, function(res) {
			//self.setCookie(res.headers);
			//self._filter(res.headers);
			if (opt.cookies) {
				self._filter(res.headers, opt.cookies);
			} else {
				self._filter(res.headers);
			}
			if (options.encoding == 'binary') {
				res.on('data', function (chunk) {
					buf.push(chunk);
				});
				res.on('end', function() {
					var buffer = new Buffer(buf.reduce(function(prev, current) {
						return prev.concat(Array.prototype.slice.call(current));
					}, []));
					data = HttpClient.encode(buffer, 'euc-kr', 'utf-8').toString();
					callback(false, data);
				});
			} else {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function() {
					callback(false, data, res.headers, opt.cookies);
				});
			}
		});

		req.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			console.log(e);
			//console.log(opt);
			//console.log(options);
			if (e.syscall=='getaddrinfo') {
				//return self.request(opt, callback);
				callback(true, e.message);
			} else {
				callback(true, e.message);
			}
		});
		req.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				req.abort();
			});
		});


		if (opt.post) {
			req.write(opt.post);
		}

		req.end();
	};

	this.upload = function (host, path, post, encoding, files, callback) {
		var bound_code = Math.random().toString(16).replace('.','m');
		var options = {
			host: host,
			port: 80,
			path: path,
			method: 'POST',
		};
		
		if (encoding=='euckr' || encoding=='euc-kr') {
			options['encoding'] = 'binary';
		}
		this._referer = 'http://'+host+path;


		var data = '';
		var req = http.request(options, function(res) {
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				data += chunk;
			});
			res.on('end', function() {
				callback(false, data);
			});
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


		var tasks = [];
		var optional = [];
		var optional_len = 0;

		if (post) {
			var data = querystring.parse(post);
			for (var k in data) {
				var output = '--'+bound_code+'\r\n'
							+ 'Content-Disposition: form-data; name="'+k+'"\r\n\r\n'
							+ data[k]+'\r\n';
				optional_len += Buffer.byteLength(output, 'utf8');
				(function(output) {
					tasks.push(function(next) {
						req.write(output);
						next();
					});
				}(output));
			}
		}

		if (files) {
			for (var i=0; i<files.length; i++) {
				var file = files[i];
				var output = '--'+bound_code+'\r\n'
							+ 'Content-Disposition: form-data; name="'+file['name']+'"; filename="'+file['filename']+'"\r\n'
							+ 'Content-Type: image/png\r\n\r\n';
				optional_len += Buffer.byteLength(output, 'utf8');
				var stats = fs.statSync(file['tmp_name']);
				optional_len += parseInt(stats['size']);
				optional_len += 2;
				(function(filepath, output, index) {
					tasks.push(function(next) {
						console.log('task2--' + index);
						console.log(output);
						req.write(output);
						var stream = fs.createReadStream(filepath);
						stream.on('error', function(err) {
							console.log(err);
							next(err);
						});
						stream.on('end', function() {
							console.log('end');
							req.write('\r\n');
							next();
						});
						stream.pipe(req, {end: false});
					});
				}(file['tmp_name'], output, i));
			}
		}

		var footer = '--'+bound_code+'--';
		optional_len += footer.length;
		console.log(optional_len);

		req.setHeader('Content-Type', 'multipart/form-data; boundary=' + bound_code);
		req.setHeader('Content-Length', optional_len);
		req.setHeader('Keep-Alive', 'Connection');
		req.setHeader('Cache-Control', 'no-cache');

		async.series(tasks, function(err) {
			req.end(footer);
		});
	};

	return this;
};

/* static */
util._extend(HttpClient, {
	get: function() {
		return HttpClient();
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
	},

	urldecode: function(str, encording) {
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
			return decodeURIComponent(str);
		}
	}
});

module.exports = HttpClient;
