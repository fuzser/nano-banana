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

// ==============================
// 路由
// ==============================

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
  const { prompt, image_urls = [], num_images = 1, apiKey } = req.body;
  
  console.log('📥 收到生成请求:', { 
    prompt_length: prompt?.length, 
    num_images: image_urls.length,
    has_api_key: !!apiKey
  });
  
  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ API Key 未提供');
    return res.status(400).json({ 
      error: '请输入 Google API Key',
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
      model: 'gemini-2.5-flash-image-preview',
      num_reference_images: image_urls.length,
      prompt_length: prompt.length,
      num_images: num_images
    });

    // Google Gemini API endpoint (Nano Banana 模型)
    // 注意：使用 preview 版本的模型名称
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
    
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
        
        // 检查是否有 finishReason 错误
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          const errorMessages = {
            'NO_IMAGE': '⚠️ AI 无法为此提示词生成图片。可能原因：\n- 提示词与参考图片不匹配\n- 描述的内容无法生成\n- 提示词过于复杂或模糊\n\n建议：\n- 简化提示词，使用更明确的描述\n- 确保提示词与参考图片相关\n- 尝试用英文描述',
            'SAFETY': '🚫 内容被安全过滤器拦截，请修改提示词',
            'RECITATION': '⚠️ 生成内容可能涉及版权问题',
            'MAX_TOKENS': '⚠️ Token 数量超限，请减少参考图片或简化提示词',
            'OTHER': '⚠️ 生成失败，请重试'
          };
          
          const errorMsg = errorMessages[candidate.finishReason] || errorMessages['OTHER'];
          console.log(`❌ 生成失败: ${candidate.finishReason}`);
          
          return res.status(400).json({ 
            error: errorMsg,
            finishReason: candidate.finishReason,
            hint: '💡 提示：尝试使用更简单、清晰的英文提示词，例如 "Add sunglasses" 或 "Change background to beach"'
          });
        }
        
        // 提取生成的图片（base64 格式）
        if (candidate.content && candidate.content.parts) {
          const imageParts = candidate.content.parts.filter(part => part.inlineData);
          
          if (imageParts.length > 0) {
            // 转换为统一的返回格式
            const images = imageParts.map((part, index) => {
              // 注意：这里是 inlineData 不是 inline_data
              const base64Data = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              
              // 保存到本地文件（可选）
              const ext = mimeType.split('/')[1]; // png 或 jpeg
              const filename = `generated_${Date.now()}_${index}.${ext}`;
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