# BOE to E-Way Bill Excel

Upload Courier BOE (CBE-XIII) PDFs and download your filled EWB Preparation Tool (.xlsm). The eWayBill sheet is filled; macros and buttons are untouched.

## Security design
- All processing happens in the browser; PDFs and the Excel never leave your device.
- No third-party scripts or CDN: pdf.js 3.11.174 and JSZip are bundled locally.
- Strict CSP, no framing, no referrer, noindex (`vercel.json`, `robots.txt`).
- Settings and consignee profile are stored only in browser localStorage; use "Clear saved data" to wipe them.

## Deploy (keep it private)
1. Create a **private** GitHub repo and push these files.
2. Import it in Vercel (Framework: Other, empty build command, output directory `.`).
3. Vercel project > Settings > Deployment Protection: turn on **Vercel Authentication** so only you can open it.
4. Enable 2FA on your GitHub account.

## Template
`template.xlsm` is the latest EWB Preparation Tool (EWB_Preparation_Tool_08122025.xlsm). Replace it with a newer template of the same layout if needed.

## JSON for the GST portal
"Download E-WayBill_JSON.json" writes the same JSON that the Excel "Prepare JSON" macro creates (version 1.0.0621, file name `E-WayBill_JSON.json`), so it can be uploaded to the e-way bill portal directly.
