// This gets injected into pages
console.log('SmartCite loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateCitation') {
    generateCitation(request.format).then(sendResponse);
    return true; // Keep message channel open for async
  }
});

async function generateCitation(format) {
  try {
    // Get page metadata - MULTIPLE FALLBACKS (this is the secret sauce)
    const metadata = await extractMetadataWithFallbacks();
    
    if (!metadata.title) {
      return { error: 'Could not extract citation data. Try a different page or use manual entry.' };
    }
    
    // Format based on style
    const citation = formatCitation(metadata, format);
    
    return { citation };
  } catch (error) {
    console.error('Citation error:', error);
    return { error: 'Failed to generate citation. Please try again.' };
  }
}

async function extractMetadataWithFallbacks() {
  // Try 5 different methods in order
  const metadata = {};
  
  // Method 1: Check for DOI first (most reliable)
  const doi = extractDOI();
  if (doi) {
    const doiData = await fetchDOIData(doi);
    if (doiData) return doiData;
  }
  
  // Method 2: Check meta tags
  const metaTags = extractMetaTags();
  if (metaTags.title && metaTags.author) return metaTags;
  
  // Method 3: Check common academic patterns
  const academicData = extractAcademicPatterns();
  if (academicData.title) return academicData;
  
  // Method 4: Check page text patterns
  const pageData = extractFromPageText();
  if (pageData.title) return pageData;
  
  // Method 5: Fallback to URL/title
  return {
    title: document.title || window.location.href,
    url: window.location.href,
    accessedDate: new Date().toISOString().split('T')[0]
  };
}

function extractDOI() {
  // Look for DOI in URL, meta tags, or page content
  const doiPattern = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i;
  
  // Check URL
  const urlMatch = window.location.href.match(doiPattern);
  if (urlMatch) return urlMatch[1];
  
  // Check meta tags
  const metaDOI = document.querySelector('meta[name="citation_doi"], meta[name="DOI"]');
  if (metaDOI) return metaDOI.content;
  
  // Search page content
  const textMatch = document.body.textContent.match(doiPattern);
  if (textMatch) return textMatch[1];
  
  return null;
}

async function fetchDOIData(doi) {
  // Use free DOI API
  try {
    const response = await fetch(`https://doi.org/${doi}`, {
      headers: { 'Accept': 'application/vnd.citationstyles.csl+json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title,
        author: data.author?.map(a => `${a.family}, ${a.given}`).join(' & ') || 'Unknown',
        date: data.issued?.['date-parts']?.[0]?.join('-') || data.issued?.['literal'],
        journal: data['container-title'],
        url: data.URL || window.location.href
      };
    }
  } catch (error) {
    console.log('DOI fetch failed, using fallback');
  }
  return null;
}

function extractMetaTags() {
  // Look for academic metadata tags
  const getMeta = name => {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el ? el.content : null;
  };
  
  return {
    title: getMeta('citation_title') || getMeta('og:title') || document.title,
    author: getMeta('citation_author') || getMeta('author'),
    date: getMeta('citation_date') || getMeta('article:published_time'),
    journal: getMeta('citation_journal_title')
  };
}

function formatCitation(metadata, format) {
  const { title, author, date, journal, url } = metadata;
  const accessed = new Date().toLocaleDateString();
  
  switch(format) {
    case 'apa':
      return `${author || 'Unknown'} (${date || 'n.d.'}). ${title || 'Untitled'}. ${journal ? ` ${journal}.` : ''} Retrieved ${accessed} from ${url}`;
    
    case 'mla':
      return `"${title || 'Untitled'}." ${journal ? ` ${journal}, ` : ''}${author ? ` by ${author}, ` : ''}${date || 'n.d.'}. Web. ${accessed}.`;
    
    case 'chicago':
      return `${author || 'Unknown'}. "${title || 'Untitled'}." ${journal ? ` ${journal} ` : ''}${date ? ` (${date})` : ''}. Accessed ${accessed}. ${url}`;
    
    default:
      return `${author || 'Unknown'}. "${title || 'Untitled'}." ${url}`;
  }
}
