chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "clean-port") return;

  port.onMessage.addListener(({ action, origins }) => {
    if (action === "clean") {
      chrome.browsingData.remove({
        excludeOrigins: origins,
        originTypes: { unprotectedWeb: true }
      }, {
        cookies: true,
        cache: true,
        indexedDB: true
      }, () => {
        // Envoyer un accusé de réception
        port.postMessage({ status: "done" });
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Succefully cleaned',
          message: `Your browsing data has been cleaned successfully! (except data from ${Math.floor(origins.length / 2)} sites in your bookmarks)`
        });

        console.log("all data has been removed except data from " + Math.floor(origins.length / 2) + " sites in your bookmarks");
      });
    }
  });
});
