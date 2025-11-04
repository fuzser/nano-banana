const apiKeyInput = document.getElementById('apiKey');
const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const resultsDiv = document.getElementById('results');
const previewDiv = document.getElementById('preview');
const promptInput = document.getElementById('prompt');
const chineseWarning = document.getElementById('chineseWarning');
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperatureValue');
const numImagesSelect = document.getElementById('numImages');
const aspectRatioSelect = document.getElementById('aspectRatio');

let uploadedBase64 = [];
let uploadedFiles = [];  // 保存已上传的文件，支持多次添加

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

// 随机度滑块实时更新
temperatureSlider.addEventListener('input', (e) => {
  temperatureValue.textContent = e.target.value;
});

// 上传图片 - 支持多次添加
imageInput.onchange = async () => {
  const files = imageInput.files;
  
  if (files.length === 0) return;

  // 检查总数量限制（已有 + 新增）
  if (uploadedFiles.length + files.length > 10) {
    alert(`⚠️ 最多只能添加 10 张图片\n当前已有 ${uploadedFiles.length} 张，只能再添加 ${10 - uploadedFiles.length} 张`);
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

    // 添加到已有列表（而不是替换）
    data.files.forEach(f => {
      uploadedBase64.push(f.base64);
      uploadedFiles.push(f);
    });
    
    // 更新预览显示
    updatePreview();
    
    // 清空文件选择器，以便下次可以选择相同文件
    imageInput.value = '';
    
    // 启用生成按钮
    generateBtn.disabled = false;
  } catch (error) {
    console.error('上传图片失败:', error);
    previewDiv.innerHTML = `<p style="color: #e74c3c; background: #fadbd8; padding: 12px; border-radius: 8px; border-left: 4px solid #e74c3c;">❌ 上传失败: ${error.message}</p>`;
    imageInput.value = '';
  }
};

// 更新预览显示
function updatePreview() {
  if (uploadedFiles.length === 0) {
    previewDiv.innerHTML = '';
    return;
  }

  previewDiv.innerHTML = `
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px;">
      ${uploadedFiles.map((f, index) => `
        <div style="position: relative; display: inline-block;">
          <img src="${f.url}" width="120" height="120" style="object-fit: cover; border-radius: 8px; border: 2px solid #3498db; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <button onclick="removeImage(${index})" style="position: absolute; top: -8px; right: -8px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-weight: bold; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">×</button>
          <div style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${index + 1}</div>
        </div>
      `).join('')}
    </div>
    <p style="margin: 0; color: #27ae60; font-size: 14px; font-weight: bold;">✅ 已添加 ${uploadedFiles.length} 张参考图片</p>
    <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 12px;">💡 提示: 可以继续点击"添加图片"按钮（最多10张）</p>
  `;
}

// 删除单张图片
window.removeImage = (index) => {
  uploadedBase64.splice(index, 1);
  uploadedFiles.splice(index, 1);
  
  if (uploadedFiles.length === 0) {
    previewDiv.innerHTML = '';
    generateBtn.disabled = false; // 允许纯文生图
  } else {
    updatePreview();
  }
};

// 生成图片 - 并发请求版本
generateBtn.onclick = async () => {
  const prompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const numImages = parseInt(numImagesSelect.value);
  const temperature = parseFloat(temperatureSlider.value);
  const aspectRatio = aspectRatioSelect.value;

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
  generateBtn.textContent = `生成 ${numImages} 张图片中...`;

  // 初始化结果容器
  const startTime = Date.now();
  let completedCount = 0;
  let successCount = 0;
  const allImages = [];
  
  resultsDiv.innerHTML = `
    <div style="margin-bottom: 20px; padding: 16px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: #1976d2;">🎨 正在并发生成 ${numImages} 张图片...</h3>
      <div style="position: relative; width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
        <div id="progressFill" style="position: absolute; left: 0; top: 0; width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease-out;"></div>
      </div>
      <p id="progressText" style="margin: 0; color: #1976d2; font-size: 14px; font-weight: 500;">已完成: 0/${numImages}</p>
      <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">💡 图片生成完成后会立即显示</p>
    </div>
    <div id="imageGrid" style="display: flex; flex-wrap: wrap; gap: 15px;"></div>
  `;

  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const imageGrid = document.getElementById('imageGrid');

  // 更新进度
  const updateProgress = () => {
    const progress = (completedCount / numImages) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `已完成: ${completedCount}/${numImages} (成功: ${successCount}，失败: ${completedCount - successCount})`;
  };

  // 添加单张图片到显示区域
  const addImageToGrid = (img, index) => {
    const imageCard = document.createElement('div');
    imageCard.style.cssText = 'position: relative; border: 2px solid #3498db; border-radius: 12px; padding: 8px; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: fadeIn 0.3s ease-out;';
    imageCard.innerHTML = `
      <div style="position: absolute; top: -10px; right: -10px; background: #27ae60; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        #${index + 1}
      </div>
      <img src="${img.url}" style="max-width: 400px; max-height: 400px; display: block; border-radius: 8px;">
      <div style="margin-top: 10px; display: flex; gap: 8px; justify-content: center;">
        <a href="${img.url}" target="_blank" rel="noopener noreferrer" style="padding: 8px 16px; background: #3498db; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">📥 新标签打开</a>
        <button onclick="copyBase64ForImage('${img.base64}')" style="padding: 8px 16px; background: #9b59b6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer;">📋 Base64</button>
      </div>
    `;
    imageGrid.appendChild(imageCard);
  };

  // 并发生成函数
  const generateSingle = async (index) => {
    try {
      const res = await fetch('http://localhost:3000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          apiKey,
          image_urls: uploadedBase64,
          temperature: temperature,
          aspectRatio: aspectRatio
        })
      });

      const data = await res.json();

      if (data.error) {
        console.error(`图片 #${index + 1} 生成失败:`, data.error);
        completedCount++;
        updateProgress();
        
        // 显示错误卡片
        const errorCard = document.createElement('div');
        errorCard.style.cssText = 'position: relative; border: 2px solid #e74c3c; border-radius: 12px; padding: 20px; background: #fadbd8; animation: fadeIn 0.3s ease-out; min-width: 200px;';
        errorCard.innerHTML = `
          <div style="position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
            #${index + 1}
          </div>
          <p style="margin: 0; color: #c0392b; font-weight: bold;">❌ 生成失败</p>
          <p style="margin: 5px 0 0 0; color: #c0392b; font-size: 12px;">${data.error.substring(0, 50)}...</p>
        `;
        imageGrid.appendChild(errorCard);
        return null;
      }

      if (data.data && data.data.length > 0) {
        const img = data.data[0]; // 单次请求只返回一张
        completedCount++;
        successCount++;
        allImages.push(img);
        updateProgress();
        addImageToGrid(img, index);
        return img;
      }

      return null;
    } catch (error) {
      console.error(`图片 #${index + 1} 请求异常:`, error);
      completedCount++;
      updateProgress();
      
      // 显示错误卡片
      const errorCard = document.createElement('div');
      errorCard.style.cssText = 'position: relative; border: 2px solid #e74c3c; border-radius: 12px; padding: 20px; background: #fadbd8; animation: fadeIn 0.3s ease-out; min-width: 200px;';
      errorCard.innerHTML = `
        <div style="position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
          #${index + 1}
        </div>
        <p style="margin: 0; color: #c0392b; font-weight: bold;">❌ 请求失败</p>
        <p style="margin: 5px 0 0 0; color: #c0392b; font-size: 12px;">${error.message}</p>
      `;
      imageGrid.appendChild(errorCard);
      return null;
    }
  };

  try {
    // 并发发送所有请求
    const promises = [];
    for (let i = 0; i < numImages; i++) {
      promises.push(generateSingle(i));
    }

    // 等待所有请求完成
    await Promise.all(promises);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // 更新最终状态
    const summaryDiv = resultsDiv.querySelector('div');
    if (successCount > 0) {
      summaryDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #27ae60;">✅ 生成完成！</h3>
        <p style="margin: 0; color: #16a085; font-size: 14px;">
          总耗时 ${duration} 秒 | 成功 ${successCount}/${numImages} 张 | 分辨率 ${aspectRatio} | 随机度 ${temperature}
        </p>
      `;
      summaryDiv.style.background = '#d5f4e6';
      summaryDiv.style.borderColor = '#27ae60';
    } else {
      summaryDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #e74c3c;">❌ 全部失败</h3>
        <p style="margin: 0; color: #c0392b; font-size: 14px;">
          所有图片生成均失败，请检查 API Key 和网络连接
        </p>
      `;
      summaryDiv.style.background = '#fadbd8';
      summaryDiv.style.borderColor = '#e74c3c';
    }

    // 保存成功的图片数据
    window.generatedImages = allImages;

  } catch (error) {
    console.error('批量生成异常:', error);
    resultsDiv.innerHTML = `
      <div style="background: #fadbd8; border-left: 4px solid #e74c3c; padding: 16px; border-radius: 8px; color: #c0392b;">
        <h3 style="margin: 0 0 10px 0;">❌ 生成失败</h3>
        <p style="margin: 0;">${error.message}</p>
      </div>
    `;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
  }
};

// 复制单个图片的 Base64（新方法）
window.copyBase64ForImage = (base64) => {
  navigator.clipboard.writeText(base64).then(() => {
    alert('✅ Base64 数据已复制到剪贴板！');
  }).catch(err => {
    console.error('复制失败:', err);
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