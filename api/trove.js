export default async function handler(request, response) {
  const query = request.query.q;
  const workId = request.query.workId;
  const key = process.env.TROVE_API_KEY;

  if (!key) {
    response.status(500).json({ error: "Missing TROVE_API_KEY environment variable." });
    return;
  }

  if ((!query || typeof query !== "string") && (!workId || typeof workId !== "string")) {
    response.status(400).json({ error: "Missing q or workId query parameter." });
    return;
  }

  const troveUrl = workId
    ? new URL(`https://api.trove.nla.gov.au/v3/work/${encodeURIComponent(workId)}`)
    : new URL("https://api.trove.nla.gov.au/v3/result");
  if (workId) {
    troveUrl.searchParams.set("include", "holdings,links,versions");
    troveUrl.searchParams.set("reclevel", "full");
  } else {
    troveUrl.searchParams.set("q", query);
    troveUrl.searchParams.set("category", "book");
    troveUrl.searchParams.set("n", "12");
  }
  troveUrl.searchParams.set("encoding", "json");
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
