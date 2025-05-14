document.addEventListener('DOMContentLoaded', () => {
  const logContentDiv = document.getElementById('logContent');
  const urlParams = new URLSearchParams(window.location.search);
  const logData = urlParams.get('log');

  if (logData) {
    try {
      const log = JSON.parse(decodeURIComponent(logData));
      let html = '<h2>Operation Details:</h2>';
      if (log.error) {
        html += `<p style="color: red;">Status: Error</p>`;
        html += `<p style="color: red;">Error Message: ${log.errorMessage}</p>`;
      } else {
        html += `<p style="color: green;">Status: Success</p>`;
      }
      html += `<p>Start Time: ${new Date(log.startTime).toLocaleString()}</p>`;
      html += `<p>End Time: ${new Date(log.endTime).toLocaleString()}</p>`;
      html += `<p>Origins Excluded: ${log.originsExcluded}</p>`;
      html += `<p>Items Removed: ${log.itemsRemoved.join(', ')}</p>`;

      logContentDiv.innerHTML = html;
    } catch (e) {
      logContentDiv.innerHTML = `<p style="color: red;">Error parsing log data: ${e.message}</p>`;
    }
  } else {
    logContentDiv.innerHTML = `<p>No log data available.</p>`;
  }
});