/**
 * Browser Cleaner - Popup Script
 * Interface utilisateur permettant de nettoyer les données de navigation
 * tout en préservant les données des sites en favoris
 */

// Gestionnaire des favoris
const BookmarkManager = {
  /**
   * Récupère toutes les origines des URL en favoris
   * @returns {Promise<{origins: string[], invalidUrls: string[]}>}
   */
  async getBookmarkOrigins() {
    try {
      const nodes = await chrome.bookmarks.getTree();
      return this.extractOrigins(nodes);
    } catch (error) {
      console.error("Erreur lors de la récupération des favoris:", error);
      throw new Error(`Impossible d'accéder aux favoris: ${error.message}`);
    }
  },

  /**
   * Extrait les origines à partir des nœuds de favoris
   * @param {Array} nodes - Nœuds de favoris
   * @returns {{origins: string[], invalidUrls: string[]}}
   */
  extractOrigins(nodes) {
    const origins = new Set();
    const invalidUrls = [];
    const processedDomains = new Set(); // Pour éviter le traitement en double des domaines

    // Traite un nœud de façon récursive
    const processNode = (node) => {
      if (node.url) {
        try {
          const url = new URL(node.url);

          // Ajouter l'origine exacte
          origins.add(url.origin);

          // Traitement des sous-domaines et domaines parents
          const hostname = url.hostname;
          if (!processedDomains.has(hostname)) {
            processedDomains.add(hostname);

            // Ajouter le domaine parent pour les sous-domaines
            const domainParts = hostname.split('.');

            // Traitement différent selon le nombre de parties
            if (domainParts.length > 2) {
              // Pour les sous-domaines (ex: sub.example.com)
              const mainDomain = domainParts.slice(-2).join('.');
              origins.add(`https://${mainDomain}`);
              origins.add(`http://${mainDomain}`);

              // Pour les cas comme co.uk, com.br, etc.
              if (domainParts.length > 3 &&
                ['co', 'com', 'org', 'net', 'gov', 'edu'].includes(domainParts[domainParts.length - 2])) {
                const extendedDomain = domainParts.slice(-3).join('.');
                origins.add(`https://${extendedDomain}`);
                origins.add(`http://${extendedDomain}`);
              }
            }
          }
        } catch (e) {
          console.error('URL invalide dans les favoris:', node.url, e);
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

    return {
      origins: Array.from(origins),
      invalidUrls
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

    // Options de données à nettoyer
    const dataTypes = ['cookies', 'cache', 'indexedDB', 'localStorage', 'serviceWorkers'];
    dataTypes.forEach(type => {
      this.elements.dataTypeCheckboxes[type] = document.getElementById(`${type}Checkbox`);
    });
  },

  /**
   * Initialise l'état des éléments de l'UI depuis le stockage
   */
  async loadSavedState() {
    try {
      const result = await chrome.storage.sync.get({
        showLogsEnabled: true,
        advancedSettingsVisible: false,
        dataTypes: {
          cookies: true,
          cache: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true
        }
      });

      this.elements.showLogsToggle.checked = result.showLogsEnabled;

      // Paramètres avancés
      this.toggleAdvancedSettings(result.advancedSettingsVisible);
      if (this.elements.advancedSettingsToggle) {
        this.elements.advancedSettingsToggle.checked = result.advancedSettingsVisible;
      }

      // Cases à cocher pour les types de données
      Object.entries(result.dataTypes).forEach(([type, checked]) => {
        if (this.elements.dataTypeCheckboxes[type]) {
          this.elements.dataTypeCheckboxes[type].checked = checked;
        }
      });
    } catch (error) {
      console.error("Erreur lors du chargement des paramètres:", error);
    }
  },

  /**
   * Affiche ou masque les paramètres avancés
   * @param {boolean} visible
   */
  toggleAdvancedSettings(visible) {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.style.display = visible ? 'block' : 'none';
    }

    chrome.storage.sync.set({
      advancedSettingsVisible: visible
    });
  },
 
  /**
   * Sauvegarde la dernière heure de nettoyage dans le stockage
   * @param {string} timeString - Date/heure du dernier nettoyage (format ISO string)
   */
  saveLastCleanedTime(timeString) {
    chrome.storage.sync.set({
      lastCleanedTime: timeString
    });
  },
 
  /**
   * Met à jour l'affichage des statistiques
   * @param {number} bookmarksCount - Nombre de sites favoris
   * @param {string|null} lastCleanedTime - Date/heure du dernier nettoyage (format ISO string)
   */
  updateStats(bookmarksCount, lastCleanedTime) {
    if (this.elements.bookmarksCount) {
      this.elements.bookmarksCount.innerText = bookmarksCount >= 0 ? bookmarksCount : '-';
    }
    if (this.elements.lastCleanedTime) {
      if (lastCleanedTime) {
        try {
          const date = new Date(lastCleanedTime);
          // Format: JJ/MM/AAAA HH:MM
          const formattedDate = date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const formattedTime = date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          });
          this.elements.lastCleanedTime.innerText = `${formattedDate} ${formattedTime}`;
        } catch (e) {
          console.error("Erreur de formatage de la date:", lastCleanedTime, e);
          this.elements.lastCleanedTime.innerText = 'Date invalide';
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
    if (!this.elements.statusMessage) return;
    if (this.elements.settingsPanel) {
    }

    chrome.storage.sync.set({
      advancedSettingsVisible: visible
    });
  },

  /**
   * Affiche un message de statut
   * @param {string} message 
   * @param {string} type - 'info', 'success', 'error', 'warning'
   */
  setStatus(message, type = 'info') {
    if (!this.elements.statusMessage) return;

    this.elements.statusMessage.textContent = message;

    // Réinitialiser les classes
    this.elements.statusMessage.className = '';

    // Ajouter la classe en fonction du type
    if (type) {
      this.elements.statusMessage.classList.add(`status-${type}`);
    }
  },

  /**
   * Ajoute un résultat à la section des résultats
   * @param {string} message 
   * @param {string} type - 'info', 'success', 'error', 'warning'
   */
  addResult(message, type = 'info') {
    if (!this.elements.results) return;

    const p = document.createElement('p');
    p.textContent = message;
    p.classList.add(`result-${type}`);

    this.elements.results.appendChild(p);
  },

  /**
   * Ajoute une liste à la section des résultats
   * @param {Array} items 
   * @param {string} type - 'info', 'warning', 'error'
   */
  addResultList(items, type = 'info') {
    if (!items || items.length === 0 || !this.elements.results) return;

    const ul = document.createElement('ul');
    ul.classList.add(`list-${type}`);

    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });

    this.elements.results.appendChild(ul);
  },

  /**
   * Efface tous les résultats affichés
   */
  clearResults() {
    if (this.elements.results) {
      this.elements.results.innerHTML = '';
    }
    this.setStatus('');
  },

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
    const dataTypes = {};

    Object.entries(this.elements.dataTypeCheckboxes).forEach(([type, checkbox]) => {
      if (checkbox) {
        dataTypes[type] = checkbox.checked;
      }
    });

    return dataTypes;
  },

  /**
   * Sauvegarde les paramètres actuels
   */
  saveSettings() {
    const dataTypes = this.getSelectedDataTypes();

    chrome.storage.sync.set({
      showLogsEnabled: this.elements.showLogsToggle?.checked || false,
      dataTypes
    });
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
    UIManager.clearResults();
    UIManager.setStatus('Nettoyage en cours...', 'info');
    UIManager.setCleanButtonEnabled(false);

    try {
      // Récupérer les origines des favoris
      const {
        origins,
        invalidUrls
      } = await BookmarkManager.getBookmarkOrigins();

      // Afficher les URL invalides si nécessaire
      if (invalidUrls.length > 0) {
        UIManager.addResult(
          `Attention: ${invalidUrls.length} URL(s) invalide(s) trouvée(s) dans les favoris:`,
          'warning'
        );
        UIManager.addResultList(invalidUrls, 'warning');
      }

      // Établir la connexion avec le background script
      const port = chrome.runtime.connect({ name: "clean-port" });

      // Récupérer les types de données sélectionnés
      const dataTypes = UIManager.getSelectedDataTypes();

      // Envoyer la demande de nettoyage
      port.postMessage({
        action: "clean",
        origins,
        dataTypes
      });

      // Gérer la réponse
      port.onMessage.addListener((msg) => {
        UIManager.setCleanButtonEnabled(true);
        UIManager.setStatus('');

        if (msg.status === "done") {
          const domainsCount = origins.length;
          UIManager.addResult(
            `Nettoyage terminé avec succès! ${domainsCount} domaine(s) préservé(s).`,
            'success'
          );

          // Afficher les logs si l'option est activée
          if (UIManager.elements.showLogsToggle?.checked && msg.log) {
            chrome.tabs.create({
              url: 'logs.html?log=' + encodeURIComponent(JSON.stringify(msg.log))
            });
          }

          // Mettre à jour les statistiques
          UIManager.updateStats(msg.log.excludedOrigins.count, msg.log.endTime);
          UIManager.saveLastCleanedTime(msg.log.endTime);

        } else if (msg.status === "error") {
          UIManager.addResult(`Erreur lors du nettoyage: ${msg.message}`, 'error');

          // Afficher les logs en cas d'erreur si l'option est activée
          if (UIManager.elements.showLogsToggle?.checked && msg.log) {
            chrome.tabs.create({
              url: 'logs.html?log=' + encodeURIComponent(JSON.stringify(msg.log))
            });
          }
        }
      });

      // Gérer la déconnexion
      port.onDisconnect.addListener(() => {
        UIManager.setCleanButtonEnabled(true);
        UIManager.setStatus('');

        if (chrome.runtime.lastError) {
          UIManager.addResult(
            `La connexion avec le service de nettoyage a été interrompue: ${chrome.runtime.lastError.message}`,
            'error'
          );
        } else {
          UIManager.addResult(
            'La connexion avec le service de nettoyage a été interrompue.',
            'error'
          );
        }
      });

    } catch (error) {
      console.error("Erreur pendant le processus de nettoyage:", error);
      UIManager.setCleanButtonEnabled(true);
      UIManager.setStatus('');
      UIManager.addResult(`Erreur: ${error.message}`, 'error');
    }
  }
};

/**
 * Initialise l'application lorsque le DOM est chargé
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialiser l'interface utilisateur
  UIManager.initElements();
  await UIManager.loadSavedState();

  // Charger et afficher les statistiques
  loadAndDisplayStats();

  // Écouter les événements de l'interface
  UIManager.elements.cleanButton?.addEventListener('click', () => {
    CleaningManager.executeCleanup();
  });

  UIManager.elements.showLogsToggle?.addEventListener('change', () => {
    UIManager.saveSettings();
  });

  UIManager.elements.advancedSettingsToggle?.addEventListener('change', (e) => {
    UIManager.toggleAdvancedSettings(e.target.checked);
  });

  // Écouter les changements dans les cases à cocher des types de données
  Object.values(UIManager.elements.dataTypeCheckboxes).forEach(checkbox => {
    checkbox?.addEventListener('change', () => {
      UIManager.saveSettings();
    });
  });
});

/**
 * Charge les statistiques sauvegardées et les affiche
 */
async function loadAndDisplayStats() {
  try {
    // Charger la dernière heure de nettoyage depuis le stockage
    const storageResult = await chrome.storage.sync.get({
      lastCleanedTime: null
    });
    const lastCleanedTime = storageResult.lastCleanedTime;

    // Récupérer le nombre actuel de sites favoris
    const {
      origins
    } = await BookmarkManager.getBookmarkOrigins();
    const bookmarksCount = origins.length;

    // Mettre à jour l'affichage des statistiques
    UIManager.updateStats(bookmarksCount, lastCleanedTime);

  } catch (error) {
    console.error("Erreur lors du chargement ou de l'affichage des statistiques:", error);
    UIManager.updateStats(-1, null); // Afficher des tirets en cas d'erreur
    // Potentiellement afficher une erreur dans les logs si nécessaire
  }
}
