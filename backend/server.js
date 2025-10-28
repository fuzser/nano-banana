const express = require('express');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// ==============================
// 中间件
app.use(cors());
// 提升 body-parser 限制，支持大文件 Base64（例如 4K 图）
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// 上传目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// Multer 配置
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 200 * 1024 * 1024 } // 单张最大 200MB
});

// API Key 文件
const API_KEY_FILE = path.join(__dirname, 'apikey.json');
function getApiKey() {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const data = fs.readFileSync(API_KEY_FILE, 'utf-8');
      // 检查文件是否为空
      if (!data || data.trim() === '') {
        return '';
      }
      const parsed = JSON.parse(data);
      return parsed.apiKey || '';
    }
  } catch (err) {
    console.error('读取 API Key 失败:', err.message);
    // 如果 JSON 解析失败，删除损坏的文件
    if (fs.existsSync(API_KEY_FILE)) {
      fs.unlinkSync(API_KEY_FILE);
    }
  }
  return '';
}
function saveApiKey(apiKey) {
  try {
    fs.writeFileSync(API_KEY_FILE, JSON.stringify({ apiKey }, null, 2));
    console.log('✅ API Key 已保存');
  } catch (err) {
    console.error('❌ 保存 API Key 失败:', err.message);
    throw err;
  }
}

// ==============================
// 路由
// ==============================

// 保存 API Key
app.post('/save-api-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API Key 不能为空' });
  saveApiKey(apiKey);
  res.json({ success: true });
});

// 上传图片并返回 Base64
app.post('/upload', upload.array('images', 10), (req, res) => {
  console.log('收到上传请求:', req.files);
  const files = req.files.map(f => {
    const base64 = fs.readFileSync(f.path, { encoding: 'base64' });
    // 返回 data URI 格式
    const dataUri = `data:${f.mimetype};base64,${base64}`;
    return {
      url: `http://localhost:3000/uploads/${f.filename}`, // 预览用
      base64: dataUri
    };
  });
  res.json({ files });
});

// Nano Banana 图生图（Google Gemini API）
app.post('/generate', async (req, res) => {
  const { prompt, image_urls = [], num_images = 1 } = req.body;
  
  console.log('📥 收到生成请求:', { 
    prompt_length: prompt?.length, 
    num_images: image_urls.length 
  });
  
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error('❌ API Key 未设置');
    return res.status(400).json({ 
      error: '未设置 API Key，请先在页面上保存 Google API Key',
      hint: '访问 https://aistudio.google.com/apikey 获取 API Key'
    });
  }
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt 不能为空' });
  }

  // Nano Banana 支持最多 10 张参考图
  if (image_urls.length > 10) {
    return res.status(400).json({ error: '最多支持 10 张参考图' });
  }

  try {
    // 构建 Gemini API 的 contents 格式
    const parts = [];
    
    // 添加参考图片（支持多张）
    if (image_urls && image_urls.length > 0) {
      for (const imageUrl of image_urls) {
        // 处理不同格式的图片输入
        if (imageUrl.startsWith('data:image/')) {
          // Base64 data URI 格式: data:image/jpeg;base64,xxxxx
          const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const mimeType = `image/${matches[1]}`;
            const base64Data = matches[2];
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          }
        } else if (imageUrl.startsWith('http')) {
          // URL 格式（需要先下载转成 base64）
          console.warn('警告: Gemini API 不直接支持 URL，建议先转换为 base64');
          // 这里可以添加下载逻辑，或者返回错误提示用户先转换
        } else {
          // 纯 base64 字符串，假设为 JPEG
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageUrl
            }
          });
        }
      }
      console.log(`✅ 已添加 ${parts.length} 张参考图片`);
    }
    
    // 添加文本提示词
    parts.push({
      text: prompt
    });

    // Gemini API 请求体
    const payload = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 1.0,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        // 指定返回图像模式（这是 gemini-2.5-flash-image 的关键配置）
        responseModalities: ["IMAGE"]
      }
    };

    console.log('调用 Nano Banana API 参数:', {
      model: 'gemini-2.5-flash-image',
      num_reference_images: image_urls.length,
      prompt_length: prompt.length,
      num_images: num_images
    });

    // Google Gemini API endpoint (Nano Banana 模型)
    // 注意：必须使用 gemini-2.5-flash-image 模型名称
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('HTTP status:', response.status);
    const text = await response.text();
    
    if (!response.ok) {
      console.error('API 错误响应:', text);
      return res.status(response.status).json({ 
        error: 'Nano Banana API 调用失败', 
        status: response.status,
        details: text,
        hint: response.status === 400 ? '请检查 API Key 是否有效，以及是否在 Google AI Studio 启用了计费' : ''
      });
    }

    if (!text) {
      return res.status(500).json({ error: 'Nano Banana API 返回空内容' });
    }

    try {
      const data = JSON.parse(text);
      
      // 打印完整响应结构用于调试
      console.log('📦 API 返回数据结构:', JSON.stringify(data, null, 2).substring(0, 1000));
      
      // Gemini API 返回格式处理
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        
        // 提取生成的图片（base64 格式）
        if (candidate.content && candidate.content.parts) {
          const imageParts = candidate.content.parts.filter(part => part.inline_data);
          
          if (imageParts.length > 0) {
            // 转换为统一的返回格式
            const images = imageParts.map((part, index) => {
              const base64Data = part.inline_data.data;
              const mimeType = part.inline_data.mime_type || 'image/jpeg';
              
              // 保存到本地文件（可选）
              const filename = `generated_${Date.now()}_${index}.jpg`;
              const filepath = path.join(uploadDir, filename);
              fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
              
              return {
                url: `http://localhost:3000/uploads/${filename}`,
                base64: `data:${mimeType};base64,${base64Data}`,
                revised_prompt: prompt // Nano Banana 不修改 prompt
              };
            });
            
            console.log(`✅ 成功生成 ${images.length} 张图片`);
            res.json({ data: images });
          } else {
            res.status(500).json({ 
              error: '未找到生成的图片数据',
              raw_response: data 
            });
          }
        } else {
          res.status(500).json({ 
            error: 'API 返回格式异常',
            raw_response: data 
          });
        }
      } else {
        res.status(500).json({ 
          error: 'API 未返回有效结果',
          raw_response: data 
        });
      }
      
    } catch (err) {
      console.error('JSON 解析失败:', err);
      res.status(500).json({ 
        error: 'API 返回格式解析失败', 
        details: text.substring(0, 1000) 
      });
    }

  } catch (err) {
    console.error('生成图片异常:', err);
    res.status(500).json({ 
      error: '生成图片失败', 
      details: err.message 
    });
  }
});

// ==============================
// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    api: 'Nano Banana (Google Gemini 2.5 Flash)',
    features: ['多参考图(最多10张)', 'Base64输入输出', '图像编辑']
  });
});

// ==============================
// 启动服务
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Nano Banana API Server running at http://localhost:${PORT}`);
  console.log(`📝 获取 API Key: https://aistudio.google.com/apikey`);
  console.log(`📚 API 文档: https://ai.google.dev/gemini-api/docs/image-generation`);
});