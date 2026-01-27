// 背景管理器 - 支持多张图片轮播
class BackgroundManager {
    constructor() {
        this.storageKey = 'customBackgroundImages';
        this.intervalKey = 'backgroundInterval';
        this.maxImages = 10;
        this.currentIndex = 0;
        this.images = [];
        this.intervalId = null;
        this.defaultInterval = 5000; // 默认5秒切换一次
        this.init();
    }

    init() {
        // 检查当前页面是否是 dashboard
        this.isDashboard = window.location.pathname.includes('dashboard.html') || 
                          window.location.pathname === '/' ||
                          window.location.pathname === '/dashboard.html';
        
        // 加载保存的背景图片
        this.loadBackgrounds();
        // 开始轮播
        this.startSlideshow();
    }

    // 加载保存的背景图片
    loadBackgrounds() {
        const savedImages = localStorage.getItem(this.storageKey);
        if (savedImages) {
            try {
                this.images = JSON.parse(savedImages);
                // 只在 dashboard 页面应用背景
                if (this.images.length > 0 && this.isDashboard) {
                    this.applyBackground(this.images[0]);
                }
            } catch (e) {
                console.error('加载背景图片失败:', e);
                this.images = [];
            }
        }
    }

    // 保存背景图片数组
    saveBackgrounds() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.images));
    }

    // 获取轮播间隔
    getInterval() {
        const savedInterval = localStorage.getItem(this.intervalKey);
        return savedInterval ? parseInt(savedInterval) : this.defaultInterval;
    }

    // 设置轮播间隔
    setInterval(seconds) {
        localStorage.setItem(this.intervalKey, seconds.toString());
        this.restartSlideshow();
    }

    // 应用背景图片
    applyBackground(imageData) {
        // 只在 dashboard 页面应用背景
        if (!this.isDashboard) {
            return;
        }

        // 查找或创建背景显示区域
        let backgroundArea = document.getElementById('backgroundDisplayArea');
        if (!backgroundArea) {
            // 如果不存在，创建背景显示区域
            backgroundArea = document.createElement('div');
            backgroundArea.id = 'backgroundDisplayArea';
            backgroundArea.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 40vh;
                z-index: 0;
                pointer-events: none;
                overflow: hidden;
            `;
            // 插入到 body 最前面
            const contentWrapper = document.querySelector('.content-wrapper');
            if (contentWrapper) {
                document.body.insertBefore(backgroundArea, contentWrapper);
            } else {
                document.body.insertBefore(backgroundArea, document.body.firstChild);
            }
        }

        // 应用图片背景，添加淡入淡出效果
        backgroundArea.style.transition = 'background-image 1s ease-in-out';
        backgroundArea.style.backgroundImage = `url(${imageData})`;
        backgroundArea.style.backgroundSize = 'cover';
        backgroundArea.style.backgroundPosition = 'center';
        backgroundArea.style.backgroundRepeat = 'no-repeat';
        backgroundArea.style.display = 'block';
    }

    // 开始轮播
    startSlideshow() {
        // 清除之前的定时器
        this.stopSlideshow();
        
        // 只在 dashboard 页面且有多张图片时轮播
        if (!this.isDashboard || this.images.length <= 1) {
            return;
        }

        const interval = this.getInterval();
        this.intervalId = setInterval(() => {
            this.nextBackground();
        }, interval);
    }

    // 停止轮播
    stopSlideshow() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // 重启轮播
    restartSlideshow() {
        this.stopSlideshow();
        this.startSlideshow();
    }

    // 切换到下一张背景
    nextBackground() {
        if (this.images.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.applyBackground(this.images[this.currentIndex]);
    }

    // 切换到上一张背景
    prevBackground() {
        if (this.images.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.applyBackground(this.images[this.currentIndex]);
    }

    // 重置为默认渐变背景
    resetBackground() {
        this.stopSlideshow();
        
        // 移除背景显示区域
        const backgroundArea = document.getElementById('backgroundDisplayArea');
        if (backgroundArea) {
            backgroundArea.style.display = 'none';
            backgroundArea.style.backgroundImage = '';
        }
        
        this.images = [];
        this.currentIndex = 0;
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.intervalKey);
    }

    // 添加背景图片
    addBackground(imageData) {
        if (this.images.length >= this.maxImages) {
            throw new Error(`最多只能上传 ${this.maxImages} 张图片`);
        }
        this.images.push(imageData);
        this.saveBackgrounds();
        // 如果是第一张图片，立即应用（只在 dashboard 页面）
        if (this.images.length === 1 && this.isDashboard) {
            this.applyBackground(imageData);
        }
        // 如果有多张图片，开始轮播
        if (this.images.length > 1) {
            this.startSlideshow();
        }
    }

    // 删除背景图片
    removeBackground(index) {
        if (index >= 0 && index < this.images.length) {
            this.images.splice(index, 1);
            this.saveBackgrounds();
            
            // 调整当前索引
            if (this.currentIndex >= this.images.length) {
                this.currentIndex = 0;
            }
            
            // 如果还有图片，应用当前图片
            if (this.images.length > 0) {
                this.applyBackground(this.images[this.currentIndex]);
            } else {
                // 没有图片了，恢复默认背景
                this.resetBackground();
            }
            
            // 重新开始轮播
            this.restartSlideshow();
        }
    }

    // 上传并添加背景图片
    uploadBackground(file) {
        return new Promise((resolve, reject) => {
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                reject(new Error('请选择图片文件'));
                return;
            }

            // 验证文件大小（限制为 5MB）
            if (file.size > 5 * 1024 * 1024) {
                reject(new Error('图片大小不能超过 5MB'));
                return;
            }

            // 检查是否已达到最大数量
            if (this.images.length >= this.maxImages) {
                reject(new Error(`最多只能上传 ${this.maxImages} 张图片`));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                const imageData = e.target.result;
                try {
                    this.addBackground(imageData);
                    resolve(imageData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('读取图片失败'));
            };

            reader.readAsDataURL(file);
        });
    }

    // 预览图片
    previewImage(file, previewElement) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                previewElement.src = e.target.result;
                previewElement.style.display = 'block';
                resolve(e.target.result);
            };

            reader.onerror = () => {
                reject(new Error('预览图片失败'));
            };

            reader.readAsDataURL(file);
        });
    }

    // 获取所有图片
    getImages() {
        return [...this.images];
    }

    // 获取当前图片数量
    getImageCount() {
        return this.images.length;
    }
}

// 创建全局实例
const backgroundManager = new BackgroundManager();

// 显示背景设置模态框
function showBackgroundSettings() {
    const modal = document.getElementById('backgroundSettingsModal');
    if (modal) {
        modal.classList.remove('hidden');
        // 重置表单
        const form = document.getElementById('backgroundUploadForm');
        if (form) form.reset();
        // 清空预览容器
        const previewContainer = document.getElementById('backgroundPreviewContainer');
        if (previewContainer) previewContainer.innerHTML = '';
        // 隐藏消息
        const errorDiv = document.getElementById('backgroundError');
        const successDiv = document.getElementById('backgroundSuccess');
        if (errorDiv) errorDiv.classList.add('hidden');
        if (successDiv) successDiv.classList.add('hidden');
        // 刷新图片列表
        refreshImageList();
        // 更新轮播间隔显示
        updateIntervalDisplay();
    }
}

// 关闭背景设置模态框
function closeBackgroundSettings() {
    const modal = document.getElementById('backgroundSettingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 刷新图片列表
function refreshImageList() {
    const imageList = document.getElementById('backgroundImageList');
    if (!imageList) return;

    const images = backgroundManager.getImages();
    const count = backgroundManager.getImageCount();

    // 更新计数显示
    const countDisplay = document.getElementById('imageCount');
    if (countDisplay) {
        countDisplay.textContent = `${count} / ${backgroundManager.maxImages}`;
    }

    if (images.length === 0) {
        imageList.innerHTML = '<div class="text-center py-8 text-white/60">暂无背景图片，请上传</div>';
        return;
    }

    // 渲染图片列表
    imageList.innerHTML = images.map((img, index) => `
        <div class="relative group bg-white/10 rounded-lg overflow-hidden border border-white/20">
            <img src="${img}" alt="背景 ${index + 1}" class="w-full h-24 object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onclick="removeBackgroundImage(${index})" 
                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                    删除
                </button>
            </div>
            <div class="absolute top-1 left-1 bg-black/50 text-white text-xs px-2 py-1 rounded">
                ${index + 1}
            </div>
        </div>
    `).join('');
}

// 更新轮播间隔显示
function updateIntervalDisplay() {
    const intervalDisplay = document.getElementById('intervalDisplay');
    const intervalInput = document.getElementById('intervalInput');
    if (intervalDisplay && intervalInput) {
        const interval = backgroundManager.getInterval();
        intervalDisplay.textContent = `${interval / 1000} 秒`;
        intervalInput.value = interval / 1000;
    }
}

// 处理背景图片上传
function handleBackgroundUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('backgroundImageInput');
    const errorDiv = document.getElementById('backgroundError');
    const successDiv = document.getElementById('backgroundSuccess');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if (errorDiv) {
            errorDiv.textContent = '请选择至少一张图片';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    // 隐藏之前的消息
    if (errorDiv) errorDiv.classList.add('hidden');
    if (successDiv) successDiv.classList.add('hidden');

    // 处理多文件上传
    const files = Array.from(fileInput.files);
    const maxFiles = backgroundManager.maxImages - backgroundManager.getImageCount();
    
    if (files.length > maxFiles) {
        if (errorDiv) {
            errorDiv.textContent = `最多只能再上传 ${maxFiles} 张图片`;
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    // 逐个上传文件
    let uploadCount = 0;
    let errorCount = 0;
    const errors = [];

    files.forEach((file, index) => {
        backgroundManager.uploadBackground(file)
            .then(() => {
                uploadCount++;
                if (uploadCount === files.length) {
                    // 所有文件上传完成
                    refreshImageList();
                    if (successDiv) {
                        successDiv.textContent = `成功上传 ${uploadCount} 张图片！`;
                        successDiv.classList.remove('hidden');
                    }
                    fileInput.value = ''; // 清空文件选择
                }
            })
            .catch((error) => {
                errorCount++;
                errors.push(error.message);
                if (uploadCount + errorCount === files.length) {
                    // 所有文件处理完成
                    refreshImageList();
                    if (errorDiv) {
                        errorDiv.textContent = errors.length > 0 
                            ? `上传失败: ${errors.join(', ')}` 
                            : `成功上传 ${uploadCount} 张，失败 ${errorCount} 张`;
                        errorDiv.classList.remove('hidden');
                    }
                    if (uploadCount > 0 && successDiv) {
                        successDiv.textContent = `成功上传 ${uploadCount} 张图片！`;
                        successDiv.classList.remove('hidden');
                    }
                    fileInput.value = '';
                }
            });
    });
}

// 删除背景图片
function removeBackgroundImage(index) {
    if (confirm('确定要删除这张背景图片吗？')) {
        backgroundManager.removeBackground(index);
        refreshImageList();
    }
}

// 重置背景
function resetBackground() {
    if (confirm('确定要删除所有背景图片并恢复默认背景吗？')) {
        backgroundManager.resetBackground();
        refreshImageList();
        updateIntervalDisplay();
        const successDiv = document.getElementById('backgroundSuccess');
        if (successDiv) {
            successDiv.textContent = '已恢复默认背景';
            successDiv.classList.remove('hidden');
            setTimeout(() => {
                closeBackgroundSettings();
            }, 2000);
        }
    }
}

// 设置轮播间隔
function setBackgroundInterval() {
    const intervalInput = document.getElementById('intervalInput');
    if (!intervalInput) return;

    const seconds = parseInt(intervalInput.value);
    if (isNaN(seconds) || seconds < 1) {
        alert('请输入有效的秒数（至少1秒）');
        return;
    }

    backgroundManager.setInterval(seconds * 1000);
    updateIntervalDisplay();
    
    const successDiv = document.getElementById('backgroundSuccess');
    if (successDiv) {
        successDiv.textContent = `轮播间隔已设置为 ${seconds} 秒`;
        successDiv.classList.remove('hidden');
        setTimeout(() => {
            successDiv.classList.add('hidden');
        }, 2000);
    }
}

// 当文件选择改变时预览（多文件）
function onBackgroundFileChange(event) {
    const fileInput = event.target;
    const errorDiv = document.getElementById('backgroundError');
    const previewContainer = document.getElementById('backgroundPreviewContainer');

    if (fileInput.files && fileInput.files.length > 0) {
        const files = Array.from(fileInput.files);
        const maxFiles = backgroundManager.maxImages - backgroundManager.getImageCount();
        
        // 验证文件数量
        if (files.length > maxFiles) {
            if (errorDiv) {
                errorDiv.textContent = `最多只能再上传 ${maxFiles} 张图片`;
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        // 验证每个文件
        const invalidFiles = files.filter(file => {
            return !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024;
        });

        if (invalidFiles.length > 0) {
            if (errorDiv) {
                errorDiv.textContent = '请选择有效的图片文件（JPG、PNG、GIF，每张不超过5MB）';
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        // 隐藏错误消息
        if (errorDiv) errorDiv.classList.add('hidden');

        // 显示预览
        if (previewContainer) {
            previewContainer.innerHTML = ''; // 清空之前的预览
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'relative';
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'w-full h-24 object-cover rounded';
                    img.alt = file.name;
                    previewItem.appendChild(img);
                    previewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
        }
    }
}
