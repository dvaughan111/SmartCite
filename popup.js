document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup loaded');
  
  const citeButton = document.getElementById('citeButton');
  const formatSelect = document.getElementById('formatSelect');
  const resultDiv = document.getElementById('result');
  const usageCount = document.getElementById('count');
  const upgradeLink = document.getElementById('upgradeLink');
  
  // Load usage count
  chrome.storage.local.get(['citationCount'], function(result) {
    const count = result.citationCount || 0;
    usageCount.textContent = count;
    
    if (count >= 5) {
      citeButton.disabled = true;
      citeButton.textContent = 'Free Limit Reached';
      citeButton.style.background = '#9CA3AF';
    }
  });
  
  // Citation button click
  citeButton.addEventListener('click', async function() {
    console.log('Generate citation clicked');
    
    const format = formatSelect.value;
    
    // Show loading state
    resultDiv.innerHTML = '<div class="loading">Generating citation...</div>';
    citeButton.disabled = true;
    citeButton.textContent = 'Processing...';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // Check if we're on a valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        throw new Error('Cannot generate citations for browser pages');
      }
      
      // Execute content script
      console.log('Sending message to content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'generateCitation', 
        format: format 
      });
      console.log('Response:', response);
      
      if (response && response.error) {
        resultDiv.innerHTML = `<div class="error">${response.error}</div>`;
      } else if (response && response.citation) {
        // Increment usage count
        const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
        const newCount = currentCount + 1;
        await chrome.storage.local.set({ citationCount: newCount });
        usageCount.textContent = newCount;
        
        // Show citation
        resultDiv.innerHTML = `
          <div class="success">✓ Citation generated</div>
          <textarea id="citationText" readonly>${response.citation}</textarea>
          <button class="copy-btn" id="copyButton">📋 Copy to Clipboard</button>
        `;
        
        // Add copy functionality
        document.getElementById('copyButton').addEventListener('click', function() {
          const textarea = document.getElementById('citationText');
          textarea.select();
          document.execCommand('copy');
          this.textContent = '✓ Copied!';
          this.style.background = '#10B981';
          setTimeout(() => {
            this.textContent = '📋 Copy to Clipboard';
            this.style.background = '#3B82F6';
          }, 2000);
        });
        
        // Check if reached limit
        if (newCount >= 5) {
          citeButton.disabled = true;
          citeButton.textContent = 'Free Limit Reached';
          citeButton.style.background = '#9CA3AF';
        }
      } else {
        resultDiv.innerHTML = '<div class="error">No response from page. Try refreshing.</div>';
      }
    } catch (error) {
      console.error('Popup error:', error);
      resultDiv.innerHTML = `
        <div class="error">
          Error: ${error.message}<br>
          <small>Make sure you're on a regular webpage.</small>
        </div>
      `;
    } finally {
      // Reset button state
      const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
      if (currentCount < 5) {
        citeButton.disabled = false;
        citeButton.textContent = '📚 Generate Citation';
      }
    }
  });
  
  // Upgrade link handler
  if (upgradeLink) {
    upgradeLink.addEventListener('click', function(e) {
      e.preventDefault();
      resultDiv.innerHTML = `
        <div style="text-align: center;">
          <div style="font-weight: bold; color: #2563EB; margin-bottom: 10px;">✨ Premium Features</div>
          <div style="text-align: left; font-size: 13px;">
            <div>• Unlimited citations</div>
            <div>• 9,000+ citation styles</div>
            <div>• Team collaboration</div>
            <div>• AI-powered suggestions</div>
          </div>
          <div style="margin-top: 15px; font-size: 12px;">
            Coming soon!<br>
            <small>Join waitlist for early access</small>
          </div>
        </div>
      `;
    });
  }
});
