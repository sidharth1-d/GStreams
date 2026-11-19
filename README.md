# DriveStream

A static, **zero-API-key** web app for GitHub Pages that lets you stream movies, view images, and browse subfolders straight from a Google Drive link—without downloading files to your phone.

## Features
- **Zero Setup for Public Folders:** Paste any Google Drive folder shared as *"Anyone with the link → Viewer"* and play immediately.
- **Adaptive Video Streaming:** Uses Google's server-side transcoded player (handles large MKV, MP4, HEVC files smoothly on mobile data), plus an optional raw HTML5 `<video>` toggle.
- **Subfolder Navigation, Search & Filters:** Filter by Videos, Images, Audio, Folders, or search by filename.
- **Built-in Fallback:** Automatically offers Google's Native Grid embed if public CORS relays are temporarily busy.
- **Bookmarkable & Saved Folders:** Saves recent folders in `localStorage` and supports shareable `?folder=FOLDER_ID` URLs.
- **Optional Private Folder Mode:** Unlock private Drive folders using a free 25-line Google Apps Script (no Google Cloud Console or API keys needed).

## Quick Deploy on GitHub Pages
The site entry point (`index.html`) is now at the repository root. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then click **Save**. Open the published site at `https://<your-username>.github.io/<repo-name>/`.

The app's CSS and JavaScript are loaded from `gdrive-stream/` so the existing files remain available while the root entry point serves the site.

---

## Optional Upgrade 1: Unlock Private Folders (Google Apps Script)
If you want to browse **private** folders (without making them public) or want 100% uptime without public CORS relays:

1. Open [script.google.com](https://script.google.com/) and create a **New Project**.
2. Paste the code below and click **Save**:

```javascript
function doGet(e) {
  try {
    var folderId = e.parameter.id;
    if (!folderId) throw new Error("Missing folder id");

    var folder = DriveApp.getFolderById(folderId);
    var items = [];

    var subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      var sf = subFolders.next();
      items.push({ id: sf.getId(), name: sf.getName(), isFolder: true, mimeType: "application/vnd.google-apps.folder", size: 0 });
    }

    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      items.push({ id: f.getId(), name: f.getName(), isFolder: false, mimeType: f.getMimeType(), size: f.getSize() });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ folderName: folder.getName(), items: items }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```
