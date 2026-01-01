// api/notion.js
export default async function handler(req, res) {
  // 1. 安全检查：确保只有您的前端能调用（可选，简单场景可跳过）
  
  // 2. 获取环境变量中的密钥
  const NOTION_KEY = process.env.NOTION_API_KEY;
  const NOTION_DB_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_KEY || !NOTION_DB_ID) {
    return res.status(500).json({ error: 'Missing Notion secrets' });
  }

  try {
    // 3. 向 Notion 发起真实请求
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 这里可以加筛选条件，比如只同步 "进行中" 的项目
        // filter: { property: "Status", status: { equals: "Active" } } 
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Notion API error');
    }

    // 4. 清洗数据：只返回前端需要的字段
    const projects = data.results.map(page => {
      // 获取标题，Notion 的数据结构比较深，需要层层解析
      const titleProp = page.properties.Name || page.properties.title || page.properties['项目名称'];
      const title = titleProp?.title?.[0]?.plain_text || '未命名项目';
      
      return {
        name: title,
        notionId: page.id,
        // 您可以根据 Notion 的 Tags 设置颜色，这里先随机或默认
        color: 'blue' 
      };
    });

    // 5. 返回给前端
    return res.status(200).json({ projects });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
