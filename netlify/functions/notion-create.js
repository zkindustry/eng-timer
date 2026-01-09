export const handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!NOTION_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing API Key" }) };
  }

  try {
    const { databaseId, properties } = JSON.parse(event.body || "{}");
    if (!databaseId || !properties) {
      return { statusCode: 400, body: JSON.stringify({ error: "databaseId and properties are required" }) };
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties
      })
    });

    const data = await res.json();
    return { statusCode: res.ok ? 200 : res.status, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
