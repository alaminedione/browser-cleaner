// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "cleanData") {
    const preservedUrls = request.urls;
    chrome.browsingData.remove({
      origins: preservedUrls
    }, {
      cookies: true,
      cache: true,
      localStorage: true,
      serviceWorkers: true
    }, () => {
	    console.log("Données nettoyées sauf les sites", preservedUrls);
    });
  }
});
