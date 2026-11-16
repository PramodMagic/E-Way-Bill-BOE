# BOE to E-Way Bill JSON

Courier BOE (CBE-XIII) PDFs upload karo, e-way bill bulk-upload JSON download karo.

## Security design
- Sab processing browser mein; PDF aur Excel kisi server ko nahi jaate.
- Koi third-party script/CDN nahi: pdf.js 3.11.174 locally bundled (`pdf.min.js`, `pdf.worker.min.js`).
- Strict CSP, no framing, no referrer, noindex (`vercel.json`, `robots.txt`).
- Settings/consignee profile sirf browser localStorage mein; "Saved data hatao" button se clear.

## Deploy (private rakho)
1. GitHub par **private** repo banao, ye files push karo.
2. Vercel par import karo (Framework: Other, build command khali, output `.`).
3. Vercel project > Settings > Deployment Protection: **Vercel Authentication** (ya Password Protection) ON karo, taaki sirf aap khol sakein.
4. GitHub account par 2FA ON rakho.

## Output
Tool `template.xlsm` (aapka EWB Preparation Tool) ke eWayBill sheet mein rows bhar kar wahi .xlsm download karta hai. Macros/Validate/Prepare JSON buttons waise hi rahte hain.
`template.xlsm` ko apne latest template se replace kar sakte ho.
