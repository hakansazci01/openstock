export const BOT_SIGNAL_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Signal Alert - OpenStock</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #050505; color: #ccdadc; }
        .container { max-width: 600px; margin: 40px auto; background-color: #141414; border-radius: 8px; padding: 30px; border: 1px solid #30333A; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
        .header p { color: #9ca3af; font-size: 14px; margin: 5px 0 0 0; }
        .signal-box { text-align: center; padding: 30px 20px; background-color: #050505; border-radius: 8px; margin-bottom: 30px; border: 1px solid #30333A; }
        .signal-type { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 10px; }
        .signal-value { font-size: 32px; font-weight: 700; margin: 0; }
        .detail { margin-bottom: 20px; }
        .detail-label { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .detail-value { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #30333A; color: #9ca3af; font-size: 14px; }
        .footer a { color: #7c3aed; text-decoration: none; }
        .btn { display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 500; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="width: 48px; height: 48px; background-color: #7c3aed; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
            <h1>🔔 Trading Signal Alert</h1>
            <p>OpenStock Trading Bot</p>
        </div>
        <div class="signal-box">
            <p class="signal-type">Signal Type</p>
            <h2 style="margin: 0; color: {{signalColor}};">{{signal}}</h2>
        </div>
        <div class="detail">
            <p class="detail-label">Symbol</p>
            <p class="detail-value">{{symbol}}</p>
        </div>
        <div class="detail">
            <p class="detail-label">Current Price</p>
            <p class="detail-value">{{currentPrice}}</p>
        </div>
        <div class="detail">
            <p class="detail-label">Reason</p>
            <p class="detail-value">{{reason}}</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <p class="detail-label" style="font-size: 12px;">Confidence: {{confidence}}%</p>
            <p class="detail-label" style="font-size: 12px;">Strategy: {{strategy}} | Time: {{timestamp}}</p>
        </div>
        <a href="{{dashboardUrl}}" class="btn">View Bot Dashboard</a>
    </div>
</body>
</html>`;