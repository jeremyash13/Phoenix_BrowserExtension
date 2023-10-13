let nativeHostPort = chrome.runtime.connectNative("com.phoenix.phoenix");
chrome.storage.session.set({ BlackList: [] });
chrome.storage.session.set({ WhiteList: [] });
chrome.storage.session.set({ BlockedTabs: [] });
chrome.storage.session.set({ IsDFYouTube: false });
chrome.storage.session.set({ IsExtensionActive: false });

nativeHostPort.onMessage.addListener(async (response) => {
  let data = response.data;
  // console.dir(data);

  if (data.type === "update_blocks") {
    // data:
    // { blockedSites : array,
    // siteExceptions: array,
    // isDFYouTube: bool }

    console.dir(data);

    await chrome.storage.session.set({
      BlackList: [...new Set(data.blockedSites)],
    });
    await chrome.storage.session.set({
      WhiteList: [...new Set(data.siteExceptions)],
    });
    await chrome.storage.session.set({ IsDFYouTube: data.isDFYouTube });
  }

  if (data.type === "set_status") {
    // data:
    // { status : bool }

    console.dir(data);
    if (!data.status) {
      // disable browser extension
      await chrome.storage.session.set({ IsExtensionActive: false });
      restoreTabs();
      broadcast_DFYT_options();
    }
    if (data.status) {
      // enable browser extension
      await chrome.storage.session.set({ IsExtensionActive: true });
      await checkTabsForBlackList("all");
      broadcast_DFYT_options();
    }
  }

  if (data.type === "heart_beat") {
    console.dir(data);
    nativeHostPort.postMessage("heartbeat");
  }
});

nativeHostPort.onDisconnect.addListener((p) => {
  if (chrome.runtime.lastError) {
    console.log(chrome.runtime.lastError); // for Chrome Error
  }
  if (p.error) {
    console.log(`Disconnected due to an error: ${p.error.message}`); // for Mozilla Error
  }
  console.log("Disconnected");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.query === "dfyt_get_options") {
    get_DFYT_OptionsSync().then((options) => {
      sendResponse({ options: options });
    });
  }
  return true;
});

chrome.webNavigation.onCompleted.addListener(async (tab) => {
  if (tab.frameId == 0) {
    // force the event to only fire once per page.
    await checkTabsForBlackList("single");
  }
});

function broadcast_DFYT_options(tabID) {
  if (typeof tabID !== "undefined") {
    order_update_view(tabID);
  } //send to all
  else {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(async (tab) => {
        const url = new URL(tab.url);
        if (!url.href.includes("https://www.youtube.com/")) return;

        await order_update_view(tab.id);
      });
    });
  }

  async function order_update_view(tabID) {
    if (tabID > 0)
      chrome.tabs.sendMessage(tabID, {
        query: "dfyt_update_view",
        options: await get_DFYT_OptionsAsync(),
      });
  }
}

function get_DFYT_OptionsSync() {
    // SENDRESPONSE() IN CHROME.RUNTIME.ONMESSAGE.ADDLISTENER WILL NOT COOPERATE WITH ASYNC FUNCTIONS.... 
    // SO NOW I HAVE TWO FUNCTIONS OF THE SAME THING... I HATE THIS...

  return new Promise((resolve, reject) => {
    chrome.storage.session.get(["IsExtensionActive"]).then((result) => {
      if (!result) {
        reject(new Error(result));
      }
      resolve({
        active: result.IsExtensionActive,
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
          hideNonLists: false, // is this working?
        },
        disablePlaylists: false,
        applyInstantly: true,
      });
    });
  });
}

async function get_DFYT_OptionsAsync() {
  let { IsExtensionActive } = await chrome.storage.session.get([
    "IsExtensionActive",
  ]);

  return {
    active: IsExtensionActive,
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
      hideNonLists: false, // is this working?
    },
    disablePlaylists: false,
    applyInstantly: true,
  };
}

async function restoreTabs() {
  let { BlockedTabs } = await chrome.storage.session.get(["BlockedTabs"]);

  chrome.tabs.query({}, async (tabs) => {
    tabs.forEach((tab) => {
      if (!tab) return;
      if (BlockedTabs.length === 0) return;

      chrome.tabs.reload(BlockedTabs.pop());
    });
    await chrome.storage.session.set({ BlockedTabs: [] });
  });
}

async function checkTabsForBlackList(mode) {
  // mode should be either:
  // 1. "all" (query all tabs)
  // 2. "single" (single tab query)

  let { IsExtensionActive } = await chrome.storage.session.get([
    "IsExtensionActive",
  ]);
  let { BlackList } = await chrome.storage.session.get(["BlackList"]);

  if (!IsExtensionActive) return;

  let queryObj;

  if (!BlackList) {
    console.log("blacklist is empty");
    return;
  }

  if (mode === "single") {
    queryObj = { active: true, lastFocusedWindow: true };
  }

  if (mode === "all") {
    queryObj = {};
  }

  chrome.tabs.query(queryObj, async (tabs) => {
    let { BlockedTabs } = await chrome.storage.session.get(["BlockedTabs"]);
    let { BlackList } = await chrome.storage.session.get(["BlackList"]);
    let { WhiteList } = await chrome.storage.session.get(["WhiteList"]);

    let tempBlockedTabsObj = [...BlockedTabs];

    tabs.forEach((tab) => {
      if (tab.url) {
        const url = new URL(tab.url);
        const tabHref = url.href;

        const isBlackListed = BlackList?.some((blackListedURL) =>
          matchURLWithPattern(tabHref, blackListedURL)
        );

        if (isBlackListed) {
          var isWhiteListed = WhiteList?.some((whiteListedURL) =>
            matchURLWithPattern(tabHref, whiteListedURL)
          );
        }

        if (isBlackListed && !isWhiteListed) {
          tempBlockedTabsObj.push(tab.id);

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["/scripts/blockedPage.js"],
          });
          // console.log(`Tab ${tab.id} (${tab.url}) is blacklisted.`);
        }
      }
    });

    await chrome.storage.session.set({ BlockedTabs: [...tempBlockedTabsObj] });
  });
}

function urlToRegexPattern(url) {
  // Escape special characters in the URL
  const escapedUrl = url.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&");

  // Replace asterisks with regex patterns
  const regexPattern = escapedUrl.replace(/\\\*/g, ".*");

  return regexPattern;
}

function matchURLWithPattern(tabUrl, blackListedURL) {
  // Convert the pattern to a regular expression

  const patternRegex = new RegExp(urlToRegexPattern(blackListedURL));
  return patternRegex.test(tabUrl);
}
