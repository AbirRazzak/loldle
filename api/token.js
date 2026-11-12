// Exchanges the code from discordSdk.commands.authorize() for an access token.
// Runs on Vercel so the client secret never reaches the browser.
export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));
  if (typeof code !== "string" || !/^[\w-]{10,100}$/.test(code)) {
    return Response.json({ error: "missing or malformed code" }, { status: 400 });
  }
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Discord token exchange failed", res.status, data.error);
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }
  return Response.json({ access_token: data.access_token });
}
