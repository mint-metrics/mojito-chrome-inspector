'use strict';
let panelCreated = false;
function createPanel() {
    if (panelCreated) {
        return;
    }

    chrome.devtools.panels.create(
        'Mojito', null, './panel/panel.html',
        function (panel) {
            panel.onShown.addListener(function () {
                chrome.runtime.sendMessage({target: 'Panel', payload: {action: 'trackConsoleView'}});
            });
        }
    );
    
    panelCreated = true;
}
// todo: create pannel onNavigated
chrome.runtime.onMessage.addListener(function (request) {
    if (request.from == 'mojito' && request.target == 'Panel' && request.payload.mojitoDetected) {
        createPanel();
    }
});

function checkDetector(devtoolsOnly) {
    if (typeof (_mojitoDetect) == 'undefined') {
        window.setTimeout(checkDetector, 500);
        return;
    }

    _mojitoDetect(true, devtoolsOnly);
}

chrome.devtools.network.onNavigated.addListener(() => {
    if (!panelCreated) {
        chrome.devtools.inspectedWindow.eval(checkDetector.toString() + ';checkDetector(true);');
    }
});

chrome.devtools.inspectedWindow.eval(checkDetector.toString() + ';checkDetector();');