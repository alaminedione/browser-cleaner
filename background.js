// Configuration globale
const CONFIG = {
  notificationIcons: {
    success: 'icon-success.png',
    error: 'icon-error.png',
    progress: 'icon-progress.png',
    default: 'icon.png'
  },
  defaultDataTypes: {
    cookies: true,
    cache: true,
    indexedDB: true,
    localStorage: true,  // Ajout du localStorage
    serviceWorkers: true // Ajout des service workers
  },

  logLevel: 'info' // 'debug', 'info', 'warn', 'error'
};

// Utilitaires
const Utils = {
  logger: {
    debug: (message, data) => {
      if (CONFIG.logLevel === 'debug') {
        console.debug(`[Browser Cleaner] ${message}`, data || '');
      }
    },
    info: (message, data) => {
      if (['debug', 'info'].includes(CONFIG.logLevel)) {
        console.info(`[Browser Cleaner] ${message}`, data || '');
      }
    },
    warn: (message, data) => {
      if (['debug', 'info', 'warn'].includes(CONFIG.logLevel)) {
        console.warn(`[Browser Cleaner] ${message}`, data || '');
      }
    },
    error: (message, error) => {
      if (['debug', 'info', 'warn', 'error'].includes(CONFIG.logLevel)) {
        console.error(`[Browser Cleaner] ${message}`, error || '');
      }
    }
  },


  showNotification: async (type, title, message) => {
    try {
      // Vérifier si l'icône existe et utiliser l'icône par défaut si nécessaire
      let iconUrl = 'icon.png';
      if (type && CONFIG.notificationIcons[type]) {
        iconUrl = CONFIG.notificationIcons[type];
      }
      
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: iconUrl,
        title: title || '',
        message: message || ''
      });
      Utils.logger.debug(chrome.i18n.getMessage('notificationCreated', [type]), { title, message });
    } catch (error) {
      // Si l'affichage de notification échoue, on log l'erreur mais on continue
      Utils.logger.error(chrome.i18n.getMessage('failedToShowNotification'), error);
      console.error(chrome.i18n.getMessage('notificationError'), error);
      // Réessayer avec uniquement l'icône par défaut en cas d'échec
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: title || '',
          message: message || ''
        });
      } catch (fallbackError) {
        // Si même la notification de secours échoue, on continue silencieusement
        Utils.logger.error(chrome.i18n.getMessage('failedToShowFallbackNotification'), fallbackError);
      }
    }
  },

  saveLog: async (logEntry) => {
    try {
      // Stocker uniquement le dernier log
      await chrome.storage.local.set({ lastLog: logEntry });
    } catch (error) {
      console.error("Erreur de sauvegarde du log :", error);
    }
  }
};

// Service de nettoyage des données
const CleaningService = {
  // Affiche une notification de progression
  async showProgressNotification() {
    try {
      await Utils.showNotification(
        'progress',
        chrome.i18n.getMessage('notification_cleaning_started'),
        ''
      );
    } catch (error) {
      Utils.logger.warn(chrome.i18n.getMessage('failedToShowProgressNotification'), error);
      // Continue le processus même si la notification échoue
    }
  },

  // Traite les résultats du nettoyage
  async handleCleaningResult(startTime, excludedOrigins, dataTypes, error = null) {
    const endTime = new Date().toISOString();
    const logDetails = {
      operation: 'browsing-data-cleanup',
      startTime,
      endTime,
      duration: new Date(endTime) - new Date(startTime),
      excludedOrigins: (() => {
        const uniqueDomains = new Set();
        excludedOrigins.forEach(origin => {
          try {
            let hostname = new URL(origin).hostname;
            // Supprimer 'www.' pour la déduplication dans le log
            if (hostname.startsWith('www.')) {
              hostname = hostname.substring(4);
            }
            uniqueDomains.add(hostname);
          } catch (e) {
            uniqueDomains.add(origin); // Fallback pour les URL invalides
          }
        });
        const domainsArray = Array.from(uniqueDomains);
        return {
          count: domainsArray.length,
          domains: domainsArray
        };
      })(),
      dataTypesRemoved: Object.keys(dataTypes).filter(key => dataTypes[key]),
      success: !error,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null
    };

    // Sauvegarder le log
    await Utils.saveLog(logDetails);

    Utils.logger.info(chrome.i18n.getMessage('cleaningOperationCompleted'), logDetails);

    if (error) {
      try {
        await Utils.showNotification(
          'error',
          chrome.i18n.getMessage('notification_cleaning_failed_title'),
          chrome.i18n.getMessage('notification_cleaning_failed_detail', [error.message])
        );
      } catch (notifError) {
        Utils.logger.error(chrome.i18n.getMessage('failedToShowErrorNotification'), notifError);
      }
    } else {
      try {
        await Utils.showNotification(
          'success',
          chrome.i18n.getMessage('notification_cleaning_success_title'),
          chrome.i18n.getMessage('notification_cleaning_success_detail', [logDetails.excludedOrigins.count])
        );
      } catch (notifError) {
        Utils.logger.error(chrome.i18n.getMessage('failedToShowSuccessNotification'), notifError);
      }
    }

    // Ouvrir les logs si l'option est activée (géré par le service worker)
    try {
      const { showLogs } = await chrome.storage.sync.get(['showLogs']); // Utiliser chrome.storage.sync
      Utils.logger.debug('Valeur de showLogs:', showLogs);
      // Ouvrir les logs si l'option est activée, même si le popup est fermé
      if (showLogs) {
        Utils.logger.debug('Tentative d\'ouverture de logs.html avec logDetails:', logDetails);
        await chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
      }
    } catch (e) {
      Utils.logger.error('Erreur lors de l\'ouverture des logs', e);
    }
  },

  // Exécute le nettoyage
  async executeCleanup(options) {
    const { origins = [], dataTypes = CONFIG.defaultDataTypes } = options;
    const startTime = new Date().toISOString();
 
    try {
      // Afficher une notification de progression
      await this.showProgressNotification();
 
      // Ajouter un délai de 2 secondes avant de démarrer l'opération réelle
      await new Promise(resolve => setTimeout(resolve, 2000));
 
      Utils.logger.info(chrome.i18n.getMessage('startingBrowsingDataCleanup'), {
        excludedOrigins: origins.length,
        dataTypes
      });

      // Valider les origines exclues
      const validOrigins = origins.filter(origin => {
        const isValid = typeof origin === 'string' && origin.trim().length > 0;
        if (!isValid) Utils.logger.warn(chrome.i18n.getMessage('invalidOriginExcluded', [origin]));
        return isValid;
      });

      // Effectuer le nettoyage
      await new Promise((resolve, reject) => {
        chrome.browsingData.remove({
          excludeOrigins: validOrigins,
          originTypes: { unprotectedWeb: true }
        }, dataTypes, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Traiter le résultat
      this.handleCleaningResult(startTime, validOrigins, dataTypes);
    } catch (error) {
      Utils.logger.error(chrome.i18n.getMessage('errorDuringBrowsingDataCleanup'), error);
      this.handleCleaningResult(startTime, origins, dataTypes, error);
    }
  }
};

// Initialisation et écouteurs d'événements
function initBrowserCleaner() {
  // Écouter les messages ponctuels
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    Utils.logger.debug(chrome.i18n.getMessage('receivedMessageOnCleanupPort'), message);

    const { action, origins = [], dataTypes } = message;

    if (action === "clean") {
      (async () => {
        await CleaningService.executeCleanup({
          origins,
          dataTypes: dataTypes || CONFIG.defaultDataTypes
        });
        sendResponse({ status: "completed" }); // Répondre une fois le nettoyage terminé
      })();
      return true; // Indiquer que la réponse sera asynchrone
    } else if (action === "getConfig") {
      sendResponse({
        status: "config",
        config: CONFIG
      });
    }
  });

  Utils.logger.info(chrome.i18n.getMessage('browserCleanerInitialized'));
}

// Démarrer le service
initBrowserCleaner();
