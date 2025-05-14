chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "clean-port") return;

  port.onMessage.addListener(({ action, origins }) => {
    if (action === "clean") {
      const startTime = new Date().toISOString();
      chrome.browsingData.remove({
        excludeOrigins: origins,
        originTypes: { unprotectedWeb: true }
      }, {
        cookies: true,
        cache: true,
        indexedDB: true
      }, () => {
        const endTime = new Date().toISOString();
        const logDetails = {
          startTime,
          endTime,
          originsExcluded: origins.length,
          itemsRemoved: ['cookies', 'cache', 'indexedDB'],
          error: null,
          errorMessage: null
        };

        if (chrome.runtime.lastError) {
          console.error("Error during browsing data removal:", chrome.runtime.lastError.message);
          logDetails.error = true;
          logDetails.errorMessage = chrome.runtime.lastError.message;
          port.postMessage({ status: "error", message: chrome.runtime.lastError.message, log: logDetails });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Cleaning Failed',
            message: `An error occurred during data cleaning: ${chrome.runtime.lastError.message}`
          });
        } else {
          port.postMessage({ status: "done", log: logDetails });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Nettoyage réussi',
            message: `Vos données de navigation ont été nettoyées avec succès ! (sauf les données de ${origins.length} sites dans vos favoris)`
          });
          console.log(`All data has been removed except data from ${origins.length} sites in your bookmarks`);
        }
      });
    }
  });
});
