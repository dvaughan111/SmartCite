// SmartCite Content Script - Academic Citation Generator
console.log('SmartCite content script loaded on:', window.location.href);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  if (request.action === 'generateCitation') {
    console.log('Generating citation for format:', request.format);
    
    try {
      const format = request.format || 'mla';
      const title = document.title || 'Unknown Title';
      const url = window.location.href;
      const currentYear = new Date().getFullYear();
      const domain = document.domain || 'Website';
      
      let citation;
      
      switch(format) {
        case 'apa':
          // APA: No author -> Start with title
          citation = `${title}. (${currentYear}). Retrieved from ${url}`;
          break;
          
        case 'mla':
          // MLA: Already correct
          citation = `"${title}." ${domain}, ${currentYear}, ${url}.`;
          break;
          
        case 'chicago':
          // Chicago: Better date format, no "Unknown Author"
          const accessDate = new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
          citation = `"${title}." ${domain}. Accessed ${accessDate}. ${url}`;
          break;
          
        default:
          citation = `"${title}." ${url}`;
      }
      
      console.log('Generated citation:', citation);
      
      sendResponse({
        citation: citation,
        success: true,
        format: format
      });
      
    } catch (error) {
      console.error('Citation generation error:', error);
      sendResponse({
        error: 'Failed to generate citation. Please try again.',
        success: false
      });
    }
    
    return true; // Keep message channel open for async response
  }
});

// Test function for debugging
window.smartCiteTest = function() {
  return {
    title: document.title,
    url: window.location.href,
    domain: document.domain,
    ready: true,
    timestamp: new Date().toISOString(),
    testCitation: {
      apa: `${document.title}. (${new Date().getFullYear()}). Retrieved from ${window.location.href}`,
      mla: `"${document.title}." ${document.domain}, ${new Date().getFullYear()}, ${window.location.href}.`,
      chicago: `"${document.title}." ${document.domain}. Accessed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${window.location.href}`
    }
  };
};

console.log('SmartCite content script ready');
