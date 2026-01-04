exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  // 接收前端传来的：页面ID、属性名、增加的时间值
  const { pageId, property, value } = JSON.parse(event.body);
  const NOTION_API_KEY = process.env.NOTION_API_KEY;

  if (!NOTION_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing API Key" }) };

  try {
    // 1. 先读取当前值（为了做累加）
    const getPage = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${NOTION_API_KEY}`, 
        "Notion-Version": "2022-06-28" 
      }
    });
    const pageData = await getPage.json();
    
    // 获取旧值 (确保是 Number 类型，如果是空则为 0)
    const oldValue = pageData.properties[property]?.number || 0;
    const newValue = oldValue + value;

    // 2. 回写新值 (PATCH)
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