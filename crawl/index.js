const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_DOMAIN = "https://da.live";
const BASE_URL = "https://da.live/docs";
const OUTPUT_FILE = path.join(__dirname, 'data', 'da_live_docs.json');
const VISITED = new Set();  // To track visited URLs
const DOCS = [];  // To store scraped data

async function scrapePage(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Extract the page title
        const title = $('h1').first().text().trim() || "No Title";

        // Extract the main content
        const content = $('main').text().trim() || "No Content";

        // Extract all image URLs
        const images = [];
        $('img[src]').each((_, img) => {
            let imgUrl = $(img).attr('src');
            // Handle relative paths
            if (imgUrl.startsWith('/')) {
                imgUrl = BASE_URL + imgUrl;
            }
            images.push(imgUrl);
        });

        // Extract YouTube links and embedded videos
        const youtubeLinks = [];
        $('iframe[src]').each((_, iframe) => {
            const src = $(iframe).attr('src');
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
                youtubeLinks.push(src);
            }
        });

        // Extract YouTube links from regular anchor tags
        $('a[href]').each((_, a) => {
            const href = $(a).attr('href');
            if (href.includes('youtube.com') || href.includes('youtu.be')) {
                youtubeLinks.push(href);
            }
        });

        return { url, title, content, images, youtube_links: youtubeLinks };
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error.message);
        return null;
    }
}

async function findLinks(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const links = [];

        // Extract all anchor tags and filter for internal links
        $('a[href]').each((_, a) => {
            const href = $(a).attr('href');
            if (href.startsWith('/') && !VISITED.has(BASE_DOMAIN + href)) {  // Internal link
                links.push(BASE_DOMAIN + href);
            } else if (href.startsWith(BASE_URL) && !VISITED.has(href)) {  // Full URL within the site
                links.push(href);
            }
        });

        return links;
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error.message);
        return [];
    }
}

async function deepCrawl(url) {
    if (VISITED.has(url)) return;

    console.log(`Visiting: ${url}`);
    VISITED.add(url);

    // Scrape the page
    const pageData = await scrapePage(url);
    if (pageData) {
        DOCS.push(pageData);
    }

    // Find and visit all internal links
    const links = await findLinks(url);
    console.log(links);
    for (const link of links) {
        await new Promise(resolve => setTimeout(resolve, 1000));  // Be polite and avoid overwhelming the server
        await deepCrawl(link);
    }
}

async function startCrawl() {
    await deepCrawl(BASE_URL);
    console.log(`Scraped ${DOCS.length} pages.`);

    // Save the data to a JSON file
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(DOCS, null, 2));
    console.log(`Scraped data saved to ${OUTPUT_FILE}`);
}

startCrawl();
