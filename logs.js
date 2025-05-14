/**
 * Browser Cleaner - Script d'affichage des logs
 * Affiche et gère les détails des opérations de nettoyage
 */

// Gestionnaire des données de logs
const LogDataManager = {
  logData: null,

  /**
   * Parse les données de log depuis l'URL
   * @returns {Object|null} Données de log ou null en cas d'erreur
   */
  parseLogData() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const logParam = urlParams.get('log');

      if (!logParam) {
        throw new Error('Aucune donnée de log trouvée dans l\'URL');
      }

      return JSON.parse(decodeURIComponent(logParam));
    } catch (error) {
      console.error('Erreur lors du parsing des données de log:', error);
      return null;
    }
  },

  /**
   * Formate une date ISO en format lisible
   * @param {string} isoDate - Date au format ISO
   * @returns {string} Date formatée
   */
  formatDate(isoDate) {
    if (!isoDate) return '-';

    try {
      const date = new Date(isoDate);
      return date.toLocaleString();
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      return isoDate;
    }
  },

  /**
   * Formate une durée en millisecondes
   * @param {number} ms - Durée en millisecondes
   * @returns {string} Durée formatée
   */
  formatDuration(ms) {
    if (!ms && ms !== 0) return '-';

    if (ms < 1000) {
      return `${ms} ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)} secondes`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes} min ${seconds} s`;
    }
  }
};

// Gestionnaire de l'interface des logs
const LogUIManager = {
  elements: {
    // Résumé
    statusValue: null,
    dateValue: null,
    durationValue: null,
    preservedValue: null,

    // Onglets
    tabButtons: null,
    tabContents: null,

    // Contenu des onglets
    detailsTable: null,
    errorSection: null,
    errorMessage: null,
    errorStack: null,
    domainsList: null,
    domainSearch: null,
    rawJson: null,

    // Boutons
    exportBtn: null,
    goBackBtn: null,
    copyJsonBtn: null,
    formatJsonBtn: null
  },

  /**
   * Initialise les éléments de l'interface
   */
  initElements() {
    // Résumé
    this.elements.statusValue = document.getElementById('statusValue');
    this.elements.dateValue = document.getElementById('dateValue');
    this.elements.durationValue = document.getElementById('durationValue');
    this.elements.preservedValue = document.getElementById('preservedValue');

    // Onglets
    this.elements.tabButtons = document.querySelectorAll('.tab-btn');
    this.elements.tabContents = document.querySelectorAll('.tab-content');

    // Contenu des onglets
    this.elements.detailsTable = document.getElementById('detailsTable');
    this.elements.errorSection = document.getElementById('errorSection');
    this.elements.errorMessage = document.getElementById('errorMessage');
    this.elements.errorStack = document.getElementById('errorStack');
    this.elements.domainsList = document.getElementById('domainsList');
    this.elements.domainSearch = document.getElementById('domainSearch');
    this.elements.rawJson = document.getElementById('rawJson');

    // Boutons
    this.elements.exportBtn = document.getElementById('exportBtn');
    this.elements.goBackBtn = document.getElementById('goBackBtn');
    this.elements.copyJsonBtn = document.getElementById('copyJsonBtn');
    this.elements.formatJsonBtn = document.getElementById('formatJsonBtn');
  },

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Gestion des onglets
    this.elements.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.switchTab(button.dataset.tab);
      });
    });

    // Bouton de retour
    this.elements.goBackBtn?.addEventListener('click', () => {
      window.close();
    });

    // Bouton d'exportation
    this.elements.exportBtn?.addEventListener('click', () => {
      this.exportLogData(LogDataManager.logData);
    });

    // Boutons JSON
    this.elements.copyJsonBtn?.addEventListener('click', () => {
      this.copyToClipboard(this.elements.rawJson.textContent);
    });

    this.elements.formatJsonBtn?.addEventListener('click', () => {
      this.toggleJsonFormat();
    });

    // Recherche de domaines
    this.elements.domainSearch?.addEventListener('input', (e) => {
      this.filterDomains(e.target.value);
    });
  },

  /**
   * Change l'onglet actif
   * @param {string} tabId - Identifiant de l'onglet à activer
   */
  switchTab(tabId) {
    // Désactiver tous les onglets
    this.elements.tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });

    this.elements.tabContents.forEach(content => {
      content.classList.remove('active');
    });

    // Activer l'onglet sélectionné
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
  },

  /**
   * Exporte les données de log au format JSON
   * @param {Object} data - Données à exporter
   */
  exportLogData(data) {
    if (!data) return;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Créer un lien de téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-cleaner-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();

    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * Copie le contenu dans le presse-papier
   * @param {string} text - Texte à copier
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Retour visuel temporaire
        const originalText = this.elements.copyJsonBtn.textContent;
        this.elements.copyJsonBtn.textContent = 'Copié !';
        setTimeout(() => {
          this.elements.copyJsonBtn.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        console.error('Erreur lors de la copie:', err);
      });
  },

  /**
   * Bascule entre format JSON compact et formaté
   */
  toggleJsonFormat() {
    const rawJson = this.elements.rawJson;
    const button = this.elements.formatJsonBtn;

    if (button.classList.contains('active')) {
      // Passer au format compact
      try {
        const jsonData = JSON.parse(rawJson.textContent);
        rawJson.textContent = JSON.stringify(jsonData);
        button.textContent = 'Formater';
      } catch (error) {
        console.error('Erreur lors du parsing JSON:', error);
      }
    } else {
      // Passer au format formaté
      try {
        const jsonData = JSON.parse(rawJson.textContent);
        rawJson.textContent = JSON.stringify(jsonData, null, 2);
        button.textContent = 'Compacter';
      } catch (error) {
        console.error('Erreur lors du parsing JSON:', error);
      }
    }

    button.classList.toggle('active');
  },

  /**
   * Filtre la liste des domaines par recherche
   * @param {string} searchTerm - Terme de recherche
   */
  filterDomains(searchTerm) {
    const domainItems = document.querySelectorAll('.domain-item');
    const lowerSearchTerm = searchTerm.toLowerCase();

    domainItems.forEach(item => {
      const domainText = item.textContent.toLowerCase();
      if (domainText.includes(lowerSearchTerm)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  },

  /**
   * Affiche les données de résumé
   * @param {Object} logData - Données de log
   */
  displaySummary(logData) {
    if (!logData) return;

    // Status
    if (this.elements.statusValue) {
      this.elements.statusValue.textContent = logData.success ? 'Réussi' : 'Échec';
      this.elements.statusValue.className = 'summary-value ' + (logData.success ? 'success' : 'error');
    }

    // Date
    if (this.elements.dateValue) {
      this.elements.dateValue.textContent = LogDataManager.formatDate(logData.startTime);
    }

    // Durée
    if (this.elements.durationValue) {
      this.elements.durationValue.textContent = LogDataManager.formatDuration(logData.duration);
    }

    // Sites préservés
    if (this.elements.preservedValue) {
      this.elements.preservedValue.textContent = logData.excludedOrigins?.count || 0;
    }
  },

  /**
   * Affiche les détails de l'opération
   * @param {Object} logData - Données de log
   */
  displayDetails(logData) {
    if (!logData || !this.elements.detailsTable) return;

    // Vider la table des détails
    this.elements.detailsTable.innerHTML = '';

    // Données de l'opération
    const details = [
      { label: 'Opération', value: logData.operation || 'Nettoyage des données de navigation' },
      { label: 'Heure de début', value: LogDataManager.formatDate(logData.startTime) },
      { label: 'Heure de fin', value: LogDataManager.formatDate(logData.endTime) },
      { label: 'Durée', value: LogDataManager.formatDuration(logData.duration) },
      { label: 'Sites préservés', value: logData.excludedOrigins?.count || 0 },
      { label: 'Types de données nettoyés', value: (logData.dataTypesRemoved || []).join(', ') }
    ];

    // Ajouter chaque ligne à la table
    details.forEach(detail => {
      const row = document.createElement('tr');

      const labelCell = document.createElement('td');
      labelCell.className = 'label-cell';
      labelCell.textContent = detail.label;

      const valueCell = document.createElement('td');
      valueCell.className = 'value-cell';
      valueCell.textContent = detail.value;

      row.appendChild(labelCell);
      row.appendChild(valueCell);
      this.elements.detailsTable.appendChild(row);
    });

    // Afficher les informations d'erreur si présentes
    if (logData.error && this.elements.errorSection) {
      this.elements.errorSection.style.display = 'block';

      if (this.elements.errorMessage) {
        this.elements.errorMessage.textContent = logData.error.message || 'Une erreur est survenue';
      }

      if (this.elements.errorStack && logData.error.stack) {
        this.elements.errorStack.textContent = logData.error.stack;
      }
    } else if (this.elements.errorSection) {
      this.elements.errorSection.style.display = 'none';
    }
  },

  /**
   * Affiche la liste des domaines préservés
   * @param {Object} logData - Données de log
   */
  displayDomains(logData) {
    if (!logData || !this.elements.domainsList) return;

    // Vider la liste des domaines
    this.elements.domainsList.innerHTML = '';

    const domains = logData.excludedOrigins?.domains || [];

    if (domains.length === 0) {
      const message = document.createElement('p');
      message.className = 'no-domains';
      message.textContent = 'Aucun domaine préservé';
      this.elements.domainsList.appendChild(message);
      return;
    }

    // Trier les domaines par ordre alphabétique
    domains.sort();

    // Créer un élément pour chaque domaine
    domains.forEach(domain => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';

      try {
        // Essayer d'extraire le nom de domaine à partir de l'URL
        const url = new URL(domain);
        const favicon = document.createElement('img');
        favicon.className = 'favicon';
        favicon.src = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
        favicon.onerror = () => {
          favicon.style.display = 'none';
        };

        const domainText = document.createElement('span');
        domainText.textContent = url.hostname;

        domainItem.appendChild(favicon);
        domainItem.appendChild(domainText);
      } catch (error) {
        // Fallback si l'URL est invalide
        domainItem.textContent = domain;
      }

      this.elements.domainsList.appendChild(domainItem);
    });
  },

  /**
   * Affiche les données JSON brutes
   * @param {Object} logData - Données de log
   */
  displayRawJson(logData) {
    if (!logData || !this.elements.rawJson) return;

    // Afficher les données JSON formatées
    this.elements.rawJson.textContent = JSON.stringify(logData, null, 2);
  }
};

/**
 * Point d'entrée principal
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser l'interface utilisateur
  LogUIManager.initElements();
  LogUIManager.setupEventListeners();

  // Récupérer et traiter les données de log
  const logData = LogDataManager.parseLogData();
  LogDataManager.logData = logData;

  if (logData) {
    // Afficher les données dans l'interface
    LogUIManager.displaySummary(logData);
    LogUIManager.displayDetails(logData);
    LogUIManager.displayDomains(logData);
    LogUIManager.displayRawJson(logData);
  } else {
    // Afficher un message d'erreur
    document.body.innerHTML = `
      <div class="container error-container">
        <h1>Erreur</h1>
        <p>Impossible de charger les données de log.</p>
        <button class="btn btn-primary" onclick="window.close()">Fermer</button>
      </div>
    `;
  }
});
