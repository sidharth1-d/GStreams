# GStreams

Static web player for browsing and streaming videos, images, and audio from Google Drive links directly in the browser.

## Usage
1. Share a Google Drive folder as **Anyone with the link (Viewer)**.
2. Paste the folder or file URL into GStreams.
3. Click any file to stream or view in-page.

Supports `?folder=<ID>` and `?file=<ID>` URL parameters for bookmarking.

## Deploy on GitHub Pages
1. Push `index.html`, `style.css`, and `app.js` to a GitHub repository.
2. Open **Settings → Pages**.
3. Set source to `main` branch, `/ (root)` folder, and save.

## Private Folders (Apps Script)
To list private folders without changing sharing permissions:

1. Create a new project at [script.google.com](https://script.google.com/) and paste:

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