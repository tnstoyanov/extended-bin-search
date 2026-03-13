document.addEventListener('DOMContentLoaded', () => {
  const binInput = document.getElementById('binInput');
  const searchBtn = document.getElementById('searchBtn');
  const resultsDiv = document.getElementById('results');

  searchBtn.addEventListener('click', performSearch);

  binInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  async function performSearch() {
    const bin = binInput.value.trim();
    resultsDiv.innerHTML = '';

    // Validate input
    if (!bin) {
      showError('Please enter a BIN number');
      return;
    }

    if (!/^\d+$/.test(bin)) {
      showError('BIN must contain only digits');
      return;
    }

    if (bin.length < 6 || bin.length > 11) {
      showError('Your BIN should be 6-11 digits!');
      return;
    }

    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>';

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bin }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      // Check if there was a validation error from the server
      if (data.error) {
        showError(data.error);
        return;
      }

      displayResults(data);
    } catch (error) {
      showError('Error: ' + error.message);
    }
  }

  function displayResults(data) {
    resultsDiv.innerHTML = '';

    if (data.count === 0) {
      const message = document.createElement('div');
      message.className = 'message error';
      message.textContent = '❌ No matches found!';
      resultsDiv.appendChild(message);
    } else {
      const message = document.createElement('div');
      message.className = 'message success';
      message.textContent = `✓ ${data.count} match${data.count !== 1 ? 'es' : ''} found:`;
      resultsDiv.appendChild(message);

      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'table-wrapper';

      const table = document.createElement('table');
      
      // Get headers from first row
      if (data.matches.length > 0) {
        const headers = Object.keys(data.matches[0]);
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach((header) => {
          const th = document.createElement('th');
          th.textContent = header;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body rows
        const tbody = document.createElement('tbody');
        data.matches.forEach((row) => {
          const tr = document.createElement('tr');
          headers.forEach((header) => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }

      tableWrapper.appendChild(table);
      resultsDiv.appendChild(tableWrapper);
    }
  }

  function showError(message) {
    resultsDiv.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    errorDiv.textContent = '❌ ' + message;
    resultsDiv.appendChild(errorDiv);
  }
});
