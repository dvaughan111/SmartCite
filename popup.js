document.getElementById('citeButton').addEventListener('click', async () => {
  const format = document.querySelector('.format-select').value;
  const resultDiv = document.getElementById('result');
  
  resultDiv.innerHTML = '<i>Generating citation...</i>';
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Execute content script
  const response = await chrome.tabs.sendMessage(tab.id, { action: 'generateCitation', format });
  
  if (response.error) {
    resultDiv.innerHTML = `<div style="color: red;">${response.error}</div>`;
  } else {
    resultDiv.innerHTML = `
      <strong>Citation:</strong>
      <textarea style="width: 100%; height: 60px; margin-top: 5px;">${response.citation}</textarea>
      <button onclick="navigator.clipboard.writeText('${response.citation.replace(/'/g, "\\'")}')">
        Copy to Clipboard
      </button>
    `;
    
    // Track usage
    const usage = await chrome.storage.local.get(['citationCount']);
    const newCount = (usage.citationCount || 0) + 1;
    await chrome.storage.local.set({ citationCount: newCount });
    
    // Show upgrade message after 5 uses
    if (newCount >= 5) {
      resultDiv.innerHTML += `
        <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
          <strong>Upgrade Required</strong><br>
          <a href="https://your-landing-page.com/upgrade" target="_blank">
            Upgrade to Premium for unlimited citations
          </a>
        </div>
      `;
    }
  }
});
