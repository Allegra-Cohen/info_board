const { app, BrowserWindow, ipcMain, net, shell, session } = require('electron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let isGoogleAuthenticated = false;
let isSlackAuthenticated = false;

const isDev = !app.isPackaged;

// Fetch URL metadata (title, description, image)
async function fetchUrlMetadata(url) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get cookies for this URL to enable authenticated requests
      let cookieHeader = '';
      try {
        const cookies = await session.defaultSession.cookies.get({ url });
        if (cookies.length > 0) {
          cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }
      } catch (e) {
        // Ignore cookie errors
      }

      const request = net.request({
        url,
        method: 'GET',
        useSessionCookies: true,
        partition: null, // Use default session
      });

      request.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      request.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
      if (cookieHeader) {
        request.setHeader('Cookie', cookieHeader);
      }

      let body = '';
      let resolved = false;

      // Timeout after 8 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          resolve({ title: null, description: null, image: null });
        }
      }, 8000);

      request.on('response', (response) => {
        // Handle content-type which can be string or array
        let contentType = response.headers['content-type'];
        if (Array.isArray(contentType)) {
          contentType = contentType[0] || '';
        }
        contentType = contentType || '';

        // Only process HTML responses
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          clearTimeout(timeout);
          resolved = true;
          resolve({ title: null, description: null, image: null });
          return;
        }

        response.on('data', (chunk) => {
          body += chunk.toString();
          // Stop after we have enough data (head section is usually in first 50KB)
          if (body.length > 50000 && !resolved) {
            clearTimeout(timeout);
            resolved = true;
            request.abort();
            resolve(parseMetadata(body, url));
          }
        });

        response.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            resolve(parseMetadata(body, url));
          }
        });
      });

      request.on('error', (error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          console.error('Fetch error:', error.message);
          resolve({ title: null, description: null, image: null });
        }
      });

      request.end();
    } catch (error) {
      console.error('Request error:', error);
      resolve({ title: null, description: null, image: null });
    }
  });
}

function parseMetadata(html, baseUrl) {
  const result = { title: null, description: null, image: null };

  try {
    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = decodeHtmlEntities(titleMatch[1].trim());
    }

    // Extract Open Graph tags (preferred)
    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDesc = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');

    // Extract Twitter cards as fallback
    const twitterTitle = extractMetaContent(html, 'twitter:title');
    const twitterDesc = extractMetaContent(html, 'twitter:description');
    const twitterImage = extractMetaContent(html, 'twitter:image');

    // Extract standard meta description
    const metaDesc = extractMetaContent(html, 'description', 'name');

    // Use best available
    result.title = ogTitle || twitterTitle || result.title;
    result.description = ogDesc || twitterDesc || metaDesc;
    result.image = ogImage || twitterImage;

    // Make image URL absolute if relative
    if (result.image && !result.image.startsWith('http')) {
      try {
        result.image = new URL(result.image, baseUrl).href;
      } catch (e) {
        result.image = null;
      }
    }

    // Truncate description if too long
    if (result.description && result.description.length > 300) {
      result.description = result.description.substring(0, 297) + '...';
    }
  } catch (error) {
    console.error('Parse error:', error);
  }

  return result;
}

function extractMetaContent(html, property, attr = 'property') {
  // Match both property="og:title" and name="description" patterns
  const patterns = [
    new RegExp(`<meta[^>]*${attr}=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${property}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8f7f4',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

// Data persistence
const getDataPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'board-data.json');
};

const getArchivePath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'archive-data.json');
};

ipcMain.handle('load-data', async () => {
  try {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
    }
    return { cards: [] };
  } catch (error) {
    console.error('Error loading data:', error);
    return { cards: [] };
  }
});

ipcMain.handle('save-data', async (event, data) => {
  try {
    const dataPath = getDataPath();
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-archive', async () => {
  try {
    const archivePath = getArchivePath();
    if (fs.existsSync(archivePath)) {
      const data = fs.readFileSync(archivePath, 'utf-8');
      return JSON.parse(data);
    }
    return { version: 1, events: [] };
  } catch (error) {
    console.error('Error loading archive:', error);
    return { version: 1, events: [] };
  }
});

ipcMain.handle('save-archive', async (event, data) => {
  try {
    const archivePath = getArchivePath();
    fs.writeFileSync(archivePath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving archive:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-url-metadata', async (event, url) => {
  try {
    return await fetchUrlMetadata(url);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return { title: null, description: null, image: null };
  }
});

ipcMain.handle('open-url-in-safari', async (event, url) => {
  try {
    if (process.platform === 'darwin') {
      // Open in Safari on Mac
      execSync(`open -a Safari "${url.replace(/"/g, '\\"')}"`);
    } else {
      // Fallback to default browser on other platforms
      shell.openExternal(url);
    }
    return { success: true };
  } catch (error) {
    console.error('Error opening URL:', error);
    // Fallback to default browser
    shell.openExternal(url);
    return { success: true };
  }
});

// Google authentication via popup window
ipcMain.handle('google-sign-in', async () => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load Google sign-in page
    authWindow.loadURL('https://accounts.google.com/');

    let resolved = false;

    // Check for successful login by looking at cookies periodically
    const checkAuth = async () => {
      if (resolved) return;
      try {
        const cookies = await session.defaultSession.cookies.get({ domain: '.google.com' });
        const hasAuthCookies = cookies.some(c => c.name === 'SID' || c.name === 'HSID');
        if (hasAuthCookies) {
          resolved = true;
          isGoogleAuthenticated = true;
          authWindow.close();
          resolve({ success: true, message: 'Signed in to Google' });
        }
      } catch (e) {
        // Ignore errors
      }
    };

    // Check auth status every 2 seconds
    const interval = setInterval(checkAuth, 2000);

    // Also check on navigation
    authWindow.webContents.on('did-finish-load', () => {
      setTimeout(checkAuth, 500);
    });

    // Handle window close
    authWindow.on('closed', () => {
      clearInterval(interval);
      if (!resolved) {
        // Do one final check
        session.defaultSession.cookies.get({ domain: '.google.com' }).then(cookies => {
          const hasAuthCookies = cookies.some(c => c.name === 'SID' || c.name === 'HSID');
          isGoogleAuthenticated = hasAuthCookies;
          resolve({ success: hasAuthCookies, message: hasAuthCookies ? 'Signed in' : 'Sign-in cancelled' });
        }).catch(() => {
          resolve({ success: false, message: 'Sign-in cancelled' });
        });
      }
    });
  });
});

ipcMain.handle('check-google-auth', async () => {
  // Check if we have Google cookies
  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.google.com' });
    const hasAuthCookies = cookies.some(c => c.name === 'SID' || c.name === 'HSID');
    isGoogleAuthenticated = hasAuthCookies;
    return { authenticated: hasAuthCookies };
  } catch (error) {
    return { authenticated: false };
  }
});

ipcMain.handle('google-sign-out', async () => {
  try {
    // Clear Google cookies
    const cookies = await session.defaultSession.cookies.get({ domain: '.google.com' });
    for (const cookie of cookies) {
      const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
      await session.defaultSession.cookies.remove(url, cookie.name);
    }
    isGoogleAuthenticated = false;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false };
  }
});

// Slack authentication via popup window
ipcMain.handle('slack-sign-in', async () => {
  return new Promise((resolve) => {
    // Create a separate session for Slack to avoid Electron detection
    const slackSession = session.fromPartition('persist:slack');

    // Set a real Chrome user agent on the session
    slackSession.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const authWindow = new BrowserWindow({
      width: 600,
      height: 750,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: slackSession,
        preload: path.join(__dirname, 'slack-preload.js'),
      },
    });

    // Load Slack sign-in page
    authWindow.loadURL('https://slack.com/signin');

    let resolved = false;

    // Check for successful login by looking at cookies
    const checkAuth = async () => {
      if (resolved) return;
      try {
        const cookies = await slackSession.cookies.get({ domain: '.slack.com' });
        // Slack uses 'd' cookie for authentication
        const hasAuthCookies = cookies.some(c => c.name === 'd' || c.name === 'd-s');
        if (hasAuthCookies) {
          resolved = true;
          isSlackAuthenticated = true;
          authWindow.close();
          resolve({ success: true, message: 'Signed in to Slack' });
        }
      } catch (e) {
        // Ignore errors
      }
    };

    const interval = setInterval(checkAuth, 2000);

    authWindow.webContents.on('did-finish-load', () => {
      setTimeout(checkAuth, 500);
    });

    authWindow.on('closed', () => {
      clearInterval(interval);
      if (!resolved) {
        slackSession.cookies.get({ domain: '.slack.com' }).then(cookies => {
          const hasAuthCookies = cookies.some(c => c.name === 'd' || c.name === 'd-s');
          isSlackAuthenticated = hasAuthCookies;
          resolve({ success: hasAuthCookies, message: hasAuthCookies ? 'Signed in' : 'Sign-in cancelled' });
        }).catch(() => {
          resolve({ success: false, message: 'Sign-in cancelled' });
        });
      }
    });
  });
});

// Helper to get Slack session
const getSlackSession = () => session.fromPartition('persist:slack');

ipcMain.handle('check-slack-auth', async () => {
  try {
    const slackSession = getSlackSession();
    const cookies = await slackSession.cookies.get({ domain: '.slack.com' });
    const hasAuthCookies = cookies.some(c => c.name === 'd' || c.name === 'd-s');
    isSlackAuthenticated = hasAuthCookies;
    return { authenticated: hasAuthCookies };
  } catch (error) {
    return { authenticated: false };
  }
});

ipcMain.handle('slack-sign-out', async () => {
  try {
    const slackSession = getSlackSession();
    const cookies = await slackSession.cookies.get({ domain: '.slack.com' });
    for (const cookie of cookies) {
      const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
      await slackSession.cookies.remove(url, cookie.name);
    }
    isSlackAuthenticated = false;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
