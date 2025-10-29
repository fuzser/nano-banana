const apiKeyInput = document.getElementById('apiKey');
const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const resultsDiv = document.getElementById('results');
const previewDiv = document.getElementById('preview');
const promptInput = document.getElementById('prompt');
const chineseWarning = document.getElementById('chineseWarning');

let uploadedBase64 = [];

// 显示加载状态
function showLoading(element, message = '处理中...') {
  element.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">
    <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <p style="margin-top: 10px;">${message}</p>
  </div>`;
}

// 添加旋转动画样式
if (!document.querySelector('#spinner-style')) {
  const style = document.createElement('style');
  style.id = 'spinner-style';
  style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

// 检测中文输入并显示警告
promptInput.addEventListener('input', () => {
  const text = promptInput.value;
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  
  if (hasChinese && chineseWarning) {
    chineseWarning.style.display = 'block';
  } else if (chineseWarning) {
    chineseWarning.style.display = 'none';
  }
  
  // 控制生成按钮状态
  generateBtn.disabled = text.trim().length === 0;
});

// 上传图片
imageInput.onchange = async () => {
  const files = imageInput.files;
  
  if (files.length === 0) {
    previewDiv.innerHTML = '';
    uploadedBase64 = [];
    return;
  }

  // 检查文件数量限制（Nano Banana 最多支持 10 张参考图）
  if (files.length > 10) {
    alert('⚠️ Nano Banana 最多支持 10 张参考图片\n当前选择了 ' + files.length + ' 张');
    imageInput.value = '';
    return;
  }

  // 检查文件类型和大小
  const maxSize = 20 * 1024 * 1024; // 20MB
  for (const file of files) {
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/i)) {
      alert('⚠️ 只支持 JPG、PNG 和 WebP 格式的图片');
      imageInput.value = '';
      return;
    }
    if (file.size > maxSize) {
      alert(`⚠️ 图片 "${file.name}" 超过 20MB 限制`);
      imageInput.value = '';
      return;
    }
  }

  showLoading(previewDiv, `上传 ${files.length} 张图片中...`);

  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }

  try {
    const res = await fetch('http://localhost:3000/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    uploadedBase64 = data.files.map(f => f.base64);
    
    // 显示预览图（优化后的样式）
    previewDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px;">
        ${data.files.map((f, index) => `
          <div style="position: relative; display: inline-block;">
            <img src="${f.url}" width="120" height="120" style="object-fit: cover; border-radius: 8px; border: 2px solid #3498db; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <button onclick="removeImage(${index})" style="position: absolute; top: -8px; right: -8px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-weight: bold; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">×</button>
            <div style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${index + 1}</div>
          </div>
        `).join('')}
      </div>
      <p style="margin: 0; color: #27ae60; font-size: 14px; font-weight: bold;">✅ 已上传 ${data.files.length} 张参考图片</p>
      <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 12px;">💡 提示: Nano Banana 会根据这些图片和文字描述生成新图像</p>
    `;
    
    // 启用生成按钮
    generateBtn.disabled = false;
  } catch (error) {
    console.error('上传图片失败:', error);
    previewDiv.innerHTML = `<p style="color: #e74c3c; background: #fadbd8; padding: 12px; border-radius: 8px; border-left: 4px solid #e74c3c;">❌ 上传失败: ${error.message}</p>`;
    uploadedBase64 = [];
    imageInput.value = '';
  }
};

// 删除单张图片
window.removeImage = (index) => {
  uploadedBase64.splice(index, 1);
  
  if (uploadedBase64.length === 0) {
    previewDiv.innerHTML = '';
    imageInput.value = '';
    generateBtn.disabled = false; // 允许纯文生图
  } else {
    // 重新渲染预览
    const dataTransfer = new DataTransfer();
    const currentFiles = Array.from(imageInput.files);
    currentFiles.splice(index, 1);
    currentFiles.forEach(file => dataTransfer.items.add(file));
    imageInput.files = dataTransfer.files;
    imageInput.dispatchEvent(new Event('change'));
  }
};

// 生成图片
generateBtn.onclick = async () => {
  const prompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  // 验证输入
  if (!apiKey) {
    alert('⚠️ 请输入 Google API Key\n\n访问 https://aistudio.google.com/apikey 获取');
    apiKeyInput.focus();
    return;
  }

  if (!prompt) {
    alert('⚠️ 请输入文字描述（英文效果更佳）');
    promptInput.focus();
    return;
  }

  if (prompt.length < 5) {
    alert('⚠️ 描述文字太短，请至少输入 5 个字符');
    return;
  }

  // 禁用按钮防止重复点击
  generateBtn.disabled = true;
  const originalText = generateBtn.textContent;
  generateBtn.textContent = '生成中...';

  // 显示生成进度
  showLoading(resultsDiv, '🎨 Nano Banana 生成中...<br><small style="color: #95a5a6;">平均需要 10-15 秒，请耐心等待</small>');

  const startTime = Date.now();

  try {
    const res = await fetch('http://localhost:3000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        apiKey,  // 直接传递 API Key
        image_urls: uploadedBase64
      })
    });

    const data = await res.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (data.error) {
      // 详细的错误提示
      let errorMsg = `❌ 生成失败: ${data.error}`;
      
      if (data.status === 400) {
        if (data.finishReason === 'NO_IMAGE') {
          errorMsg = `🤔 AI 无法为此提示词生成图片\n\n可能原因：\n`;
          errorMsg += `• 提示词与参考图片不匹配\n`;
          errorMsg += `• 描述的内容无法实现\n`;
          errorMsg += `• 提示词过于复杂或模糊\n\n`;
          errorMsg += `💡 建议：\n`;
          errorMsg += `• 使用简单明确的英文描述\n`;
          errorMsg += `• 例如："Add sunglasses", "Change to sunny beach"\n`;
          errorMsg += `• 确保提示词与上传的图片相关`;
        } else {
          errorMsg += '\n\n可能原因:\n';
          errorMsg += '• API Key 无效或未设置\n';
          errorMsg += '• 未在 Google AI Studio 启用计费\n';
          errorMsg += '• 输入格式不正确\n\n';
          errorMsg += '💡 请访问 https://aistudio.google.com/apikey 检查 API Key';
        }
      } else if (data.status === 429) {
        errorMsg += '\n\n⚠️ 请求过于频繁，请稍后再试';
      } else if (data.status === 500) {
        errorMsg += '\n\n⚠️ 服务器错误，请检查后端日志';
      }
      
      if (data.details) {
        console.error('详细错误:', data.details);
      }

      resultsDiv.innerHTML = `
        <div style="background: #fadbd8; border-left: 4px solid #e74c3c; padding: 16px; border-radius: 8px; color: #c0392b;">
          <h3 style="margin: 0 0 10px 0; color: #e74c3c;">❌ 生成失败</h3>
          <p style="margin: 0; white-space: pre-line;">${errorMsg}</p>
        </div>
      `;
      return;
    }

    if (data.data && data.data.length > 0) {
      resultsDiv.innerHTML = `
        <div style="margin-bottom: 15px; padding: 12px; background: #d5f4e6; border-left: 4px solid #27ae60; border-radius: 8px;">
          <h3 style="margin: 0 0 5px 0; color: #27ae60;">✅ 生成成功！</h3>
          <p style="margin: 0; color: #16a085; font-size: 14px;">耗时 ${duration} 秒 | 生成 ${data.data.length} 张图片</p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
          ${data.data.map((img, index) => `
            <div style="position: relative; border: 2px solid #3498db; border-radius: 12px; padding: 8px; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <img src="${img.url}" style="max-width: 400px; max-height: 400px; display: block; border-radius: 8px;">
              <div style="margin-top: 10px; display: flex; gap: 8px; justify-content: center;">
                <a href="${img.url}" download="nano_banana_${Date.now()}_${index}.jpg" style="padding: 8px 16px; background: #3498db; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">📥 下载</a>
                <button onclick="copyBase64(${index})" style="padding: 8px 16px; background: #9b59b6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer;">📋 复制Base64</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      // 保存 base64 数据供复制使用
      window.generatedImages = data.data;
    } else {
      resultsDiv.innerHTML = `
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 8px; color: #856404;">
          <h3 style="margin: 0 0 10px 0;">⚠️ 未返回图片</h3>
          <p style="margin: 0;">API 调用成功但未生成图片，请检查输入参数</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('生成图片异常:', error);
    resultsDiv.innerHTML = `
      <div style="background: #fadbd8; border-left: 4px solid #e74c3c; padding: 16px; border-radius: 8px; color: #c0392b;">
        <h3 style="margin: 0 0 10px 0;">❌ 请求失败</h3>
        <p style="margin: 0;">${error.message}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px;">💡 请确保后端服务正在运行 (http://localhost:3000)</p>
      </div>
    `;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
  }
};

// 复制 Base64 到剪贴板
window.copyBase64 = (index) => {
  if (!window.generatedImages || !window.generatedImages[index]) {
    alert('❌ 未找到图片数据');
    return;
  }
  
  const base64 = window.generatedImages[index].base64;
  
  navigator.clipboard.writeText(base64).then(() => {
    alert('✅ Base64 数据已复制到剪贴板！');
  }).catch(err => {
    console.error('复制失败:', err);
    // 降级方案：使用 textarea
    const textarea = document.createElement('textarea');
    textarea.value = base64;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('✅ Base64 数据已复制到剪贴板！');
  });
};

// 拖拽上传功能
const uploadArea = document.querySelector('.upload-area');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  uploadArea.addEventListener(eventName, () => {
    uploadArea.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  uploadArea.addEventListener(eventName, () => {
    uploadArea.classList.remove('drag-over');
  });
});

uploadArea.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 0) {
    imageInput.files = files;
    imageInput.dispatchEvent(new Event('change'));
  }
});

// 页面加载时的提示和初始化
window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Nano Banana Web UI 已加载');
  console.log('📝 获取 API Key: https://aistudio.google.com/apikey');
  console.log('📚 API 文档: https://ai.google.dev/gemini-api/docs/image-generation');
  
  // 初始化生成按钮状态
  promptInput.addEventListener('input', () => {
    generateBtn.disabled = promptInput.value.trim().length === 0;
  });
});