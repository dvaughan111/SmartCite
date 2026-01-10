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
  
  // ========== PDF DETECTION ==========
  
  function isPDFUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.endsWith('.pdf') ||
      lowerUrl.includes('.pdf?') ||
      lowerUrl.includes('/pdf') ||
      lowerUrl.includes('application/pdf') ||
      lowerUrl.includes('contentType=pdf') ||
      lowerUrl.includes('type=pdf')
    );
  }
  
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
      return false;
    }
  }
  
  // ========== PDF FORM FUNCTIONS ==========
  
  function showPDFForm() {
    resultDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; color: #e53e3e; margin-bottom: 15px;">📄</div>
        <div style="color: #2d3748; font-size: 18px; font-weight: 600; margin-bottom: 5px;">
          PDF Citation Generator
        </div>
        <div style="color: #718096; font-size: 14px;">
          Enter the PDF details below
        </div>
      </div>
      
      <div style="background: #f7fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; color: #4a5568; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
            <span style="color: #e53e3e;">*</span> Title
          </label>
          <input type="text" id="pdfTitle" placeholder="e.g., Catcher in the Rye" 
                 style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; color: #4a5568; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
            <span style="color: #e53e3e;">*</span> Author(s)
          </label>
          <input type="text" id="pdfAuthor" placeholder="e.g., J.D. Salinger" 
                 style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label style="display: block; color: #4a5568; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
              Publication Year
            </label>
            <input type="text" id="pdfYear" placeholder="e.g., 1951" 
                   style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
          </div>
          
          <div>
            <label style="display: block; color: #4a5568; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
              Page(s) Cited
            </label>
            <input type="text" id="pdfPages" placeholder="e.g., 45-48 or p. 12" 
                   style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #4a5568; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
            Publisher/Website
          </label>
          <input type="text" id="pdfPublisher" placeholder="e.g., Little, Brown and Company" 
                 style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button id="generatePDFCitation" 
                  style="flex: 1; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                         color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Generate PDF Citation
          </button>
          <button id="backToAuto" 
                  style="padding: 14px 20px; background: #a0aec0; color: white; border: none; 
                         border-radius: 8px; font-weight: 600; cursor: pointer;">
            Back
          </button>
        </div>
      </div>
      
      <div style="background: #fffaf0; border: 2px dashed #ed8936; border-radius: 10px; padding: 15px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="color: #ed8936; font-size: 20px;">💡</span>
          <span style="font-weight: 600; color: #c05621;">Tips for PDF Citations:</span>
        </div>
        <div style="font-size: 13px; color: #744210; line-height: 1.5;">
          • Find the title on the cover or first page<br>
          • Look for author name near the title<br>
          • Publication year is often on the copyright page<br>
          • Include page numbers if citing specific passages
        </div>
      </div>
    `;
    
    // Set up event listeners for the PDF form
    document.getElementById('generatePDFCitation').addEventListener('click', generatePDFCitation);
    document.getElementById('backToAuto').addEventListener('click', function() {
      resultDiv.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <div style="font-size: 48px; color: #667eea; margin-bottom: 15px;">📚</div>
          <div style="color: #4a5568; font-size: 16px;">Ready to generate citation</div>
          <div style="color: #718096; font-size: 14px; margin-top: 10px;">Select style and click "Generate Citation"</div>
        </div>
      `;
    });
  }
  
  function generatePDFCitation() {
    const title = document.getElementById('pdfTitle').value.trim();
    const author = document.getElementById('pdfAuthor').value.trim();
    
    if (!title || !author) {
      alert('Please fill in at least Title and Author fields');
      return;
    }
    
    const year = document.getElementById('pdfYear').value.trim() || new Date().getFullYear().toString();
    const pages = document.getElementById('pdfPages').value.trim();
    const publisher = document.getElementById('pdfPublisher').value.trim() || 'Unknown Publisher';
    const format = formatSelect.value;
    const url = currentTab?.url || 'https://example.com';
    
    // Generate citation based on format
    let citation;
    const pageRef = pages ? ` pp. ${pages}` : '';
    
    switch(format) {
      case 'apa':
        citation = `${author}. (${year}). ${title}. ${publisher}.${pageRef}`;
        break;
      case 'mla':
        citation = `${author}. ${title}. ${publisher}, ${year}.${pageRef}`;
        break;
      case 'chicago':
        citation = `${author}. ${year}. ${title}. ${publisher}.${pageRef}`;
        break;
      case 'ieee':
        citation = `[1] ${author}, ${title}. ${publisher}, ${year}.${pageRef}`;
        break;
      case 'harvard':
        citation = `${author} (${year}) ${title}, ${publisher}.${pageRef}`;
        break;
      case 'vancouver':
        citation = `${author}. ${title}. ${publisher}; ${year}.${pageRef}`;
        break;
      case 'ama':
        citation = `${author}. ${title}. ${publisher}; ${year}.${pageRef}`;
        break;
      default:
        citation = `${author}. (${year}). ${title}. ${publisher}.${pageRef}`;
    }
    
    // Update usage count
    chrome.storage.local.get(['citationCount'], async function(result) {
      const currentCount = result.citationCount || 0;
      const newCount = currentCount + 1;
      await chrome.storage.local.set({ citationCount: newCount });
      usageCount.textContent = newCount;
      
      // Show the generated citation
      showPDFCitationResult(citation, { title, author, year, pages, publisher, url });
      
      // Check daily limit
      if (newCount >= 10) {
        citeButton.disabled = true;
        citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
      }
    });
  }
  
  function showPDFCitationResult(citation, metadata) {
    resultDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; color: #48bb78; margin-bottom: 15px;">✅</div>
        <div style="color: #2d3748; font-size: 18px; font-weight: 600; margin-bottom: 5px;">
          PDF Citation Generated
        </div>
      </div>
      
      <div style="background: #f0fff4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 13px; color: #22543d; margin-bottom: 15px;">
          <strong>📄 PDF Details Used:</strong>
          <div style="margin-top: 10px;">
            <div><strong>Title:</strong> ${metadata.title}</div>
            <div><strong>Author:</strong> ${metadata.author}</div>
            <div><strong>Year:</strong> ${metadata.year}</div>
            ${metadata.pages ? `<div><strong>Pages:</strong> ${metadata.pages}</div>` : ''}
            <div><strong>Publisher:</strong> ${metadata.publisher}</div>
          </div>
        </div>
        
        <textarea id="pdfCitationText" readonly 
                  style="width: 100%; min-height: 120px; padding: 16px; border: 2px solid #c6f6d5; 
                         border-radius: 8px; font-family: 'Georgia', serif; font-size: 15px; 
                         line-height: 1.6; margin: 15px 0; resize: vertical; background: white;">
${citation}
        </textarea>
        
        <div style="display: flex; gap: 10px;">
          <button id="copyPDFCitation" 
                  style="flex: 1; padding: 14px; background: #4299e1; color: white; border: none; 
                         border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; 
                         align-items: center; justify-content: center; gap: 8px;">
            <span>📋</span>
            <span>Copy to Clipboard</span>
          </button>
          <button id="newPDFCitation" 
                  style="padding: 14px 20px; background: #38b2ac; color: white; border: none; 
                         border-radius: 8px; font-weight: 600; cursor: pointer;">
            New PDF Citation
          </button>
        </div>
      </div>
    `;
    
    // Set up copy button
    document.getElementById('copyPDFCitation').addEventListener('click', function() {
      const textarea = document.getElementById('pdfCitationText');
      textarea.select();
      document.execCommand('copy');
      
      const originalHTML = this.innerHTML;
      this.innerHTML = '<span>✅</span><span>Copied!</span>';
      this.style.background = '#48bb78';
      
      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.background = '#4299e1';
      }, 2000);
    });
    
    // New PDF citation button
    document.getElementById('newPDFCitation').addEventListener('click', showPDFForm);
  }
  
  // ========== CITATION GENERATION (Regular Pages) ==========
  
  async function generateCitation() {
    console.log('Starting citation generation...');
    
    const format = formatSelect.value;
    
    // Show loading state
    resultDiv.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #e2e8f0; 
              border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; 
              margin: 0 auto 20px;"></div>
        <p style="color: #4a5568; font-size: 16px; margin-bottom: 10px;">Analyzing page content...</p>
        <p style="color: #718096; font-size: 13px;">
          Requesting page permissions
        </p>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
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
      
      // ========== PDF DETECTION ==========
      if (isPDFUrl(tab.url)) {
        showPDFForm();
        
        // Reset button
        citeButton.disabled = false;
        citeButton.innerHTML = '<span>🔍</span><span>Generate Citation</span>';
        return; // Stop here
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
      showErrorMessage(error.message, currentTab?.url);
    } finally {
      // Reset button if under limit
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
      <div class="success" style="background: #c6f6d5; border: 2px solid #68d391; border-radius: 10px; 
            padding: 18px; color: #22543d; margin-bottom: 15px;">
        <strong style="display: flex; align-items: center; gap: 10px;">
          <span>✅</span>
          <span>Citation Generated Successfully!</span>
        </strong>
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
      <textarea id="citationText" readonly 
                style="width: 100%; min-height: 140px; padding: 16px; border: 2px solid #e2e8f0; 
                       border-radius: 8px; font-family: 'Georgia', serif; font-size: 15px; 
                       line-height: 1.6; margin: 20px 0; resize: vertical; background: white;">
${citation}
      </textarea>
      <div class="actions" style="display: flex; gap: 12px; margin-top: 15px;">
        <button class="copy-btn" id="copyButton" 
                style="flex: 1; padding: 14px; background: #4299e1; color: white; border: none; 
                       border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; 
                       align-items: center; justify-content: center; gap: 10px;">
          <span>📋</span>
          <span>Copy Citation</span>
        </button>
        <button id="newCitationBtn" 
                style="padding: 14px 20px; background: #a0aec0; color: white; border: none; 
                       border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; 
                       align-items: center; gap: 10px;">
          <span>🔄</span>
          <span>New</span>
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
        this.style.background = '#4299e1';
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
    // Check if it's a PDF URL (for non-PDF flow errors)
    const isPDF = isPDFUrl(url);
    
    let specificGuidance = '';
    if (isPDF) {
      specificGuidance = `
        <div style="margin-top: 15px; padding: 15px; background: #e6fffa; border-radius: 10px; border-left: 4px solid #38b2ac;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 20px;">📄</span>
            <span style="font-weight: 600; color: #234e52;">PDF File Detected</span>
          </div>
          <div style="font-size: 13px; color: #234e52; line-height: 1.5;">
            <strong>Note:</strong> For PDF files, please use the manual edit feature below.
          </div>
        </div>
      `;
    }
    
    resultDiv.innerHTML = `
      <div class="error" style="background: #fed7d7; border: 2px solid #fc8181; border-radius: 10px; padding: 18px; color: #c53030;">
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
      <div class="success" style="background: #c6f6d5; border: 2px solid #68d391; border-radius: 10px; 
            padding: 18px; color: #22543d; margin-bottom: 15px;">
        <strong style="display: flex; align-items: center; gap: 10px;">
          <span>✅</span>
          <span>Manual Citation Created</span>
        </strong>
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
      <textarea id="citationText" readonly 
                style="width: 100%; min-height: 140px; padding: 16px; border: 2px solid #e2e8f0; 
                       border-radius: 8px; font-family: 'Georgia', serif; font-size: 15px; 
                       line-height: 1.6; margin: 20px 0; resize: vertical; background: white;">
${citation}
      </textarea>
      <div class="actions" style="display: flex; gap: 12px; margin-top: 15px;">
        <button class="copy-btn" id="copyButton" 
                style="flex: 1; padding: 14px; background: #4299e1; color: white; border: none; 
                       border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; 
                       align-items: center; justify-content: center; gap: 10px;">
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
        this.style.background = '#4299e1';
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
          <div style="font-weight: bold; color: #553c9a; margin-bottom: 20px; font-size:
