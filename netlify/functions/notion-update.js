export const handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { pageId, property, value } = JSON.parse(event.body);
  const NOTION_API_KEY = process.env.NOTION_API_KEY;

  if (!NOTION_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing API Key" }) };

  try {
    const getPage = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28"
      }
    });
    const pageData = await getPage.json();

    const oldValue = pageData.properties[property]?.number || 0;
    const newValue = oldValue + value;

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          [property]: { number: newValue }
        }
      })
    });

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      return { statusCode: updateRes.status, body: JSON.stringify(updateData) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, newValue }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};