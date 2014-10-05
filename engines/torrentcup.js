var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'torrentcup',
			host: 'www.torrentcup.net',
			typelist: {
				'all': '전체검색',
				'torrent_movie': '영화',
				'torrent_tv': 'TV드라마',
				'torrent_variety': 'TV예능',
				'torrent_docu': '다큐/시사',
				'torrent_mid': '미드',
				'torrent_sports': '스포츠',
				'torrent_ani': '애니',
				'torrent_book': '도서',
				'torrent_song': '음악',
			},
			mapping: {
				'한국예능': 'all',
				'한국시사': 'all',
				'한국드라마': 'all',
			},
			search_path: function(opt) {
				var path = '/bbs/cache.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&sop=and&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				if (opt.type=='all') {
					path = '/bbs/s.php?q=&k='+opt.keyword;
				}
				return path;
			},
			search_filter: function($body) {
				$body('fieldset').remove(); // 인기게시물제거
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				var text = $link.text();
				//console.log(href);
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+opt.type)!=-1) {
					return {
						link: href.substring(2),
						title: text,
						info: 'http://'+this.host+href.substring(2),
					};
				}
				return null;
			},
			download_match: 'a',
			download_filter: function($link) {
				//console.log(href);
				var href = $link.attr('href');
				if (href && href.indexOf('javascript:file_download')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					//console.log(matches);
					//console.log(filelink);
					return {
						link: filelink
					};
				}
				return null;
			},
		});
	}
}
