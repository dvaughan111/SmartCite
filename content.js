// SmartCite Content Script
console.log('SmartCite content script loaded on:', window.location.href);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  if (request.action === 'generateCitation') {
    console.log('Generating citation for format:', request.format);
    
    try {
      // SIMPLE CITATION GENERATION THAT WORKS
      const format = request.format || 'mla';
      const title = document.title || 'Unknown Title';
      const url = window.location.href;
      const currentYear = new Date().getFullYear();
      
      let citation;
      
      switch(format) {
        case 'apa':
          citation = `Unknown Author. (${currentYear}). ${title}. Retrieved from ${url}`;
          break;
          
        case 'mla':
          citation = `"${title}." ${document.domain || 'Website'}, ${currentYear}, ${url}.`;
          break;
          
        case 'chicago':
          citation = `Unknown Author. "${title}." Accessed ${new Date().toLocaleDateString()}. ${url}`;
          break;
          
        default:
          citation = `Unknown Author. "${title}." ${url}`;
      }
      
      console.log('Generated citation:', citation);
      
      sendResponse({
        citation: citation,
        success: true
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
    timestamp: new Date().toISOString()
  };
};

console.log('SmartCite content script ready');
