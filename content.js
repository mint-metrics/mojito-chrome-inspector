let mojitoScriptInjected = false;
window.addEventListener('message', e =>
{
	if (e.source !== window || e.data.from != 'mojito')
	{
		return;
	}

	// pass message to background
	chrome.runtime.sendMessage(e.data);
});

function injectDetectorScript()
{
	let jsPath = 'injected.js';
	let ele = document.createElement('script');
	ele.id = 'mojito-injected';
	ele.setAttribute('type', 'text/javascript');
	ele.src = chrome.extension.getURL(jsPath);
	ele.onload = runDetectScript;
	document.head.appendChild(ele);
}

function runDetectScript()
{
	const source = ';_mojitoDetect();';
	const script = document.createElement('script');
	script.textContent = source;
	document.documentElement.appendChild(script);
	script.parentNode.removeChild(script);
}

injectDetectorScript();

