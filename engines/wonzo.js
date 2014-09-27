var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'wonzo',
			host: 'www.won3.us',
			typelist: {
				'torrent_movie': '영화',
				'torrent_drama': '드라마',
				'torrent_ent': '예능/오락',
				'torrent_tv': 'TV프로',
				'torrent_ani': '애니메이션',
				'torrent_music': '음악',
			},
			mapping: {
				'한국예능': 'torrent_tv',
				'한국시사': 'torrent_ent',
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
				$body('fieldset').remove();
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				var text = $link.text();
				//console.log(href);
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+opt.type)!=-1) {
					var link = href.substring(('http://'+this.host).length).replace(/&amp;/g, '&');
					return {
						link: link,
						title: text,
						info: 'http://'+this.host+link,
					};
				}
				return null;
			},
			download_match: 'a',
			download_filter: function($link) {
				//console.log(href);
				var href = $link.attr('href');
				if (href && href.indexOf('download.php')!=-1 && /wr_id\=[0-9]+/.test(href)) {
					var filelink = href.substring(('http://'+this.host).length).replace(/&amp;/g, '&');
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
