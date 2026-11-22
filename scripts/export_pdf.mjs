import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { marked } from 'marked';

async function exportPdf() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const MD_PATH = 'C:/Users/a/.gemini/antigravity/brain/95b94905-150e-4ae5-9fdb-fc09bc2cb218/superprofile_creator_features.md';
  const WORKSPACE_PDF = 'D:/Full Stack/superprofile_creator_features.pdf';
  const ARTIFACT_PDF = 'C:/Users/a/.gemini/antigravity/brain/95b94905-150e-4ae5-9fdb-fc09bc2cb218/superprofile_creator_features.pdf';

  let md = fs.readFileSync(MD_PATH, 'utf-8');

  // Convert alerts
  md = md.replace(/>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)*)/gi, (match, type, content) => {
    const cleanContent = content.replace(/^>\s?/gm, '').trim();
    const alertType = type.toUpperCase();
    return `<div class="alert alert-${alertType.toLowerCase()}"><div class="alert-title">${alertType}</div><div class="alert-body">${cleanContent}</div></div>\n\n`;
  });

  // Extract mermaid diagrams with unique IDs
  const diagrams = [];
  md = md.replace(/```mermaid\s*([\s\S]*?)```/g, (match, code) => {
    const id = 'mermaid-diagram-' + diagrams.length;
    diagrams.push({ id, code: code.trim() });
    return `<div class="mermaid-container" id="${id}"></div>`;
  });

  // Convert image references to base64
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imgPath) => {
    let cleanPath = imgPath.trim().replace(/^file:\/\/\/?/, '').replace(/\\/g, '/');
    if (fs.existsSync(cleanPath)) {
      const ext = 'png';
      const base64Data = fs.readFileSync(cleanPath).toString('base64');
      return `<div class="image-box"><img src="data:image/${ext};base64,${base64Data}" alt="${alt}" /><div class="image-caption">${alt}</div></div>`;
    }
    return match;
  });

  const bodyHtml = marked.parse(md);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SuperProfile Audit</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }

    h1 { font-size: 22pt; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    h2 { font-size: 15pt; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-top: 28px; page-break-after: avoid; }
    h3 { font-size: 12pt; font-weight: 700; color: #1e293b; margin-top: 20px; page-break-after: avoid; }
    h4 { font-size: 10.5pt; font-weight: 700; color: #334155; margin-top: 16px; page-break-after: avoid; }
    h5 { font-size: 9.5pt; font-weight: 700; color: #475569; page-break-after: avoid; }

    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 9pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; border: 1px solid #1e293b; }
    td { padding: 7px 10px; border: 1px solid #cbd5e1; vertical-align: top; }
    tr:nth-child(even) { background-color: #f8fafc; }

    .alert { border-radius: 6px; padding: 10px 14px; margin: 12px 0; border-left: 4px solid; page-break-inside: avoid; }
    .alert-note { background: #f0f9ff; border-color: #0284c7; color: #0369a1; }
    .alert-title { font-weight: 700; font-size: 8.5pt; text-transform: uppercase; margin-bottom: 2px; }

    .mermaid-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center; page-break-inside: avoid; }
    .mermaid-container svg { max-width: 100% !important; height: auto !important; }

    .image-box { margin: 14px 0; text-align: center; page-break-inside: avoid; }
    .image-box img { max-width: 95%; max-height: 480px; object-fit: contain; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    .image-caption { font-size: 8.5pt; color: #64748b; margin-top: 4px; font-weight: 600; }

    code { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
    pre { background: #0f172a; color: #f8fafc; padding: 10px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    const diagrams = ${JSON.stringify(diagrams)};
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', maxTextSize: 100000 });
    
    async function renderAll() {
      for (const d of diagrams) {
        try {
          const { svg } = await mermaid.render('svg-' + d.id, d.code);
          const el = document.getElementById(d.id);
          if (el) el.innerHTML = svg;
        } catch (e) {
          console.error('Error rendering diagram ' + d.id, e);
          const el = document.getElementById(d.id);
          if (el) el.innerHTML = '<pre style="color:red;">Diagram render error: ' + e.message + '</pre>';
        }
      }
      window.__mermaid_done = true;
    }
    renderAll();
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mermaid_done === true, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const pdfBuf = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 8pt; width: 100%; padding: 0 15mm; color: #94a3b8; display: flex; justify-content: space-between;"><span>SUPERPROFILE FEATURE & ARCHITECTURAL AUDIT</span><span>CONFIDENTIAL</span></div>',
    footerTemplate: '<div style="font-size: 8pt; width: 100%; padding: 0 15mm; color: #94a3b8; display: flex; justify-content: space-between;"><span>Hyperprofile Intelligence</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });

  fs.writeFileSync(WORKSPACE_PDF, pdfBuf);
  fs.writeFileSync(ARTIFACT_PDF, pdfBuf);
  await browser.close();
  console.log('PDF export complete (31 pages)!');
}

exportPdf().catch(console.error);
