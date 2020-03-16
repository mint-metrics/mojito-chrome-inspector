'use strict';
const SELECT_HEIGHT = 23;
const ITEM_HEIGHT = 28;
const TEST_STATES = {STAGING: 'staging', LIVE: 'live', DIVERT: 'divert'};

document.documentElement.classList.add(chrome.devtools.panels.themeName);

let bodyContainer = document.getElementById('bodyContainer'),
    rootContainer = document.querySelector('.container'),
    gridHeader = document.querySelector('.grid-header')
let renderedTests = [];
let filterTimeoutHandle;

// sort
let lastSortColName,
    sortState = {};

function closeAllSelects()
{
    let openSelect = document.querySelector('.select-holder.open');

    if (openSelect)
    {
        openSelect.classList.remove('open');
    }
}

function showOptions(target)
{
    let totalHeight = SELECT_HEIGHT + ITEM_HEIGHT*(target.querySelectorAll('.options .option-item').length);
    let offsetTop = target.offsetTop + target.parentNode.offsetTop;

    if ((offsetTop + totalHeight) > (window.innerHeight + bodyContainer.scrollTop))
    {
        target.classList.add('up');
    }
    else
    {
        target.classList.remove('up');
    }

    target.classList.add('open');
}

function renderTests(testData)
{
    if (!testData)
    {
        return;
    }
    
    renderedTests = [];
    let {tests, params} = testData;
    while (bodyContainer.firstChild)
    {
        bodyContainer.firstChild.remove();
    }

    // initial sort
    if (lastSortColName)
    {
        for (let i=0;i<tests.length;i++)
        {
            if (tests[i].state == TEST_STATES.LIVE && tests[i].divertTo != null)
            {
                tests[i].state = TEST_STATES.DIVERT;
            }
        }

        tests.sort((a, b) => {
            let aVal = (a[lastSortColName]||'').toLowerCase();
            let bVal = (b[lastSortColName]||'').toLowerCase();

            if (aVal === bVal) return 0;
            if (aVal < bVal) return -1;

            return 1;
        });

        if (sortState[lastSortColName] == 'desc')
        {
            tests.reverse();
        }
    }

    let test,
        stagingCnt = 0,
        liveCnt = 0,
        divertCnt = 0,
        itemNode;
    for (let i=0;i<tests.length;i++)
    {
        test = tests[i];
        if (test.state == TEST_STATES.LIVE && test.divertTo != null)
        {
            test.state = TEST_STATES.DIVERT;
        }

        if (test.state == TEST_STATES.STAGING)
        {
            stagingCnt++;
        }
        else if (test.state == TEST_STATES.DIVERT)
        {
            divertCnt++;
        }
        else
        {
            liveCnt++;
        }

        itemNode = createTestItem(test, params)
        bodyContainer.appendChild(itemNode);
        renderedTests.push({test, itemNode});
    }

    document.getElementById('stagingCnt').innerHTML = stagingCnt;
    document.getElementById('liveCnt').innerHTML = liveCnt;
    document.getElementById('divertCnt').innerHTML = divertCnt;
    
    // apply existing filters
    if (document.getElementById('txtFilter').value.trim() != '')
    {
        doTxtFilter();
    }

    rootContainer.classList.remove('changed', 'refreshing');
    checkBodyOverflow();
}

function createTestItem(test, params)
{
    let testItem = document.createElement('div');
    testItem.className = `test-item ${test.state}`;

    let stateDescr = '';
    if (test.excludedBySample)
    {
        stateDescr = '(excluded by sample)';
    }
    else
    {
        if (test.activated)
        {
            if ((test.state == TEST_STATES.STAGING&&test.chosenRecipe != null)||
                (test.state == TEST_STATES.DIVERT && test.chosenRecipe.id != test.divertTo)||
                params['mojito_' + test.id] != null)
            {
                stateDescr = '(forced)';
            }
        }
    }

    testItem.innerHTML = 
    `
    <div class="summary">
        <div class="col-name">
            <div class="label">${test.name}</div>
        </div>
        <div class="col-id">
            <div class="label">${test.id}</div>
        </div>
        <div class="col-state">
            <div class="label"><span class="indicator"></span><span>${test.state}</span> ${stateDescr}</div>
        </div>
        <div class="col-setting"></div>
    </div>
    <div class="details">
        <div class="details-holder">
            <div>Sample rate: <span>${test.sampleRate}</span></div>
        </div>
    </div>
    `;

    if (test.gaExperimentId)
    {
        let gaNode = document.createElement('div');
        gaNode.innerHTML = `gaExperimentId: <span>${test.sampleRate}</span>`;
        testItem.querySelector('.details-holder').appendChild(gaNode);
    }

    let {dropdown, recipesNode} = createRecipeList(test);
    testItem.querySelector('.col-setting').appendChild(dropdown);
    testItem.querySelector('.details-holder').appendChild(recipesNode);

    return testItem;
}

function createRecipeList(test)
{
    let recipes = test.recipes,
        recipe,
        optionNode,
        dropdown;

    if (test.activated)
    {
        // dropdown
        dropdown = document.createElement('div');
        dropdown.className = 'select-holder';
        dropdown.setAttribute('data-item-cnt', recipes.length);

        // input node
        let input = document.createElement('div');
        input.className = 'input';
        dropdown.appendChild(input);

        // options node
        let options = document.createElement('div');
        options.className = 'options';
        dropdown.appendChild(options);

        if (test.chosenRecipe)
        {
            dropdown.setAttribute('data-init-value', test.chosenRecipe.id);
            dropdown.setAttribute('data-value', test.chosenRecipe.id);
            if (test.divertTo == test.chosenRecipe.id)
            {
                input.innerHTML = `
                <div class="selected-option">
                    <span class="checkmark">✓</span>${test.chosenRecipe.name}
                    <span class="pin-icon"></span>
                </div>
                <div class="arrow"></div>
                `;
            }
            else
            {
                input.innerHTML = `
                <div class="selected-option">
                    <span class="checkmark">✓</span>${test.chosenRecipe.name}
                </div>
                <div class="arrow"></div>
                `;
            }
    
            for (let i=0;i<recipes.length;i++)
            {
                recipe = recipes[i];
                optionNode = document.createElement('div');
                optionNode.className = 'option-item';
                optionNode.setAttribute('data-value', recipe.id);

                if (recipe.id == test.chosenRecipe.id && recipe.id == test.divertTo)
                {
                    optionNode.innerHTML = `
                    <div>
                        <span class="checkmark">✓</span>${recipe.name}
                        <span class="pin-icon"></span>
                    </div>
                    `;
                }
                else if (recipe.id == test.chosenRecipe.id)
                {
                    optionNode.innerHTML = `
                    <div>
                        <span class="checkmark">✓</span>${recipe.name}
                    </div>
                    `;
                }
                else if (recipe.id == test.divertTo)
                {
                    optionNode.innerHTML = `
                    <div>
                        ${recipe.name}<span class="refresh-icon"></span>
                        <span class="pin-icon"></span>
                    </div>
                    `;
                }
                else
                {
                    optionNode.innerHTML = `
                    <div>
                        ${recipe.name}<span class="refresh-icon"></span>
                    </div>
                    `;
                }
    
                options.appendChild(optionNode);
            }

            if (test.state == TEST_STATES.STAGING)
            {
                optionNode = document.createElement('div');
                optionNode.className = 'option-item';
                optionNode.setAttribute('data-value', 'exit-preview');
                optionNode.innerHTML = `
                    <div>
                        Exit preview<span class="refresh-icon"></span>
                    </div>
                    `;

                options.appendChild(optionNode);
            }
        }
        else
        {
            input.innerHTML = `
            <div class="selected-option">- Select recipe -</div>
            <div class="arrow"></div>
            `;
    
            for (let i=0;i<recipes.length;i++)
            {
                recipe = recipes[i];
                optionNode = document.createElement('div');
                optionNode.className = 'option-item';
                optionNode.setAttribute('data-value', recipe.id);
    
                if (recipe.id == test.divertTo)
                {
                    optionNode.innerHTML = `
                    <div>
                        ${recipe.name}<span class="refresh-icon"></span>
                        <span class="pin-icon"></span>
                    </div>
                    `;
                }
                else
                {
                    optionNode.innerHTML = `
                    <div>
                        ${recipe.name}<span class="refresh-icon"></span>
                    </div>
                    `;
                }
    
                options.appendChild(optionNode);
            }
        }

        // extra 'Exit preview' for forced staging test
    }
    else
    {
        dropdown = document.createElement('span');
        dropdown.innerHTML = 'Trigger not activated';
        test._na = true;
    }
    
    // recipes list in details view
    let recipesNode = document.createElement('div');
    recipesNode.className = 'recipes';

    recipes.forEach(item => {
        let recipeNode = document.createElement('div');

        if (item.sampleRate != null)
        {
            recipeNode.innerHTML = `${item.id}: ${item.name}, ${item.sampleRate}`;
        }
        else
        {
            recipeNode.innerHTML = `${item.id}: ${item.name}`;
        }

        recipesNode.appendChild(recipeNode);
    });

    return {dropdown, recipesNode};
}

function sortTestItems(colName)
{
    if (!renderedTests.length)
    {
        return;
    }

    if (sortState[colName] == null || sortState[colName] == 'desc')
    {
        sortState[colName] = 'asc';
    }
    else if (sortState[colName] == 'asc')
    {
        sortState[colName] = 'desc';
    }

    lastSortColName = colName;

    renderedTests.sort((a, b) => {
        let aVal = (a.test[colName]||'').toLowerCase();
        let bVal = (b.test[colName]||'').toLowerCase();

        if (aVal === bVal) return 0;
        if (aVal < bVal) return -1;

        return 1;
    });

    if (sortState[colName] == 'desc')
    {
        renderedTests.reverse();
    }

    let lastItemNode = renderedTests[0].itemNode;
    for (let i=1,c=renderedTests.length;i<c;i++)
    {
        lastItemNode.insertAdjacentElement('afterend', renderedTests[i].itemNode);
        lastItemNode = renderedTests[i].itemNode;
    }

    gridHeader.querySelectorAll('.asc, .desc').forEach((item) => {
        item.classList.remove('asc', 'desc');
    });

    if (sortState[colName] == 'desc')
    {
        gridHeader.querySelector('.col-' + colName).classList.add('desc');
    }
    else
    {
        gridHeader.querySelector('.col-' + colName).classList.add('asc');
    }
}

function doTxtFilter()
{
    let filter = document.getElementById('txtFilter').value.trim(),
        testItem;
    for (let i=0,c=renderedTests.length;i<c;i++)
    {
        testItem = renderedTests[i];

        if (testItem.test.id.includes(filter)||testItem.test.state.includes(filter))
        {
            testItem.txtFiltered = false;
        }
        else
        {
            testItem.txtFiltered = true;
        }

        if (testItem.txtFiltered || testItem.naFiltered)
        {
            testItem.itemNode.classList.add('hidden');
        }
        else
        {
            testItem.itemNode.classList.remove('hidden');
        }
    }

    checkBodyOverflow();
}

function doNAFilter()
{
    let filtered = document.getElementById('cbxHideNA').checked,
        testItem;
    for (let i=0,c=renderedTests.length;i<c;i++)
    {
        testItem = renderedTests[i];
        if (filtered)
        {
            testItem.naFiltered = (testItem.test._na||false);
        }
        else
        {
            testItem.naFiltered = false;
        }

        if (testItem.txtFiltered || testItem.naFiltered)
        {
            testItem.itemNode.classList.add('hidden');
        }
        else
        {
            testItem.itemNode.classList.remove('hidden');
        }
    }

    checkBodyOverflow();
}

function applyChanges()
{
    if (!rootContainer.classList.contains('changed'))
    {
        return;
    }

    let changes = [],
        changedItem,
        testItem,
        test;

    for (let i=0;i<renderedTests.length;i++)
    {
        testItem = renderedTests[i].itemNode;
        if (!testItem.classList.contains('changed'))
        {
            continue;
        }

        test = renderedTests[i].test;

        let recipeSelect = testItem.querySelector('.select-holder'),
            oldValue = recipeSelect.getAttribute('data-init-value'),
            newValue = recipeSelect.getAttribute('data-value');

        changedItem = {
            id: test.id, 
            state: test.state,
            oldRecipe: oldValue, 
            newRecipe: newValue
        };

        changes.push(changedItem);
    }

    rootContainer.classList.add('refreshing');
    chrome.devtools.inspectedWindow.eval('_mojitoApplyChanges('+JSON.stringify(changes)+')');
}

function checkBodyOverflow()
{
    if (bodyContainer.clientHeight < bodyContainer.scrollHeight)
    {
        document.body.classList.add('overflow');
    }
    else
    {
        document.body.classList.remove('overflow');
    }
}

bodyContainer.addEventListener('click', e =>
{
    let target = e.target;
    while (!(target.classList.contains('input')||target.classList.contains('option-item'))&&target != bodyContainer)
    {
        target = target.parentNode;
    }

    if (target.classList.contains('input') || target.classList.contains('option-item'))
    {
        let selectWidget = target;
        while (!selectWidget.classList.contains('select-holder'))
        {
            selectWidget = selectWidget.parentNode;
        }

        if (target.classList.contains('input'))
        {
            e.stopPropagation();

            if (selectWidget.classList.contains('open'))
            {
                selectWidget.classList.remove('open');
            }
            else
            {
                closeAllSelects();
                showOptions(selectWidget);
            }
        }
        else
        {
            let currentVal = selectWidget.getAttribute('data-value'),
                optionVal = target.getAttribute('data-value');

            if (currentVal != optionVal)
            {
                let testItem = selectWidget.parentNode.parentNode.parentNode;
                selectWidget.querySelector('.input .selected-option').innerHTML = target.innerHTML;
                selectWidget.setAttribute('data-value', optionVal);

                if (selectWidget.getAttribute('data-init-value') != optionVal)
                {
                    testItem.classList.add('changed');
                }
                else
                {
                    testItem.classList.remove('changed');
                }

                if (bodyContainer.querySelectorAll('.test-item.changed').length)
                {
                    rootContainer.classList.add('changed');
                }
                else
                {
                    rootContainer.classList.remove('changed');
                }
            }
        }
    }
    else
    {
        target = e.target;
        while (!(target.classList.contains('col-name'))&&target != bodyContainer)
        {
            target = target.parentNode;
        }

        if (target.classList.contains('col-name'))
        {
            target.parentNode.parentNode.classList.toggle('expanded');
            window.setTimeout(checkBodyOverflow, 500);
        }
    }
});

document.querySelectorAll('.grid-header .col').forEach((item) => {
    item.addEventListener('click', (e) => {
        let target = e.target;

        while (!target.classList.contains('col'))
        {
            target = target.parentNode;
        }

        sortTestItems(target.getAttribute('data-col-name'));
    });
});

document.getElementById('txtFilter').addEventListener('input', () => {
    if (filterTimeoutHandle)
    {
        window.clearTimeout(filterTimeoutHandle);
    }

    filterTimeoutHandle = window.setTimeout(doTxtFilter, 500);
    if (document.getElementById('txtFilter').value.trim().length > 0)
    {
        document.getElementById('clearFilter').classList.add('enabled');
    }
    else
    {
        document.getElementById('clearFilter').classList.remove('enabled');
    }
});

document.getElementById('clearFilter').addEventListener('click', () => {
    if (filterTimeoutHandle)
    {
        window.clearTimeout(filterTimeoutHandle);
    }

    document.getElementById('txtFilter').value = '';
    doTxtFilter();
    document.getElementById('clearFilter').classList.remove('enabled');
});

// apply changes
document.querySelector('.grid-header .refresh-icon').addEventListener('click', applyChanges);

document.addEventListener('click', () =>
{
    let openSelect = document.querySelector('.select-holder.open');

    if (openSelect)
    {
        openSelect.classList.remove('open');
    }
});

window.addEventListener('resize', checkBodyOverflow);
