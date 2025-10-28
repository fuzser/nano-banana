const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveApiKeyBtn');
const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const resultsDiv = document.getElementById('results');
const previewDiv = document.getElementById('preview');

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

// 保存 API Key
saveBtn.onclick = async () => {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    alert('⚠️ API Key 不能为空');
    return;
  }

  // 禁用按钮防止重复点击
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    const res = await fetch('http://localhost:3000/save-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data.success) {
      alert('✅ API Key 已保存成功');
      // 可选：清空输入框或隐藏密钥
      // apiKeyInput.type = 'password';
    } else {
      alert('❌ 保存失败: ' + (data.message || '未知错误'));
    }
  } catch (error) {
    console.error('保存 API Key 失败:', error);
    alert('❌ 保存失败: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存 API Key';
  }
};

// 上传图片
imageInput.onchange = async () => {
  const files = imageInput.files;
  
  if (files.length === 0) {
    previewDiv.innerHTML = '';
    uploadedBase64 = [];
    return;
  }

  // 检查文件数量限制
  if (files.length > 10) {
    alert('⚠️ 最多只能上传 10 张图片');
    imageInput.value = '';
    return;
  }

  // 检查文件类型和大小
  const maxSize = 10 * 1024 * 1024; // 10MB
  for (const file of files) {
    if (!file.type.match(/image\/(jpeg|jpg|png)/i)) {
      alert('⚠️ 只支持 JPG 和 PNG 格式的图片');
      imageInput.value = '';
      return;
    }
    if (file.size > maxSize) {
      alert(`⚠️ 图片 "${file.name}" 超过 10MB 限制`);
      imageInput.value = '';
      return;
    }
  }

  showLoading(previewDiv, '上传图片中...');

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
    
    // 显示预览图
    previewDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        ${data.files.map((f, index) => `
          <div style="position: relative; display: inline-block;">
            <img src="${f.url}" width="100" height="100" style="object-fit: cover; border-radius: 8px; border: 2px solid #ddd;">
            <button onclick="removeImage(${index})" style="position: absolute; top: -8px; right: -8px; background: red; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">×</button>
          </div>
        `).join('')}
      </div>
      <p style="margin-top: 10px; color: #666; font-size: 14px;">已上传 ${data.files.length} 张图片</p>
    `;
  } catch (error) {
    console.error('上传图片失败:', error);
    previewDiv.innerHTML = `<p style="color: red;">❌ 上传失败: ${error.message}</p>`;
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
  const prompt = document.getElementById('prompt').value.trim();
  const size = document.getElementById('size').value;

  resultsDiv.innerHTML = '生成中...';

  const res = await fetch('http://localhost:3000/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt, 
      size, 
      image_urls: uploadedBase64  // 改为 image_urls,直接传 base64 数组
    })
  });

  const data = await res.json();
  if (data.error) {
    resultsDiv.innerHTML = '❌ 生成失败: ' + data.error;
    return;
  }

  if (data.data) {
    resultsDiv.innerHTML = data.data.map(img => `<img src="${img.url}" style="max-width:300px;margin:5px;">`).join('');
  } else {
    resultsDiv.innerHTML = '⚠️ 未返回图片';
  }
};