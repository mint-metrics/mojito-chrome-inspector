'use strict';
var connections = {};

chrome.runtime.onConnect.addListener(function (port) {

    var extensionListener = function (message) {
        // The original connection event doesn't include the tab ID of the
        // DevTools page, so we need to send it explicitly.
        if (message.name == 'init') {
          connections[message.tabId] = port;
          return;
		}
    }

    // Listen to messages sent from the DevTools page
    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(function(port) {
        port.onMessage.removeListener(extensionListener);

        var tabs = Object.keys(connections);
        for (var i=0, len=tabs.length; i < len; i++) {
          if (connections[tabs[i]] == port) {
            delete connections[tabs[i]]
            break;
          }
        }
    });
});

// Receive message from content script and relay to the devTools page for the
// current tab
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse)
{
	// Messages from content scripts should have sender.tab set
	if (sender.tab) {
		let tabId = sender.tab.id;
		if (request.payload && request.payload.mojitoDetected) {
			// change extension icon to enable state
			chrome.browserAction.setIcon({
				tabId: tabId,
				path: 'images/logo.png'
			});

			chrome.browserAction.setPopup({
				tabId: tabId,
				popup: 'popups/popup.html'
			});

			if ('count' in request.payload)
			{
				// update count of activated experiments on the page
				chrome.browserAction.setBadgeText({text: String(request.payload.count), tabId: tabId});
				chrome.browserAction.setBadgeBackgroundColor({color: '#3498db', tabId: tabId});
			}
		}
		
		if (tabId in connections) {
			if (request.target == 'Panel') {
				connections[tabId].postMessage(request);
			}
		}
	}

	return true;
});