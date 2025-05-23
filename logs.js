/**
 * Browser Cleaner - ${chrome.i18n.getMessage('logsScriptTitle')}
 * ${chrome.i18n.getMessage('logsScriptDescription')}
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
        throw new Error(chrome.i18n.getMessage('noLogDataFoundInUrl'));
      }

      return JSON.parse(decodeURIComponent(logParam));
    } catch (error) {
      console.error(chrome.i18n.getMessage('errorParsingLogData'), error);
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
      console.error(chrome.i18n.getMessage('errorFormattingDate'), error);
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
      return chrome.i18n.getMessage('millisecondsShort', [ms]);
    } else if (ms < 60000) {
      return chrome.i18n.getMessage('secondsShort', [(ms / 1000).toFixed(2)]);
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return chrome.i18n.getMessage('minutesSecondsShort', [minutes, seconds]);
    }
  }
};

// Gestionnaire de l'interface des logs
const LogUIManager = {
  elements: {
    // ${chrome.i18n.getMessage('summarySectionTitle')}
    statusValue: null,
    dateValue: null,
    durationValue: null,
    preservedValue: null,

    // ${chrome.i18n.getMessage('tabsSectionTitle')}
    tabButtons: null,
    tabContents: null,

    // ${chrome.i18n.getMessage('tabContentSectionTitle')}
    detailsTable: null,
    errorSection: null,
    errorMessage: null,
    errorStack: null,
    domainsList: null,
    domainSearch: null,
    rawJson: null,

    // ${chrome.i18n.getMessage('buttonsSectionTitle')}
    exportBtn: null,
    goBackBtn: null,
    copyJsonBtn: null,
    formatJsonBtn: null
  },

  /**
   * ${chrome.i18n.getMessage('initElementsDescription')}
   */
  initElements() {
    // ${chrome.i18n.getMessage('summarySectionTitle')}
    this.elements.statusValue = document.getElementById('statusValue');
    this.elements.dateValue = document.getElementById('dateValue');
    this.elements.durationValue = document.getElementById('durationValue');
    this.elements.preservedValue = document.getElementById('preservedValue');

    // ${chrome.i18n.getMessage('tabsSectionTitle')}
    this.elements.tabButtons = document.querySelectorAll('.tab-btn');
    this.elements.tabContents = document.querySelectorAll('.tab-content');

    // ${chrome.i18n.getMessage('tabContentSectionTitle')}
    this.elements.detailsTable = document.getElementById('detailsTable');
    this.elements.errorSection = document.getElementById('errorSection');
    this.elements.errorMessage = document.getElementById('errorMessage');
    this.elements.errorStack = document.getElementById('errorStack');
    this.elements.domainsList = document.getElementById('domainsList');
    this.elements.domainSearch = document.getElementById('domainSearch');
    this.elements.rawJson = document.getElementById('rawJson');

    // ${chrome.i18n.getMessage('buttonsSectionTitle')}
    this.elements.exportBtn = document.getElementById('exportBtn');
    this.elements.goBackBtn = document.getElementById('goBackBtn');
    this.elements.copyJsonBtn = document.getElementById('copyJsonBtn');
    this.elements.formatJsonBtn = document.getElementById('formatJsonBtn');
  },

  /**
   * ${chrome.i18n.getMessage('setupEventListenersDescription')}
   */
  setupEventListeners() {
    // ${chrome.i18n.getMessage('tabManagementComment')}
    this.elements.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.switchTab(button.dataset.tab);
      });
    });

    // ${chrome.i18n.getMessage('backButtonComment')}
    this.elements.goBackBtn?.addEventListener('click', () => {
      window.close();
    });

    // ${chrome.i18n.getMessage('exportButtonComment')}
    this.elements.exportBtn?.addEventListener('click', () => {
      this.exportLogData(LogDataManager.logData);
    });

    // ${chrome.i18n.getMessage('jsonButtonsComment')}
    this.elements.copyJsonBtn?.addEventListener('click', () => {
      this.copyToClipboard(this.elements.rawJson.textContent);
    });

    this.elements.formatJsonBtn?.addEventListener('click', () => {
      this.toggleJsonFormat();
    });

    // ${chrome.i18n.getMessage('domainSearchComment')}
    this.elements.domainSearch?.addEventListener('input', (e) => {
      this.filterDomains(e.target.value);
    });
  },

  /**
   * ${chrome.i18n.getMessage('switchTabDescription')}
   * @param {string} tabId - ${chrome.i18n.getMessage('tabIdParamDescription')}
   */
  switchTab(tabId) {
    // ${chrome.i18n.getMessage('deactivateAllTabsComment')}
    this.elements.tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });

    this.elements.tabContents.forEach(content => {
      content.classList.remove('active');
    });

    // ${chrome.i18n.getMessage('activateSelectedTabComment')}
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
  },

  /**
   * ${chrome.i18n.getMessage('exportLogDataDescription')}
   * @param {Object} data - ${chrome.i18n.getMessage('dataToExportParamDescription')}
   */
  exportLogData(data) {
    if (!data) return;

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // ${chrome.i18n.getMessage('createDownloadLinkComment')}
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-cleaner-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();

    // ${chrome.i18n.getMessage('cleanupComment')}
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * ${chrome.i18n.getMessage('copyToClipboardDescription')}
   * @param {string} text - ${chrome.i18n.getMessage('textToCopyParamDescription')}
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        // ${chrome.i18n.getMessage('temporaryVisualFeedbackComment')}
        const originalText = this.elements.copyJsonBtn.textContent;
        this.elements.copyJsonBtn.textContent = chrome.i18n.getMessage('copiedText');
        setTimeout(() => {
          this.elements.copyJsonBtn.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        console.error(chrome.i18n.getMessage('errorCopying'), err);
      });
  },

  /**
   * ${chrome.i18n.getMessage('toggleJsonFormatDescription')}
   */
  toggleJsonFormat() {
    const rawJson = this.elements.rawJson;
    const button = this.elements.formatJsonBtn;

    if (button.classList.contains('active')) {
      // ${chrome.i18n.getMessage('switchToCompactFormatComment')}
      try {
        const jsonData = JSON.parse(rawJson.textContent);
        rawJson.textContent = JSON.stringify(jsonData);
        button.textContent = chrome.i18n.getMessage('formatButtonText');
      } catch (error) {
        console.error(chrome.i18n.getMessage('errorParsingJson'), error);
      }
    } else {
      // ${chrome.i18n.getMessage('switchToFormattedFormatComment')}
      try {
        const jsonData = JSON.parse(rawJson.textContent);
        rawJson.textContent = JSON.stringify(jsonData, null, 2);
        button.textContent = chrome.i18n.getMessage('compactButtonText');
      } catch (error) {
        console.error(chrome.i18n.getMessage('errorParsingJson'), error);
      }
    }

    button.classList.toggle('active');
  },

  /**
   * ${chrome.i18n.getMessage('filterDomainsDescription')}
   * @param {string} searchTerm - ${chrome.i18n.getMessage('searchTermParamDescription')}
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
   * ${chrome.i18n.getMessage('displaySummaryDescription')}
   * @param {Object} logData - ${chrome.i18n.getMessage('logDataParamDescription')}
   */
  displaySummary(logData) {
    if (!logData) return;

    // ${chrome.i18n.getMessage('statusComment')}
    if (this.elements.statusValue) {
      this.elements.statusValue.textContent = logData.success ? chrome.i18n.getMessage('statusSuccess') : chrome.i18n.getMessage('statusFailure');
      this.elements.statusValue.className = 'summary-value ' + (logData.success ? 'success' : 'error');
    }

    // ${chrome.i18n.getMessage('dateComment')}
    if (this.elements.dateValue) {
      this.elements.dateValue.textContent = LogDataManager.formatDate(logData.startTime);
    }

    // ${chrome.i18n.getMessage('durationComment')}
    if (this.elements.durationValue) {
      this.elements.durationValue.textContent = LogDataManager.formatDuration(logData.duration);
    }

    // ${chrome.i18n.getMessage('preservedSitesComment')}
    if (this.elements.preservedValue) {
      this.elements.preservedValue.textContent = logData.excludedOrigins?.count || 0;
    }
  },

  /**
   * ${chrome.i18n.getMessage('displayDetailsDescription')}
   * @param {Object} logData - ${chrome.i18n.getMessage('logDataParamDescription')}
   */
  displayDetails(logData) {
    if (!logData || !this.elements.detailsTable) return;

    // ${chrome.i18n.getMessage('clearDetailsTableComment')}
    this.elements.detailsTable.innerHTML = '';

    // ${chrome.i18n.getMessage('operationDataComment')}
    const details = [
      { label: chrome.i18n.getMessage('operationLabel'), value: logData.operation || chrome.i18n.getMessage('cleanupOperation') },
      { label: chrome.i18n.getMessage('startTimeLabel'), value: LogDataManager.formatDate(logData.startTime) },
      { label: chrome.i18n.getMessage('endTimeLabel'), value: LogDataManager.formatDate(logData.endTime) },
      { label: chrome.i18n.getMessage('durationLabel'), value: LogDataManager.formatDuration(logData.duration) },
      { label: chrome.i18n.getMessage('preservedSitesLabel'), value: logData.excludedOrigins?.count || 0 },
      { label: chrome.i18n.getMessage('dataTypesCleanedLabel'), value: (logData.dataTypesRemoved || []).map(type => chrome.i18n.getMessage(type + 'Label')).join(', ') }
    ];

    // ${chrome.i18n.getMessage('addRowToTableComment')}
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

    // ${chrome.i18n.getMessage('displayErrorInformationComment')}
    if (logData.error && this.elements.errorSection) {
      this.elements.errorSection.style.display = 'block';

      if (this.elements.errorMessage) {
        this.elements.errorMessage.textContent = logData.error.message || chrome.i18n.getMessage('anErrorOccurred');
      }

      if (this.elements.errorStack && logData.error.stack) {
        this.elements.errorStack.textContent = logData.error.stack;
      }
    } else if (this.elements.errorSection) {
      this.elements.errorSection.style.display = 'none';
    }
  },

  /**
   * ${chrome.i18n.getMessage('displayDomainsDescription')}
   * @param {Object} logData - ${chrome.i18n.getMessage('logDataParamDescription')}
   */
  displayDomains(logData) {
    if (!logData || !this.elements.domainsList) return;

    // ${chrome.i18n.getMessage('clearDomainsListComment')}
    this.elements.domainsList.innerHTML = '';

    const domains = logData.excludedOrigins?.domains || [];

    if (domains.length === 0) {
      const message = document.createElement('p');
      message.className = 'no-domains';
      message.textContent = chrome.i18n.getMessage('noDomainsPreserved');
      this.elements.domainsList.appendChild(message);
      return;
    }

    // ${chrome.i18n.getMessage('sortDomainsAlphabeticallyComment')}
    domains.sort();

    // ${chrome.i18n.getMessage('createElementForEachDomainComment')}
    domains.forEach(domain => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';

      try {
        // ${chrome.i18n.getMessage('tryExtractDomainNameFromUrlComment')}
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
        // ${chrome.i18n.getMessage('fallbackInvalidUrlComment')}
        domainItem.textContent = domain;
      }

      this.elements.domainsList.appendChild(domainItem);
    });
  },

  /**
   * ${chrome.i18n.getMessage('displayRawJsonDescription')}
   * @param {Object} logData - ${chrome.i18n.getMessage('logDataParamDescription')}
   */
  displayRawJson(logData) {
    if (!logData || !this.elements.rawJson) return;

    // ${chrome.i18n.getMessage('displayFormattedJsonDataComment')}
    this.elements.rawJson.textContent = JSON.stringify(logData, null, 2);
  }
};

/**
 * ${chrome.i18n.getMessage('mainEntryPointTitle')}
 */
document.addEventListener('DOMContentLoaded', () => {
  // ${chrome.i18n.getMessage('initializeUIComment')}
  LogUIManager.initElements();
  LogUIManager.setupEventListeners();

  // ${chrome.i18n.getMessage('retrieveAndProcessLogDataComment')}
  const logData = LogDataManager.parseLogData();
  LogDataManager.logData = logData;

  if (logData) {
    // ${chrome.i18n.getMessage('displayDataInUIComment')}
    LogUIManager.displaySummary(logData);
    LogUIManager.displayDetails(logData);
    LogUIManager.displayDomains(logData);
    LogUIManager.displayRawJson(logData);
  } else {
    // ${chrome.i18n.getMessage('displayErrorMessageComment')}
    document.body.innerHTML = `
      <div class="container error-container">
        <h1>${chrome.i18n.getMessage('errorTitle')}</h1>
        <p>${chrome.i18n.getMessage('errorLoadingLogData')}</p>
        <button class="btn btn-primary" onclick="window.close()">${chrome.i18n.getMessage('closeButtonText')}</button>
      </div>
    `;
  }
});
