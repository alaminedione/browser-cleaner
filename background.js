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
      Utils.logger.debug(`Notification created: ${type}`, { title, message });
    } catch (error) {
      // Si l'affichage de notification échoue, on log l'erreur mais on continue
      Utils.logger.error('Failed to show notification', error);
      console.error('Notification error:', error);
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
        Utils.logger.error('Failed to show fallback notification', fallbackError);
      }
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
      Utils.logger.warn('Failed to show progress notification', error);
      // Continue le processus même si la notification échoue
    }
  },

  // Traite les résultats du nettoyage
  async handleCleaningResult(port, startTime, excludedOrigins, dataTypes, error = null) {
    const endTime = new Date().toISOString();
    const logDetails = {
      operation: 'browsing-data-cleanup',
      startTime,
      endTime,
      duration: new Date(endTime) - new Date(startTime),
      excludedOrigins: {
        count: excludedOrigins.length,
        domains: excludedOrigins
      },
      dataTypesRemoved: Object.keys(dataTypes).filter(key => dataTypes[key]),
      success: !error,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null
    };

    Utils.logger.info('Cleaning operation completed', logDetails);

    if (error) {
      try {
        await Utils.showNotification(
          'error',
          chrome.i18n.getMessage('notification_cleaning_failed_title'),
          chrome.i18n.getMessage('notification_cleaning_failed_detail', [error.message])
        );
      } catch (notifError) {
        Utils.logger.error('Failed to show error notification', notifError);
      }
      port.postMessage({ status: "error", message: error.message, log: logDetails });
    } else {
      try {
        await Utils.showNotification(
          'success',
          chrome.i18n.getMessage('notification_cleaning_success_title'),
          chrome.i18n.getMessage('notification_cleaning_success_detail', [excludedOrigins.length])
        );
      } catch (notifError) {
        Utils.logger.error('Failed to show success notification', notifError);
      }
      port.postMessage({ status: "done", log: logDetails });
    }
  },

  // Exécute le nettoyage
  async executeCleanup(port, options) {
    const { origins = [], dataTypes = CONFIG.defaultDataTypes } = options;
    const startTime = new Date().toISOString();

    try {
      // Afficher une notification de progression
      await this.showProgressNotification();

      Utils.logger.info('Starting browsing data cleanup', {
        excludedOrigins: origins.length,
        dataTypes
      });

      // Valider les origines exclues
      const validOrigins = origins.filter(origin => {
        const isValid = typeof origin === 'string' && origin.trim().length > 0;
        if (!isValid) Utils.logger.warn(`Invalid origin excluded: ${origin}`);
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
      this.handleCleaningResult(port, startTime, validOrigins, dataTypes);
    } catch (error) {
      Utils.logger.error('Error during browsing data cleanup', error);
      this.handleCleaningResult(port, startTime, origins, dataTypes, error);
    }
  }
};

// Initialisation et écouteurs d'événements
function initBrowserCleaner() {
  // Écouter les connections port
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "clean-port") return;

    Utils.logger.info('Connected to cleanup port');

    // Écouter les messages sur ce port
    port.onMessage.addListener((message) => {
      Utils.logger.debug('Received message on cleanup port', message);

      const { action, origins = [], dataTypes } = message;

      if (action === "clean") {
        CleaningService.executeCleanup(port, {
          origins,
          dataTypes: dataTypes || CONFIG.defaultDataTypes
        });
      } else if (action === "getConfig") {
        port.postMessage({
          status: "config",
          config: CONFIG
        });
      }
    });

    // Gérer la déconnexion
    port.onDisconnect.addListener(() => {
      Utils.logger.info('Cleanup port disconnected');
      if (chrome.runtime.lastError) {
        Utils.logger.error('Port error:', chrome.runtime.lastError);
      }
    });
  });

  Utils.logger.info('Browser cleaner initialized');
}

// Démarrer le service
initBrowserCleaner();
