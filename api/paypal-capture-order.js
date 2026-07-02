const WEBHOOK = 'https://discord.com/api/webhooks/1517706753012273175/tKMGvXo-M-ZoM7_gC3gGtF4wAMQMt-_oyqOCMlxz9N0gk4dCMDsB9dCOfSbaTwAU_YA6';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, item, qty, total, eldoradoUrl } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

  try {
    // Get access token
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials'
    });
    const { access_token } = await tokenRes.json();

    // Capture the order
    const captureRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' }
    });
    const capture = await captureRes.json();

    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed', status: capture.status });
    }

    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const paidAmount = captureUnit?.amount?.value;
    const transactionId = captureUnit?.id;

    // Verify amount matches
    const expectedAmount = parseFloat(total).toFixed(2);
    const actualAmount = parseFloat(paidAmount).toFixed(2);
    const mismatch = expectedAmount !== actualAmount;

    // Send Discord embed
    const embed = {
      color: mismatch ? 0xFF0000 : 0x52b788,
      title: mismatch ? '⚠️ AMOUNT MISMATCH — DO NOT FULFIL' : '✅ New Order — PayPal Verified',
      fields: [
        { name: 'Item', value: `\`${item}${qty > 1 ? ' x' + qty : ''}\``, inline: true },
        { name: 'Amount Paid', value: `\`$${actualAmount}\``, inline: true },
        { name: 'Payment', value: 'PayPal ✅', inline: true },
        { name: 'Transaction ID', value: `\`${transactionId}\``, inline: false },
        { name: 'Chat', value: '[Open in Crisp](https://app.crisp.chat/inbox/)', inline: true },
      ],
      footer: { text: "Blake's Game Store" },
      timestamp: new Date().toISOString()
    };

    if (mismatch) {
      embed.description = `Expected $${expectedAmount} but received $${actualAmount}.`;
      embed.fields.push({ name: 'Expected Amount', value: `\`$${expectedAmount}\``, inline: true });
    }

    if (eldoradoUrl) {
      embed.fields.push({ name: 'Eldorado', value: `[Check listing](${eldoradoUrl})`, inline: true });
    }

    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'BGS Notifier',
        avatar_url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f331.png',
        embeds: [embed]
      })
    });

    res.status(200).json({ success: true, transactionId, amount: actualAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
