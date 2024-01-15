'use strict';
// Create a connection to the background page
let backgroundPageConnection;

function connectToBackgroundPage() {
    try {
        if (backgroundPageConnection) {
            backgroundPageConnection.disconnect();
        }

        backgroundPageConnection = chrome.runtime.connect({
            name: "panel"
        });

        backgroundPageConnection.postMessage({
            name: 'init',
            tabId: chrome.devtools.inspectedWindow.tabId
        });

        backgroundPageConnection.onMessage.addListener(function (message) {
            if ('mojitoDetected' in message.payload && !message.payload.devtoolsOnly) {
                if (message.payload.mojitoDetected) {
                    getMojitoTests();
                    document.body.classList.remove('no-mojito');
                }
                else {
                    // mojito not found
                    document.body.classList.add('no-mojito');
                }
            }
        });
    } catch (e) {
        //
    }
}

connectToBackgroundPage();

function checkDetector() {
    if (typeof (_mojitoDetect) == 'undefined') {
        window.setTimeout(checkDetector, 500);
        return;
    }

    _mojitoDetect(true);
}

function getMojitoTests() {
    chrome.devtools.inspectedWindow.eval('_mojitoGetTestData()', renderTests);
}

getMojitoTests();

chrome.devtools.network.onNavigated.addListener(() => {
    rootContainer.classList.add('refreshing');
    connectToBackgroundPage();
    chrome.devtools.inspectedWindow.eval(checkDetector.toString() + ';checkDetector();');
});

chrome.runtime.onMessage.addListener(function (request) {
    if (request.target == 'Panel' && request.payload.action == 'trackConsoleView') {
        trackConsoleView();
    }
});
