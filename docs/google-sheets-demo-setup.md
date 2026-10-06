# Connect demo requests to Google Sheets

1. Open the Google Sheet that should receive demo requests.
2. In the sheet, open **Extensions > Apps Script**.
3. Replace the editor contents with `scripts/google-sheets/Code.gs` and save. The script is already configured with this sheet's ID.
4. Choose **Deploy > New deployment**, select **Web app**, set **Execute as** to your account and access to **Anyone**, then deploy and authorize the requested permissions.
5. Copy the deployed web app URL. This is different from the spreadsheet URL. Keep it in project configuration; do not add credentials or service-account keys to the frontend.
6. Add `VITE_GOOGLE_SHEETS_WEB_APP_URL=<deployed-web-app-url>` to `.env.local` for local development. Add the same variable to the hosting provider's environment settings for production, then redeploy.

The script creates a `Demo-förfrågningar` tab on the first submission. It validates required fields and uses a hidden honeypot field as a basic spam check. The web app must accept requests from anyone, so this lightweight endpoint is suitable for low-volume demo leads; add CAPTCHA or a server-side proxy if it attracts spam.

The browser sends the form in `no-cors` mode because Apps Script web apps do not expose a normal CORS response to the site. The page can confirm that the request was sent, but cannot read back a server-side error response. Check the Apps Script execution log if a test submission does not appear in the sheet.