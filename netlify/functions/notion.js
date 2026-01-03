// 这个文件是 Netlify Function，相当于一个微型后端
// 它负责持有密钥，替前端去向 Notion 要数据
// 解决了 CORS 问题和密钥安全问题

exports.handler = async function(event, context) {
  // 仅允许 POST 请求
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { databaseId } = JSON.parse(event.body);
  const NOTION_API_KEY = process.env.NOTION_API_KEY; // 从 Netlify 环境变量读取

  if (!NOTION_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server missing API Key" }) };
  }

  try {
    // 向 Notion 发起真实请求
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        page_size: 100 // 限制条数
        // 可以在这里加 filter
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    // 成功拿到数据，返回给前端
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};