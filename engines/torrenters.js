var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'torrenters',
			host: 'torrenters.com',
			typelist: {
				'tr_kmovie': '국내영화',
				'tr_fmovie': '외국영화',
				'tr_pbtv': 'TV방송',
				'tr_ftv': '외국TV',
				'tr_ani': '애니',
				'tr_video': '영상',
				'tr_sports': '스포츠',
				'tr_jamak': '자막',
			},
			mapping: {
				'한국예능': 'tr_pbtv',
				'한국시사': 'tr_pbtv',
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
				$body('#hot_list').remove(); // 인기게시물제거
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
				if (href && href.indexOf('javascript:dnload')!=-1) {
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
