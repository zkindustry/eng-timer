exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { databaseId, filter } = JSON.parse(event.body);
  const NOTION_API_KEY = process.env.NOTION_API_KEY;

  if (!NOTION_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing API Key" }) };

  try {
    const payload = { page_size: 100 };
    // 如果前端传了 filter（比如过滤掉已完成的任务），则透传给 Notion
    if (filter) payload.filter = filter;

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return { statusCode: response.ok ? 200 : response.status, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};