// SmartCite Content Script
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
      
      // Try to find author from common selectors
      let author = findAuthor();
      
      let citation;
      
      switch(format) {
        case 'apa':
          if (author) {
            citation = `${author}. (${currentYear}). ${title}. Retrieved from ${url}`;
          } else {
            citation = `${title}. (${currentYear}). Retrieved from ${url}`;
          }
          break;
          
        case 'mla':
          const mlaYear = currentYear;
          if (author) {
            citation = `${author}. "${title}." ${domain}, ${mlaYear}, ${url}.`;
          } else {
            citation = `"${title}." ${domain}, ${mlaYear}, ${url}.`;
          }
          break;
          
        case 'chicago':
          const accessDate = new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
          
          if (author) {
            citation = `${author}. "${title}." ${domain}. Accessed ${accessDate}. ${url}`;
          } else {
            citation = `"${title}." ${domain}. Accessed ${accessDate}. ${url}`;
          }
          break;
          
        default:
          citation = author ? `${author}. "${title}." ${url}` : `"${title}." ${url}`;
      }
      
      console.log('Generated citation:', citation);
      
      sendResponse({
        citation: citation,
        success: true,
        hasAuthor: !!author
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

// Function to find author from page
function findAuthor() {
  const authorSelectors = [
    // Meta tags
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[property="author"]',
    'meta[name="twitter:creator"]',
    
    // Schema.org
    '[itemprop="author"]',
    '[itemprop="creator"]',
    
    // Common CSS classes
    '.author',
    '.byline',
    '.article-author',
    '.post-author',
    '.contributor',
    
    // Rel attributes
    '[rel="author"]',
    
    // Text patterns (fallback)
    'a[href*="author"]',
    'a[href*="writer"]',
    'a[href*="contributor"]'
  ];
  
  // Try each selector
  for (const selector of authorSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        let authorText = '';
        
        // Get content from meta tags
        if (element.tagName === 'META' && element.content) {
          authorText = element.content.trim();
        } 
        // Get text from other elements
        else if (element.textContent) {
          authorText = element.textContent.trim();
        }
        
        // Clean up author text
        if (authorText) {
          // Remove common prefixes
          authorText = authorText.replace(/^by\s+/i, '');
          authorText = authorText.replace(/^written by\s+/i, '');
          authorText = authorText.replace(/^author:\s*/i, '');
          authorText = authorText.replace(/^contributor:\s*/i, '');
          
          // Remove dates and other cruft
          authorText = authorText.replace(/\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}$/, ''); // "7 January 2024"
          authorText = authorText.replace(/\s+\d{4}-\d{2}-\d{2}$/, ''); // "2024-01-07"
          
          // If we have a reasonable author name (2+ words or known format)
          if (authorText && authorText.length > 3 && !authorText.includes('http')) {
            console.log('Found author:', authorText);
            return authorText;
          }
        }
      }
    } catch (error) {
      console.log('Selector error:', selector, error);
      continue;
    }
  }
  
  // Fallback: Look for author in visible text patterns
  try {
    const bodyText = document.body.textContent || '';
    
    // Common author patterns in text
    const authorPatterns = [
      /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
      /author[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
      /written by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
    ];
    
    for (const pattern of authorPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        const foundAuthor = match[1].trim();
        if (foundAuthor.length > 3) {
          console.log('Found author via pattern:', foundAuthor);
          return foundAuthor;
        }
      }
    }
  } catch (error) {
    console.log('Pattern matching error:', error);
  }
  
  console.log('No author found');
  return null;
}

// Test function for debugging
window.smartCiteTest = function() {
  return {
    title: document.title,
    url: window.location.href,
    domain: document.domain,
    author: findAuthor(),
    ready: true,
    timestamp: new Date().toISOString()
  };
};

console.log('SmartCite content script ready');
