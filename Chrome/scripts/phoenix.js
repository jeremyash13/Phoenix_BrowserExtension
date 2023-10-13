let nativeHostPort = chrome.runtime.connectNative("com.phoenix.phoenix");

let blackList;
let whiteList;
let isExtensionActive = false;
let isDFYouTube = false;
let blockedTabs = [];

nativeHostPort.onMessage.addListener((response) => {

    let data = response.data;
    // console.dir(data);

    if (data.type === "update_blocks"){
        // data:
        // { blockedSites : [],
        // siteExceptions: [],
        // isDFYouTube: bool }

        console.dir(data);
        blackList = [...new Set(data.blockedSites)];
        whiteList = [...new Set(data.siteExceptions)];
        isDFYouTube = data.isDFYouTube;
        // console.dir(`blacklist: ${blackList}`);
        // console.dir(`whitelist: ${whiteList}`);
    }
    
    if (data.type === "set_status"){
        // data:
        // { status : bool }

        console.dir(data);
        if (!data.status){
            // disable browser extension
            isExtensionActive = false;
            restoreTabs();
            broadcast_DFYT_options();
        }
        if (data.status){
            // enable browser extension
            isExtensionActive = true;
            checkTabsForBlackList("all");
            broadcast_DFYT_options();
        }
    }

    if (data.type === "heart_beat") {
        console.dir(data);
        nativeHostPort.postMessage("heartbeat");
    }
});

nativeHostPort.onDisconnect.addListener((p)=>{
    if (chrome.runtime.lastError){
        console.log(chrome.runtime.lastError) // for Chrome Error
    }
    if (p.error) {
        console.log(`Disconnected due to an error: ${p.error.message}`); // for Mozilla Error
    }
    console.log('Disconnected')
});

chrome.webNavigation.onCompleted.addListener((tab) => {
    if(tab.frameId == 0) { // force the event to only fire once per page.
        checkTabsForBlackList("single");
    }
});

chrome.runtime.onMessage.addListener((response, sender, sendResponse) => {
    if (response.query === 'dfyt_get_options')
	{
        sendResponse({options: get_DFYT_Options()});
	}
});

function broadcast_DFYT_options(tabID) {
	if (typeof tabID !== 'undefined')
	{
		order_update_view(tabID);
	}
	else //send to all
	{
		chrome.tabs.query({}, function(tabs) {
            tabs.forEach((tab) => {
                const url = new URL(tab.url);
                if (!url.href.includes("https://www.youtube.com/")) return;

                order_update_view(tab.id); 
            });
		});
	}

	function order_update_view(tabID)
	{
		if (tabID > 0)
			chrome.tabs.sendMessage(tabID, {
				query: 'dfyt_update_view',
				options: get_DFYT_Options()
			});
	}
}

function get_DFYT_Options() {
    return {
        active: isDFYouTube,
        disableAutoplay: true, // NOT WORKING
        alert: false, // ????
        visibility: {
            hideNotificationBell: false, // is this working?
            hideRecommended: true, // WORKING
            hideFeed: true, // WORKING
            hideSidebar: true, // WORKING
            hideSubBar: false, // is this working?
            hideRelated: true, // WORKING
            hideComments: false, // WORKING
            hidePlaylist: false, // is this working?
            hideLiveChat: true, // WORKING
            hideTrending: true, // is this working?
            hideMerch: true, // WORKING
            hideNonLists: false // is this working?
        },
        disablePlaylists: false,
        applyInstantly: true
    }
}

function restoreTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab)  return;
            if (blockedTabs.length === 0) return;
    
            chrome.tabs.reload(blockedTabs.pop());
        });
    });
}

function checkTabsForBlackList(mode) {
    // mode should be either:
    // 1. "all" (query all tabs)
    // 2. "single" (single tab query)

    if (!isExtensionActive) return;

    let queryObj;

    if (!blackList) {
        console.log("blacklist is empty");
        return;
    }

    if (mode === "single") {
        queryObj = { active: true, lastFocusedWindow: true };
    }

    if (mode === "all") {
        queryObj = {};
    }


    chrome.tabs.query(queryObj, (tabs) => { // does this only query a single window? TEST...
        tabs.forEach(tab => {
            if (tab.url) {
                const url = new URL(tab.url);
                const tabHref = url.href;

                const isBlackListed = blackList?.some((blackListedURL) => matchURLWithPattern(tabHref, blackListedURL));
    
                if (isBlackListed) {
                    var isWhiteListed = whiteList?.some((whiteListedURL) => matchURLWithPattern(tabHref, whiteListedURL));
                }
    
                if (isBlackListed && !isWhiteListed) {
                    blockedTabs.push(tab.id);
                    chrome.tabs.executeScript(tab.id, { file: '/scripts/blockedPage.js', frameId: 0 });
                    // console.log(`Tab ${tab.id} (${tab.url}) is blacklisted.`);
                }
            }
        });
    });
}

function urlToRegexPattern(url) {
    // Escape special characters in the URL
    const escapedUrl = url.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace asterisks with regex patterns
    const regexPattern = escapedUrl.replace(/\\\*/g, '.*');

    return regexPattern;
}
    
function matchURLWithPattern(tabUrl, blackListedURL) {
    // Convert the pattern to a regular expression

    const patternRegex = new RegExp(urlToRegexPattern(blackListedURL));
    return patternRegex.test(tabUrl);
}
