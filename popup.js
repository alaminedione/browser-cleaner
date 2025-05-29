/**
 * Browser Cleaner - Popup Script
 * Interface utilisateur permettant de nettoyer les données de navigation
 * tout en préservant les données des sites en favoris
 */

// Gestionnaire des favoris
const BookmarkManager = {
  /**
   * Récupère toutes les origines des URL en favoris
   * @returns {Promise<{origins: string[], invalidUrls: string[], uniqueDomainsCount: number}>}
   */
  async getBookmarkOrigins() {
    try {
      const nodes = await chrome.bookmarks.getTree();
      return this.extractOrigins(nodes);
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorFetchingBookmarks'), error);
      throw new Error(chrome.i18n.getMessage('cannotAccessBookmarks', [error.message]));
    }
  },

  /**
   * Extrait les origines à partir des nœuds de favoris
   * @param {Array} nodes - Nœuds de favoris
   * @returns {{origins: string[], invalidUrls: string[], uniqueDomainsCount: number}}
   */
  extractOrigins(nodes) {
    const uniqueDomains = new Set(); // Pour stocker les noms de domaine uniques (sans protocole)
    const invalidUrls = [];

    // Fonction récursive pour traiter chaque nœud de favori
    const processNode = (node) => {
      if (node.url) {
        try {
          const url = new URL(node.url);
          let hostname = url.hostname;
          // Normaliser le hostname en supprimant 'www.'
          if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
          }

          // Ajouter le nom d'hôte (domaine) normalisé au Set uniqueDomains
          uniqueDomains.add(hostname);

          // Pour les sous-domaines, ajouter aussi le domaine parent normalisé
          const domainParts = hostname.split('.');
          if (domainParts.length > 1) { // Changed from > 2 to > 1 to handle cases like example.com
            const mainDomain = domainParts.slice(-2).join('.');
            uniqueDomains.add(mainDomain);

            // Gérer les TLDs à plusieurs niveaux (ex: co.uk)
            if (domainParts.length > 2 && // Changed from > 3 to > 2
              ['co', 'com', 'org', 'net', 'gov', 'edu'].includes(domainParts[domainParts.length - 2])) {
              const extendedDomain = domainParts.slice(-3).join('.');
              uniqueDomains.add(extendedDomain);
            }
          }
        } catch (e) {
          console.error(chrome.i18n.getMessage('invalidBookmarkUrl'), node.url, e);
          invalidUrls.push(node.url);
        }
      }

      // Traitement récursif des enfants
      if (node.children && node.children.length > 0) {
        node.children.forEach(processNode);
      }
    };

    // Traiter tous les nœuds racine
    nodes.forEach(processNode);

    // Construire la liste finale des origines avec http:// et https://
    const origins = new Set();
    uniqueDomains.forEach(domain => {
      origins.add(`https://${domain}`);
      origins.add(`http://${domain}`);
    });

    return {
      origins: Array.from(origins),
      invalidUrls,
      uniqueDomainsCount: uniqueDomains.size
    };
  }
};

// Gestionnaire de l'interface utilisateur
const UIManager = {
  elements: {
    cleanButton: null,
    statusMessage: null,
    results: null,
    showLogsToggle: null,
    settingsPanel: null,
    advancedSettingsToggle: null,
    dataTypeCheckboxes: {},
    bookmarksCount: null,
    lastCleanedTime: null,
    tabButtons: null, // Ajout des boutons d'onglet
    tabContents: null, // Ajout des contenus d'onglet
  },

  /**
   * Initialise les éléments de l'interface utilisateur
   */
  initElements() {
    this.elements.cleanButton = document.getElementById('cleanButton');
    this.elements.statusMessage = document.getElementById('statusMessage');
    this.elements.results = document.getElementById('results');
    this.elements.showLogsToggle = document.getElementById('showLogsToggle');
    this.elements.settingsPanel = document.getElementById('settingsPanel');
    this.elements.advancedSettingsToggle = document.getElementById('advancedSettingsToggle');
    this.elements.bookmarksCount = document.getElementById('bookmarksCount');
    this.elements.lastCleanedTime = document.getElementById('lastCleanedTime');
    this.elements.resetButton = document.getElementById('resetButton');
    this.elements.tabButtons = document.querySelectorAll('.tab-btn'); // Sélectionner tous les boutons d'onglet
    this.elements.tabContents = document.querySelectorAll('.tab-content'); // Sélectionner tous les contenus d'onglet

    // Vérifier si des éléments essentiels sont manquants
    const essentialElements = ['cleanButton', 'statusMessage']; // 'results' a été supprimé
    for (const elemId of essentialElements) {
      if (!this.elements[elemId]) {
        console.error(chrome.i18n.getMessage('essentialElementNotFound', [elemId]));
      }
    }

    // Options de données à nettoyer
    const dataTypes = ['cookies', 'cache', 'indexedDB', 'localStorage', 'serviceWorkers'];
    dataTypes.forEach(type => {
      const checkbox = document.getElementById(`${type}Checkbox`);
      this.elements.dataTypeCheckboxes[type] = checkbox;
      if (!checkbox) {
        console.warn(chrome.i18n.getMessage('checkboxNotFound', [type]));
      }
    });
  },

  /**
   * Initialise l'état des éléments de l'UI depuis le stockage
   */
  async loadSavedState() {
    try {
      const result = await chrome.storage.local.get({
        showLogs: false,
        advancedSettingsVisible: false, // Maintenir pour la logique interne si nécessaire
        dataTypes: {
          cookies: true,
          cache: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true
        },
        activeTab: 'settings' // Nouvelle option pour l'onglet actif par défaut
      });

      // Appliquer les paramètres seulement si les éléments existent
      if (this.elements.showLogsToggle) {
        this.elements.showLogsToggle.checked = result.showLogs;
      }

      // Paramètres avancés (le toggle reste pour la visibilité du panneau interne)
      this.toggleAdvancedSettings(result.advancedSettingsVisible);
      if (this.elements.advancedSettingsToggle) {
        this.elements.advancedSettingsToggle.checked = result.advancedSettingsVisible;
      }

      // Cases à cocher pour les types de données
      Object.entries(result.dataTypes).forEach(([type, checked]) => {
        if (this.elements.dataTypeCheckboxes[type]) {
          this.elements.dataTypeCheckboxes[type].checked = checked;
        } else {
          console.warn(chrome.i18n.getMessage('checkboxNotAvailable', [type]));
        }
      });

      // Activer l'onglet sauvegardé ou l'onglet par défaut
      this.switchTab(result.activeTab);
      
      return result;
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorLoadingSettings'), error);
      this.setStatus(chrome.i18n.getMessage('errorLoadingSettings'), 'error');
      return null;
    }
  },

  /**
   * Affiche ou masque les paramètres avancés (panneau interne)
   * @param {boolean} visible
   */
  toggleAdvancedSettings(visible) {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.style.display = visible ? 'block' : 'none';
    } else {
      console.warn(chrome.i18n.getMessage('settingsPanelNotAvailable'));
    }

    // Sauvegarder l'état du toggle des paramètres avancés
    try {
      chrome.storage.local.set({
        advancedSettingsVisible: visible
      });
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorSavingAdvancedSettings'), error);
    }
  },

  /**
   * Bascule entre les onglets
   * @param {string} tabId - L'ID de l'onglet à activer ('settings' ou 'stats')
   */
  switchTab(tabId) {
    this.elements.tabButtons.forEach(button => {
      if (button.dataset.tab === tabId) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    this.elements.tabContents.forEach(content => {
      if (content.id === tabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Sauvegarder l'onglet actif
    try {
      chrome.storage.local.set({ activeTab: tabId });
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorSavingActiveTab'), error);
    }
  },

  /**
   * Sauvegarde la dernière heure de nettoyage dans le stockage
   * @param {string} timeString - Date/heure du dernier nettoyage (format ISO string)
   * @returns {Promise<void>}
   */
  async saveLastCleanedTime(timeString) {
    if (!timeString) {
      console.warn(chrome.i18n.getMessage('invalidTimestampSaveAttempt'));
      return;
    }
    
    try {
      await chrome.storage.sync.set({
        lastCleanedTime: timeString
      });
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorSavingCleanTime'), error);
    }
  },

  /**
   * Met à jour l'affichage des statistiques
   * @param {number} bookmarksCount - Nombre de sites favoris
   * @param {string|null} lastCleanedTime - Date/heure du dernier nettoyage (format ISO string)
   */
  updateStats(bookmarksCount, lastCleanedTime) {
    // Mise à jour du nombre de favoris
    if (this.elements.bookmarksCount) {
      this.elements.bookmarksCount.innerText = bookmarksCount >= 0 ? bookmarksCount.toString() : '-';
    }
    
    // Mise à jour de la date du dernier nettoyage
    if (this.elements.lastCleanedTime) {
      if (lastCleanedTime) {
        try {
          const date = new Date(lastCleanedTime);
          
          // Vérifier si la date est valide
          if (isNaN(date.getTime())) {
            throw new Error('Date invalide');
          }
          
          // Utiliser la locale du navigateur ou par défaut fr-FR
          const locale = navigator.language || 'fr-FR';
          
          // Format: JJ/MM/AAAA HH:MM
          const formattedDate = date.toLocaleDateString(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const formattedTime = date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
          });
          this.elements.lastCleanedTime.innerText = `${formattedDate} ${formattedTime}`;
        } catch (e) {
          console.error(chrome.i18n.getMessage('dateFormattingError'), lastCleanedTime, e);
          this.elements.lastCleanedTime.innerText = chrome.i18n.getMessage('invalidDateFormat');
        }
      } else {
        this.elements.lastCleanedTime.innerText = '-';
      }
    }
  },

  /**
   * Affiche un message de statut
   * @param {string} message
   * @param {string} type - 'info', 'success', 'error', 'warning'
   */
  setStatus(message, type = 'info') {
    if (!this.elements.statusMessage) {
      console.warn(chrome.i18n.getMessage('statusMessageElementNotAvailable'));
      return;
    }

    // Convertir les messages potentiellement undefined en chaîne vide
    const safeMessage = message || '';
    this.elements.statusMessage.textContent = safeMessage;

    // Réinitialiser les classes
    this.elements.statusMessage.className = 'status';

    // Ajouter la classe en fonction du type
    const validTypes = ['info', 'success', 'error', 'warning'];
    if (type && validTypes.includes(type)) {
      this.elements.statusMessage.classList.add(`status-${type}`);
    }
  },

  /**
   * Ajoute un résultat à la section des résultats
   * @param {string} message
   * @param {string} type - 'info', 'success', 'error', 'warning'
   */


  /**
   * Active/désactive le bouton de nettoyage
   * @param {boolean} enabled
   */
  setCleanButtonEnabled(enabled) {
    if (this.elements.cleanButton) {
      this.elements.cleanButton.disabled = !enabled;
    }
  },

  /**
   * Récupère les types de données sélectionnés pour le nettoyage
   * @returns {Object} Objet avec les types de données comme clés et des booléens comme valeurs
   */
  getSelectedDataTypes() {
    const dataTypes = {
      cookies: true,
      cache: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true
    };

    try {
      // Mettre à jour les valeurs en fonction des cases cochées si elles existent
      Object.entries(this.elements.dataTypeCheckboxes).forEach(([type, checkbox]) => {
        if (checkbox) {
          dataTypes[type] = checkbox.checked;
        }
      });
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorRetrievingDataTypes'), error);
      // Retourne les valeurs par défaut en cas d'erreur
    }

    return dataTypes;
  },

  /**
   * Sauvegarde les paramètres actuels
   * @returns {Promise<boolean>} True si la sauvegarde a réussi, false sinon
   */
  async saveSettings() {
    try {
      const dataTypes = this.getSelectedDataTypes();
      const showLogs = this.elements.showLogsToggle?.checked || false;

      await chrome.storage.local.set({
        showLogs,
        dataTypes
      });
      
      return true;
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorSavingSettings'), error);
      this.setStatus(chrome.i18n.getMessage('errorLoadingSettings'), 'error');
      return false;
    }
  }
};

// Gestionnaire de nettoyage
const CleaningManager = {
  /**
   * Exécute le processus de nettoyage
   */
  /**
   * Exécute le processus de nettoyage
   */
   async executeCleanup() {
     UIManager.setStatus(chrome.i18n.getMessage('statusCleaningInProgress'), 'info');
     UIManager.setCleanButtonEnabled(false);

     // Ajouter un délai de 2 secondes avant de démarrer l'opération
     await new Promise(resolve => setTimeout(resolve, 2000));

     try {
      // Récupérer les origines des favoris
      const {
        origins,
        invalidUrls
      } = await BookmarkManager.getBookmarkOrigins();

      // Afficher les URL invalides si nécessaire (maintenant via setStatus)
      if (invalidUrls.length > 0) {
        UIManager.setStatus(
         chrome.i18n.getMessage('statusInvalidUrlsFound', [invalidUrls.length]),
          'warning'
        );
      }

      // Récupérer les types de données sélectionnés
      const dataTypes = UIManager.getSelectedDataTypes();

      // Envoyer la demande de nettoyage via un message ponctuel
      const response = await chrome.runtime.sendMessage({
        action: "clean",
        origins,
        dataTypes
      });


      UIManager.setCleanButtonEnabled(true);

      if (response && response.status === "started") {
        UIManager.setStatus(chrome.i18n.getMessage('statusCleaningStartedInBackground'), 'info');
        setTimeout(async () => {
          const result = await chrome.storage.local.get(['lastLog']);
          const log = result.lastLog;
          if (log) {
            if (log.success) {
              UIManager.setStatus(
                chrome.i18n.getMessage('statusCleaningSuccess', [log.excludedOrigins.count]),
                'success'
              );
            } else {
              UIManager.setStatus(chrome.i18n.getMessage('statusCleaningError', [log.error.message]), 'error');
            }
            UIManager.updateStats(log.excludedOrigins.count, log.endTime);
            UIManager.saveLastCleanedTime(log.endTime);
          } else {
            UIManager.setStatus(chrome.i18n.getMessage('statusNoLogAvailable'), 'warning');
          }
        }, 500);
      } else {
        UIManager.setStatus(chrome.i18n.getMessage('statusCleaningRequestFailed'), 'error');
      }

    } catch (error) {
      console.error(chrome.i18n.getMessage('errorDuringCleanup'), error);
      UIManager.setCleanButtonEnabled(true);
      UIManager.setStatus(chrome.i18n.getMessage('statusGenericError', [error.message]), 'error');
    }
  }
};

/**
 * Remplace les placeholders __MSG_...__ par les messages localisés.
 */
function localizeHtml() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const messageKey = element.dataset.i18n;
    if (messageKey) {
      element.textContent = chrome.i18n.getMessage(messageKey);
    }
  });

  // Cas spécifiques pour les attributs ou le titre de la page
  document.title = chrome.i18n.getMessage('popupTitle');
}

/**
 * Initialise l'application lorsque le DOM est chargé
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Localiser le HTML
    localizeHtml();

    // Initialiser l'interface utilisateur
    UIManager.initElements();
    await UIManager.loadSavedState();

    // Charger et afficher les statistiques
    await loadAndDisplayStats();

    // Écouter les événements de l'interface
    if (UIManager.elements.cleanButton) {
      UIManager.elements.cleanButton.addEventListener('click', () => {
        CleaningManager.executeCleanup();
      });
    }

    if (UIManager.elements.showLogsToggle) {
      UIManager.elements.showLogsToggle.addEventListener('change', (event) => {
        chrome.storage.sync.set({ showLogs: event.target.checked }); // Utiliser chrome.storage.sync
      });
    }

    // Écouter les changements dans les cases à cocher des types de données
    Object.values(UIManager.elements.dataTypeCheckboxes).forEach(checkbox => {
      if (checkbox) {
        checkbox.addEventListener('change', async () => {
          await UIManager.saveSettings();
        });
      }
    });

    // Écouter les clics sur les boutons d'onglet
    UIManager.elements.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        UIManager.switchTab(button.dataset.tab);
      });
    });

    // Écouter le toggle des paramètres avancés (pour le panneau interne)
    if (UIManager.elements.advancedSettingsToggle) {
      UIManager.elements.advancedSettingsToggle.addEventListener('change', (e) => {
        UIManager.toggleAdvancedSettings(e.target.checked);
      });
    }

    // Ajouter l'événement pour le bouton de réinitialisation
    if (UIManager.elements.resetButton) {
      UIManager.elements.resetButton.addEventListener('click', async () => {
        if (confirm(chrome.i18n.getMessage('confirmReset'))) {
          await resetAllSettings();
        }
      });
    }
    
    console.info(chrome.i18n.getMessage('uiInitializationComplete'));
  } catch (error) {
    console.error(chrome.i18n.getMessage('uiInitializationError'), error);
    UIManager.setStatus(chrome.i18n.getMessage('statusGenericError', [error.message]), 'error');
  }
});

/**
 * Réinitialise tous les paramètres
 */
async function resetAllSettings() {
  try {
    await chrome.storage.sync.clear();
    UIManager.setStatus(chrome.i18n.getMessage('statusResetSuccess'), 'success');
    
    // Recharger les paramètres par défaut
    await UIManager.loadSavedState();
    await loadAndDisplayStats();
    
    return true;
  } catch (error) {
    console.error(chrome.i18n.getMessage('errorResettingSettings'), error);
    UIManager.setStatus(chrome.i18n.getMessage('statusGenericError', [error.message]), 'error');
    return false;
  }
}

/**
 * Charge les statistiques sauvegardées et les affiche
 * @returns {Promise<boolean>} True si les statistiques ont été chargées avec succès
 */
async function loadAndDisplayStats() {
  try {
    // Charger la dernière heure de nettoyage depuis le stockage
    const storageResult = await chrome.storage.sync.get({
      lastCleanedTime: null
    });
    const lastCleanedTime = storageResult.lastCleanedTime;

    let bookmarksCount = 0;
    try {
      // Récupérer le nombre actuel de sites favoris
      const {
        origins,
        uniqueDomainsCount
      } = await BookmarkManager.getBookmarkOrigins();
      bookmarksCount = uniqueDomainsCount;
    } catch (bookmarkError) {
      console.error(chrome.i18n.getMessage('errorFetchingBookmarks'), bookmarkError);
      UIManager.setStatus(chrome.i18n.getMessage('statusGenericError', [bookmarkError.message]), 'warning');
      bookmarksCount = -1;
    }

    // Mettre à jour l'affichage des statistiques
    UIManager.updateStats(bookmarksCount, lastCleanedTime);
    return true;

  } catch (error) {
    console.error(chrome.i18n.getMessage('errorLoadingOrDisplayingStats'), error);
    UIManager.setStatus(chrome.i18n.getMessage('errorLoadingOrDisplayingStats'), 'error');
    UIManager.updateStats(-1, null); // Afficher des tirets en cas d'erreur
    return false;
  }
}
