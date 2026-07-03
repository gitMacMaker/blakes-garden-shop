export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ clientId: process.env.PAYPAL_CLIENT_ID });
}
