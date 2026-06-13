export default async function handler(request, response) {
  const query = request.query.q;
  const key = process.env.TROVE_API_KEY;

  if (!key) {
    response.status(500).json({ error: "Missing TROVE_API_KEY environment variable." });
    return;
  }

  if (!query || typeof query !== "string") {
    response.status(400).json({ error: "Missing q query parameter." });
    return;
  }

  const troveUrl = new URL("https://api.trove.nla.gov.au/v3/result");
  troveUrl.searchParams.set("q", query);
  troveUrl.searchParams.set("category", "book");
  troveUrl.searchParams.set("encoding", "json");
  troveUrl.searchParams.set("n", "5");
  troveUrl.searchParams.set("key", key);

  try {
    const troveResponse = await fetch(troveUrl);
    const payload = await troveResponse.text();
    response
      .status(troveResponse.status)
      .setHeader("content-type", troveResponse.headers.get("content-type") || "application/json")
      .send(payload);
  } catch {
    response.status(502).json({ error: "Trove request failed." });
  }
}
