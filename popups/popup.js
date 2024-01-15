function initSnowplow() {
    (function(p,l,o,w,i,n,g){if(!p[i]){p.GlobalSnowplowNamespace=p.GlobalSnowplowNamespace||[];
        p.GlobalSnowplowNamespace.push(i);p[i]=function(){(p[i].q=p[i].q||[]).push(arguments)
        };p[i].q=p[i].q||[];n=l.createElement(o);g=l.getElementsByTagName(o)[0];n.async=1;
        n.src=w;g.parentNode.insertBefore(n,g)}}(window,document,"script",chrome.runtime.getURL('sp.js'), "mojitoTracker"));
}

function parseUrlParameters(urlSearch) {
	if (urlSearch.substr(0, 1) === '?') {
		urlSearch = urlSearch.substr(1);
	}

	var segments = urlSearch.split('&'), parameters = {}, pair;

	for (var i = 0, c = segments.length; i < c; i++) {
		pair = segments[i].split('=');
		parameters[pair[0]] = pair[1];
	}

	return parameters;
}

var trackInitialized;
function initTracker() {
    if (trackInitialized) {
        return;
    }

    mojitoTracker('newTracker', 'sp', 'c.mintmetrics.io', {
        appId: 'mojito-inspector-extension',
        platform: 'app',
        stateStorageStrategy: 'localStorage',
        eventMethod: 'post'
    });

    trackInitialized = true;
}

initSnowplow();
initTracker();

let params = parseUrlParameters(location.search);
if (params.mojitoVersion) {
	mojitoTracker('trackStructEvent', {
		category: 'Popup view',
		action: params.pageHostname,
		label: 'https://d1xafqim8ep2fx.cloudfront.net/js/' + params.containerName + '.js',
		property: params.mojitoVersion
	});
}