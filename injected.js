'use strict';
function _mojitoSendMessageToPanel(payload) {
    window.postMessage({ from: 'mojito', target: 'Panel', payload }, '*');
}

function _mojitoSendMessageToBackground(payload) {
    window.postMessage({ from: 'mojito', target: 'Background', payload }, '*');
}

// detecting if Mojito is running in current page
function _mojitoDetect(forPanel, devtoolsOnly) {
    if (window._mojitoDetectCnt == null) {
        window._mojitoDetectCnt = 0;
        window._mojitoMaxDetectCnt = 60;
    }

    window._mojitoDetectCnt++;
    // detect up to 60 times (30 seconds)
    if (window._mojitoDetectCnt > window._mojitoMaxDetectCnt) {
        // notify inspector panel, No Mojito found
        _mojitoSendMessageToPanel({ mojitoDetected: false });
        return;
    }

    if (window.Mojito) {
        if (forPanel) {
            if (devtoolsOnly) {
                Mojito.utils.domReady(() => _mojitoSendMessageToPanel({ mojitoDetected: true, devtoolsOnly: true, count: getActivatedCount() }));

            }
            else {
                Mojito.utils.domReady(() => _mojitoSendMessageToPanel({ mojitoDetected: true, count: getActivatedCount() }))
            }
        }
        else {
            // change extension icon to enable state
            _mojitoSendMessageToBackground({ mojitoDetected: true, mojitoVersion: window.Mojito.buildInfo.mojitoVersion, containerName: window.Mojito.buildInfo.container, pageHostname: location.hostname });
            setTimeout(() => {
                _mojitoSendMessageToBackground({ mojitoDetected: true, count: getActivatedCount(), mojitoVersion: window.Mojito.buildInfo.mojitoVersion, containerName: window.Mojito.buildInfo.container, pageHostname: location.hostname });
            }, 500);
        }
    }
    else {
        setTimeout(function () {
            _mojitoDetect(forPanel, devtoolsOnly);
        }, 500);
    }
}

function getActivatedCount() {
    let tests = Mojito.testObjects || {},
        activatedCount = 0;

    for (let key in tests) {
        if (tests[key].activated) {
            activatedCount++;
        }
    }

    return activatedCount;
}

function _mojitoGetTestData() {
    let tests = Mojito.testObjects || {},
        test,
        data = [],
        item,
        buildInfo = Mojito.buildInfo||{size: {experiments: {}}};

    for (let key in tests) {
        test = tests[key];
        item = {};

        item.id = key;
        item.name = test.options.name;
        item.state = test.options.state;
        item.divertTo = test.options.divertTo;
        item.excludedBySample = test.inTest() == '0';
        item.activated = test.activated;
        item.chosenRecipe = test.chosenRecipe;
        item.sampleRate = test.options.sampleRate;
        item.size = buildInfo.size.experiments[key]||'N/A';
        item.trigger = test.options.trigger.toString();

        item.recipes = [];

        for (let recipeId in test.options.recipes) {
            item.recipes.push({
                id: recipeId,
                name: test.options.recipes[recipeId]['name'],
                sampleRate: test.options.recipes[recipeId]['simpleRate']
            });
        }

        data.push(item);
    }

    // url parameters
    let params = Mojito.utils.parseUrlParameters(window.location.search);
    let buildData = JSON.parse(JSON.stringify(buildInfo));
    buildData.pageHostname = location.hostname;

    return { tests: data, params,  buildInfo: buildData};
}

const TEST_STATES = { STAGING: 'staging', LIVE: 'live', DIVERT: 'divert' };
function _mojitoApplyChanges(changes) {
    let changeItem,
        params = Mojito.utils.parseUrlParameters(window.location.search),
        test;

    for (let i = 0; i < changes.length; i++) {
        changeItem = changes[i];
        test = Mojito.testObjects[changeItem.id];

        if (changeItem.state == TEST_STATES.STAGING) {
            if (changeItem.newRecipe == 'exit-preview') {
                // delete cookie
                _mojitoDeleteCookie(`_mojito_${changeItem.id}-staging`);
            }

            // remove old url param
            if (changeItem.oldRecipe) {
                delete params[`mojito_${changeItem.id}`];
            }
            // append new url param
            if (changeItem.newRecipe != 'exit-preview') {
                params[`mojito_${changeItem.id}`] = changeItem.newRecipe;
            }
        }
        else if (changeItem.state == TEST_STATES.LIVE) {
            // excluded by sample
            if (changeItem.oldRecipe == null) {
                test.setInTest(1);
                test.setRecipe(changeItem.newRecipe);
            }

            // remove old url param
            delete params[`mojito_${changeItem.id}`];
            // append new url param
            params[`mojito_${changeItem.id}`] = changeItem.newRecipe;
        }
        else {
            // divert
            // delete old cookie
            _mojitoDeleteCookie(`_mojito_${changeItem.id}`);
            // remove old url param
            delete params[`mojito_${changeItem.id}`];
            // append new url param if non-divertTo recipe chosen
            if (changeItem.newRecipe != test.options.divertTo) {
                params[`mojito_${changeItem.id}`] = changeItem.newRecipe;
            }
        }
    }

    // re-assemble url params
    let newParams = [];
    for (let key in params) {
        if (key != '') {
            newParams.push(key + '=' + params[key]);
        }
    }

    location.replace(location.protocol + '//' + location.hostname + location.pathname + (newParams.length ? ('?' + newParams.join('&')) : '') + location.hash);
}

function _mojitoDeleteCookie(name) {
    document.cookie = name + '=;expires=Sat, 31 Jan 1970 16:00:00 GMT;path=/';
}

window.setTimeout(_mojitoDetect);