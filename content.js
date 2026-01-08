// content.js - Minimum working version
console.log('SmartCite content script loaded on:', window.location.href);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  if (request.action === 'generateCitation') {
    // Simple test response
    const testCitation = `"Test Page." ${document.title || 'Unknown'}. ${new Date().getFullYear()}. ${window.location.href}`;
    
    sendResponse({
      citation: testCitation,
      success: true
    });
  }
  
  return true; // Keep message channel open
});

// Also expose function globally for debugging
window.smartCiteTest = function() {
  return {
    title: document.title,
    url: window.location.href,
    ready: true
  };
};
