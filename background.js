// background.js (version corrigée)
chrome.runtime.onMessage.addListener(({ action, origins }) => {
  if (action === "clean") {
    chrome.browsingData.remove({
      excludeOrigins: origins,
      originTypes: {
        unprotectedWeb: true,
        protectedWeb: false
      }
    }, {
      cookies: true,
      cache: true,
      localStorage: true,
      serviceWorkers: true,
      indexedDB: true
    }, () => {
      console.log('Données hors bookmarks effacées', origins);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Nettoyage réussi',
        message: `Données hors bookmarks effacées (${origins.length} sites préservés)`
      });
    });
  }
});
