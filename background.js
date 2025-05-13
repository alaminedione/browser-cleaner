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
        if (chrome.runtime.lastError) {
          console.error("Error during browsing data removal:", chrome.runtime.lastError.message);
          port.postMessage({ status: "error", message: chrome.runtime.lastError.message });
          // Optionally, show a notification about the error
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Cleaning Failed',
            message: `An error occurred during data cleaning: ${chrome.runtime.lastError.message}`
          });
        } else {
          // Envoyer un accusé de réception
          port.postMessage({ status: "done" });
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
