// Replace your current citation generation in content.js with this:
async function generateCitation(format) {
  try {
    // Get better metadata
    const title = document.title || 
                 document.querySelector('h1')?.textContent || 
                 'Unknown Title';
    
    const url = window.location.href;
    const year = new Date().getFullYear();
    
    // Try to find author
    let author = 'Unknown Author';
    const authorSelectors = [
      'meta[name="author"]',
      '[itemprop="author"]',
      '.author',
      '.byline',
      '[rel="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        author = element.content || element.textContent || 'Unknown Author';
        break;
      }
    }
    
    // Format based on style
    let citation;
    switch(format) {
      case 'apa':
        citation = `${author}. (${year}). ${title}. Retrieved from ${url}`;
        break;
      case 'mla':
        citation = `"${title}." ${document.domain || 'Website'}, ${year}, ${url}`;
        break;
      case 'chicago':
        citation = `${author}. "${title}." Last modified ${year}. ${url}`;
        break;
      default:
        citation = `${author}. "${title}." ${url}`;
    }
    
    return { citation: citation };
  } catch (error) {
    console.error('Citation error:', error);
    return { error: 'Failed to generate citation' };
  }
}
