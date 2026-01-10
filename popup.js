document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup initialized');
  
  // DOM Elements
  const citeButton = document.getElementById('citeButton');
  const formatSelect = document.getElementById('formatSelect');
  const resultDiv = document.getElementById('result');
  const usageCount = document.getElementById('count');
  const toggleManualEdit = document.getElementById('toggleManualEdit');
  const manualEditPanel = document.getElementById('manualEditPanel');
  const saveManualBtn = document.getElementById('saveManual');
  const cancelManualBtn = document.getElementById('cancelManual');
  const upgradeLink = document.getElementById('upgradeLink');
  
  // State
  let currentTab = null;
  let currentMetadata = {};
  
  // ========== INITIALIZATION ==========
  
  // Load usage count
  chrome.storage.local.get(['citationCount'], function(result) {
    const count = result.citationCount || 0;
    usageCount.textContent = count;
    
    if (count >= 10) {
      citeButton.disabled = true;
      citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
    }
  });
  
  // ========== PERMISSION & SCRIPT HANDLING ==========
  
  async function requestPageAccess() {
    try {
      console.log('Requesting host permissions...');
      
      // Request optional permissions
      const granted = await chrome.permissions.request({
        origins: ['*://*/*']
      });
      
      if (!granted) {
        throw new Error('Permission required to read page content. SmartCite needs this to generate citations.');
      }
      
      console.log('Permissions granted');
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      throw error;
    }
  }
  
  async function injectContentScript(tabId) {
    try {
      console.log('Injecting content script...');
      
      // Remove any existing content script first
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Clear any existing listeners
          if (window.smartCiteScriptInjected) {
            console.log('Removing existing SmartCite script');
          }
        }
      });
      
      // Inject fresh content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Wait for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Content script injected successfully');
      return true;
    } catch (error) {
      console.error('Failed to inject content script:', error);
      
      // Try alternative injection method
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          code: `console.log('SmartCite fallback injection'); window.smartCiteReady = true;`
        });
        return true;
      } catch (fallbackError) {
        console.error('Fallback injection also failed:', fallbackError);
        return false;
      }
    }
  }
  
  // ========== CITATION GENERATION ==========
  
  async function generateCitation() {
    console.log('Starting citation generation...');
    
    const format = formatSelect.value;
    
    // Show loading state
    resultDiv.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Analyzing page content...</p>
        <p style="font-size: 12px; color: #718096; margin-top: 10px;">
          Requesting page permissions...
        </p>
      </div>
    `;
    
    citeButton.disabled = true;
    citeButton.innerHTML = '<span>⏳</span><span>Processing...</span>';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tab;
      
      // Check if valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        throw new Error('Cannot generate citations for browser pages. Please navigate to a regular website.');
      }
      
      // Request permissions
      await requestPageAccess();
      
      // Try to communicate with content script
      let contentScriptReady = false;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'ping',
          timestamp: Date.now()
        });
        console.log('Content script ping response:', response);
        contentScriptReady = true;
      } catch (pingError) {
        console.log('Content script not reachable, attempting injection...');
      }
      
      // Inject content script if not ready
      if (!contentScriptReady) {
        const injected = await injectContentScript(tab.id);
        if (!injected) {
          throw new Error('This page has security restrictions. Please use the manual edit feature below.');
        }
        
        // Try ping again after injection
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          contentScriptReady = true;
        } catch (finalError) {
          console.error('Still cannot reach content script:', finalError);
        }
      }
      
      if (!contentScriptReady) {
        // Fallback to page metadata via scripting API
        console.log('Using fallback metadata extraction');
        const fallbackData = await extractFallbackMetadata(tab.id);
        currentMetadata = fallbackData;
        
        const citation = generateCitationFromMetadata(fallbackData, format);
        await handleSuccessfulCitation(citation, fallbackData);
        return;
      }
      
      // Normal flow: content script is ready
      console.log('Requesting citation from content script...');
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'generateCitation',
        format: format,
        url: tab.url
      });
      
      console.log('Citation response:', response);
      
      if (response && response.success && response.citation) {
        currentMetadata = response.metadata || {};
        await handleSuccessfulCitation(response.citation, currentMetadata);
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        throw new Error('Failed to generate citation. Please try manual edit.');
      }
    } catch (error) {
      console.error('Citation generation failed:', error);
      showErrorMessage(error.message);
    } finally {
      // Reset button
      const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
      if (currentCount < 10) {
        citeButton.disabled = false;
        citeButton.innerHTML = '<span>🔍</span><span>Generate Citation</span>';
      }
    }
  }
  
  async function extractFallbackMetadata(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            // Try to get meta tags
            metaTitle: document.querySelector('meta[property="og:title"]')?.content || 
                      document.querySelector('meta[name="title"]')?.content,
            metaAuthor: document.querySelector('meta[name="author"]')?.content,
            metaDate: document.querySelector('meta[property="article:published_time"]')?.content
          };
        }
      });
      
      const data = results[0]?.result || {};
      return {
        sourceType: 'webpage',
        title: data.metaTitle || data.title || 'Unknown Title',
        authors: data.metaAuthor || 'Unknown Author',
        date: data.metaDate ? new Date(data.metaDate).getFullYear().toString() : new Date().getFullYear().toString(),
        site: data.domain || 'Website',
        domain: data.domain,
        url: data.url,
        isFallback: true
      };
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return {
        sourceType: 'webpage',
        title: 'Unknown Title',
        authors: 'Unknown Author',
        date: new Date().getFullYear().toString(),
        site: 'Website',
        url: currentTab?.url || 'https://example.com'
      };
    }
  }
  
  function generateCitationFromMetadata(metadata, format) {
    const authors = metadata.authors || 'Unknown Author';
    const year = metadata.date ? metadata.date.substring(0, 4) : new Date().getFullYear().toString();
    const title = metadata.title || 'Unknown Title';
    const site = metadata.site || 'Website';
    const url = metadata.url || 'https://example.com';
    
    switch(format) {
      case 'apa':
        return `${authors}. (${year}). ${title}. ${site}. Retrieved from ${url}`;
      case 'mla':
        return `${authors}. "${title}." ${site}, ${year}, ${url}.`;
      case 'chicago':
        const accessDate = new Date().toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        return `${authors}. "${title}." ${site}. Accessed ${accessDate}. ${url}`;
      case 'ieee':
        return `[1] ${authors}, "${title}," ${site}, ${year}. Available: ${url}`;
      case 'harvard':
        return `${authors} (${year}) '${title}', ${site}. Available at: ${url} (Accessed: ${new Date().toLocaleDateString('en-GB')})`;
      case 'vancouver':
        return `${authors}. ${title} [Internet]. ${site}; ${year} [cited ${new Date().toLocaleDateString()}]. Available from: ${url}`;
      case 'ama':
        return `${authors}. ${title}. ${site}. ${year}. Available at: ${url}. Accessed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;
      default:
        return `${authors}. "${title}." ${site} (${year}). ${url}`;
    }
  }
  
  async function handleSuccessfulCitation(citation, metadata) {
    // Update usage count
    const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
    const newCount = currentCount + 1;
    await chrome.storage.local.set({ citationCount: newCount });
    usageCount.textContent = newCount;
    
    // Display result
    showCitationResult(citation, metadata);
    
    // Check daily limit
    if (newCount >= 10) {
      citeButton.disabled = true;
      citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
    }
  }
  
  function showCitationResult(citation, metadata) {
    const isFallback = metadata.isFallback;
    const sourceType = metadata.sourceType || 'webpage';
    const isVideo = sourceType === 'video';
    
    const metadataInfo = `
      <div class="success">
        <strong>✅ Citation Generated Successfully!</strong>
        ${isFallback ? '<div style="font-size: 13px; margin-top: 8px;">(Using fallback method - some metadata may be missing)</div>' : ''}
      </div>
      <div style="background: #edf2f7; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <div style="font-size: 13px; color: #4a5568;">
          <strong>Detected Source:</strong> ${isVideo ? '🎬 Video' : '📄 Article'}
          ${metadata.site ? `<br><strong>Site:</strong> ${metadata.site}` : ''}
          ${metadata.title ? `<br><strong>Title:</strong> ${metadata.title.substring(0, 100)}${metadata.title.length > 100 ? '...' : ''}` : ''}
          ${metadata.authors ? `<br><strong>Author(s):</strong> ${metadata.authors}` : ''}
          ${metadata.date ? `<br><strong>Date:</strong> ${metadata.date.substring(0, 4)}` : ''}
        </div>
      </div>
    `;
    
    resultDiv.innerHTML = `
      ${metadataInfo}
      <textarea id="citationText" readonly>${citation}</textarea>
      <div class="actions">
        <button class="copy-btn" id="copyButton">
          <span>📋</span>
          <span>Copy Citation</span>
        </button>
        <button id="newCitationBtn" style="background: #a0aec0;">
          <span>🔄</span>
          <span>New Citation</span>
        </button>
      </div>
    `;
    
    // Set up copy button
    document.getElementById('copyButton').addEventListener('click', function() {
      const textarea = document.getElementById('citationText');
      textarea.select();
      document.execCommand('copy');
      
      const originalHTML = this.innerHTML;
      this.innerHTML = '<span>✅</span><span>Copied!</span>';
      this.style.background = '#38a169';
      
      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.background = '#38b2ac';
      }, 2000);
    });
    
    // New citation button
    document.getElementById('newCitationBtn').addEventListener('click', function() {
      resultDiv.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <div style="font-size: 48px; color: #667eea; margin-bottom: 15px;">📚</div>
          <div style="color: #4a5568; font-size: 16px;">Ready for new citation</div>
          <div style="color: #718096; font-size: 14px; margin-top: 10px;">Select style and click "Generate Citation"</div>
        </div>
      `;
    });
    
    // Populate manual edit fields
    if (metadata) {
      document.getElementById('editTitle').value = metadata.title || '';
      document.getElementById('editAuthors').value = metadata.authors || '';
      document.getElementById('editYear').value = metadata.date ? 
        (metadata.date.length > 4 ? metadata.date.substring(0, 4) : metadata.date) : 
        new Date().getFullYear().toString();
      document.getElementById('editJournal').value = metadata.site || metadata.journal || 
        (metadata.domain ? metadata.domain : 'Website');
    }
  }
  
  function showErrorMessage(message, url) {
  // Check if it's a PDF URL
  const isPDF = url && (
    url.toLowerCase().endsWith('.pdf') ||
    url.includes('/pdf') ||
    url.includes('application/pdf') ||
    url.includes('.pdf?') ||
    url.includes('contentType=pdf')
  );
  
  let specificGuidance = '';
  if (isPDF) {
    specificGuidance = `
      <div style="margin-top: 15px; padding: 15px; background: #e6fffa; border-radius: 10px; border-left: 4px solid #38b2ac;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="font-size: 20px;">📄</span>
          <span style="font-weight: 600; color: #234e52;">PDF File Detected</span>
        </div>
        <div style="font-size: 13px; color: #234e52; line-height: 1.5;">
          <strong>Why this happens:</strong> Browsers block extensions from reading PDF files for security.<br>
          <strong>Solution:</strong> Use the <strong>"Edit Details Manually"</strong> button below.<br>
          <strong>Tip:</strong> Look for the title, author, and year in the PDF viewer.
        </div>
      </div>
    `;
  }
  
  resultDiv.innerHTML = `
    <div class="error">
      <strong>❌ ${message}</strong>
      ${specificGuidance}
      <div style="margin-top: ${isPDF ? '20px' : '15px'}; font-size: 14px;">
        <strong>${isPDF ? 'Next Steps:' : 'Try this:'}</strong>
        <div style="margin-top: 10px; padding: 12px; background: #fff5f5; border-radius: 8px; border: 1px solid #fed7d7;">
          ${isPDF ? 
            '1. Click "Edit Details Manually" below<br>' +
            '2. Enter the PDF details (title, author, year, publisher)<br>' +
            '3. Click "Use These Details" to generate citation' :
            '1. Refresh the page you want to cite<br>' +
            '2. Click the SmartCite icon again<br>' +
            '3. Use "Edit Details Manually" below'
          }
        </div>
      </div>
    </div>
  `;
}
  
  // ========== MANUAL EDIT FEATURE ==========
  
  toggleManualEdit.addEventListener('click', function() {
    if (manualEditPanel.style.display === 'none' || manualEditPanel.style.display === '') {
      manualEditPanel.style.display = 'block';
      this.innerHTML = '<span>✖️</span><span>Close Editor</span>';
    } else {
      manualEditPanel.style.display = 'none';
      this.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
    }
  });
  
  cancelManualBtn.addEventListener('click', function() {
    manualEditPanel.style.display = 'none';
    toggleManualEdit.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
  });
  
  saveManualBtn.addEventListener('click', async function() {
    const title = document.getElementById('editTitle').value.trim();
    if (!title) {
      alert('Please enter a title for your citation');
      return;
    }
    
    const authors = document.getElementById('editAuthors').value.trim() || 'Unknown Author';
    const year = document.getElementById('editYear').value.trim() || new Date().getFullYear().toString();
    const journal = document.getElementById('editJournal').value.trim() || 'Website';
    const format = formatSelect.value;
    const url = currentTab ? currentTab.url : 'https://example.com';
    
    const manualMetadata = {
      sourceType: 'manual',
      title: title,
      authors: authors,
      date: year,
      site: journal,
      url: url,
      isManual: true
    };
    
    const citation = generateCitationFromMetadata(manualMetadata, format);
    
    // Update usage count
    const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
    const newCount = currentCount + 1;
    await chrome.storage.local.set({ citationCount: newCount });
    usageCount.textContent = newCount;
    
    // Display manual citation
    resultDiv.innerHTML = `
      <div class="success">
        <strong>✅ Manual Citation Created</strong>
      </div>
      <div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <div style="font-size: 13px; color: #234e52;">
          <strong>Manual Entry Details:</strong>
          <br><strong>Title:</strong> ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}
          <br><strong>Author(s):</strong> ${authors}
          <br><strong>Year:</strong> ${year}
          <br><strong>Source:</strong> ${journal}
        </div>
      </div>
      <textarea id="citationText" readonly>${citation}</textarea>
      <div class="actions">
        <button class="copy-btn" id="copyButton">
          <span>📋</span>
          <span>Copy Citation</span>
        </button>
      </div>
    `;
    
    // Set up copy button
    document.getElementById('copyButton').addEventListener('click', function() {
      const textarea = document.getElementById('citationText');
      textarea.select();
      document.execCommand('copy');
      this.innerHTML = '<span>✅</span><span>Copied!</span>';
      this.style.background = '#38a169';
      setTimeout(() => {
        this.innerHTML = '<span>📋</span><span>Copy Citation</span>';
        this.style.background = '#38b2ac';
      }, 2000);
    });
    
    // Close panel
    manualEditPanel.style.display = 'none';
    toggleManualEdit.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
    
    // Check daily limit
    if (newCount >= 10) {
      citeButton.disabled = true;
      citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
    }
  });
  
  // ========== UPGRADE LINK ==========
  
  if (upgradeLink) {
    upgradeLink.addEventListener('click', function(e) {
      e.preventDefault();
      resultDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 40px; color: #9f7aea; margin-bottom: 15px;">✨</div>
          <div style="font-weight: bold; color: #553c9a; margin-bottom: 20px; font-size: 20px;">
            SmartCite Premium
          </div>
          <div style="text-align: left; font-size: 14px; margin-bottom: 25px; line-height: 1.8;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>Unlimited</strong> daily citations</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>9,000+</strong> citation styles including all academic disciplines</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>AI-powered</strong> metadata detection with 99% accuracy</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>Export</strong> to Google Docs, Microsoft Word, and PDF</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>Bibliography</strong> manager with cloud sync</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #48bb78; font-size: 18px;">✓</span>
              <span><strong>Team</strong> collaboration features</span>
            </div>
          </div>
          <div style="padding: 15px; background: linear-gradient(135deg, #9f7aea 0%, #553c9a 100%); border-radius: 10px; color: white;">
            <strong>Launching Soon!</strong><br>
            Join waitlist for early access & 50% lifetime discount
          </div>
        </div>
      `;
    });
  }
  
  // ========== MAIN EVENT LISTENER ==========
  
  citeButton.addEventListener('click', generateCitation);
  
  console.log('SmartCite ready - with fallback handling for restricted pages');
});
