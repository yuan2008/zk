// 全局变量
const API_URL = "http://fk.tzgjjgxx.cn:65027/face/getUserInfo"; // 照片查询接口
let fullDatabase = []; // 完整用户数据库（从TXT加载）
let filteredUsers = []; // 搜索过滤后的用户
let selectedUsers = []; // 待查询的选中用户
let queryResults = []; // 最终查询结果（含照片）
let departments = []; // 所有部门列表

// DOM元素
const elements = {
    // 导航
    navBtns: document.querySelectorAll('.nav-btn'),
    panels: document.querySelectorAll('.panel'),
    // 搜索面板
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    resetBtn: document.getElementById('resetBtn'),
    departmentFilter: document.getElementById('departmentFilter'),
    searchResultContainer: document.getElementById('search-result-container'),
    resultCount: document.getElementById('result-count'),
    selectionContainer: document.getElementById('selection-container'),
    selectionCount: document.getElementById('selection-count'),
    queryBtn: document.getElementById('queryBtn'),
    batchSelectBtn: document.getElementById('batchSelectBtn'),
    batchDeselectBtn: document.getElementById('batchDeselectBtn'),
    floatBackToTop: document.getElementById('floatBackToTop'),
    // 结果面板
    finalResultCount: document.getElementById('final-result-count'),
    finalResultList: document.getElementById('final-result-list'),
    downloadAllBtn: document.getElementById('downloadAllBtn')
};

// 初始化
function init() {
    loadBuiltInDatabase(); // 加载内置TXT数据库
    bindEvents();
    updateCounters();
    initFloatButton(); // 初始化悬浮按钮
}

// 绑定事件
function bindEvents() {
    // 导航切换
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            elements.navBtns.forEach(b => b.classList.remove('active'));
            elements.panels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    // 搜索功能 - 修改为内容含有匹配
    elements.searchBtn.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keyup', e => {
        if (e.key === 'Enter') performSearch();
    });
    elements.resetBtn.addEventListener('click', resetSearch);
    elements.departmentFilter.addEventListener('change', performSearch);

    // 批量操作
    elements.batchSelectBtn.addEventListener('click', batchSelect);
    elements.batchDeselectBtn.addEventListener('click', batchDeselect);
    elements.queryBtn.addEventListener('click', batchQueryUsers);

    // 回到顶部
    elements.floatBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 下载全部照片
    elements.downloadAllBtn.addEventListener('click', downloadAllPhotos);
}

// 初始化悬浮按钮
function initFloatButton() {
    window.addEventListener('scroll', () => {
        // 滚动超过300px显示悬浮按钮
        if (window.scrollY > 300) {
            elements.floatBackToTop.classList.add('visible');
        } else {
            elements.floatBackToTop.classList.remove('visible');
        }
    });
}

// 加载内置TXT数据库（从同目录下的data.txt文件）
function loadBuiltInDatabase() {
    // 显示加载状态
    elements.searchResultContainer.innerHTML = '<p class="empty-hint">正在加载数据源...</p>';
    
    fetch('数据.txt')
        .then(response => {
            if (!response.ok) throw new Error(`加载失败 (${response.status})`);
            return response.text();
        })
        .then(txtContent => {
            fullDatabase = [];
            departments = ['']; // 初始化部门列表，包含全部选项
            
            const lines = txtContent.split('\n').filter(line => line.trim());
            lines.forEach((line, index) => {
                const parts = line.trim().split('_');
                if (parts.length === 3) {
                    const department = parts[2].trim();
                    // 收集唯一部门
                    if (!departments.includes(department)) {
                        departments.push(department);
                    }
                    
                    fullDatabase.push({
                        id: index + 1,
                        name: parts[0].trim(),
                        account: parts[1].trim(),
                        phone: parts[2].trim(),
                        department: department
                    });
                }
            });

            // 生成部门筛选下拉选项（支持多选）
            generateDepartmentOptions();
            
            // 初始显示所有用户
            filteredUsers = [...fullDatabase];
            renderSearchResults();
            console.log(`成功加载内置数据库，共${fullDatabase.length}条记录`);
        })
        .catch(error => {
            elements.searchResultContainer.innerHTML = `<p class="empty-hint">数据源加载失败: ${error.message}</p>`;
            console.error('数据库加载错误:', error);
        });
}

// 生成部门筛选选项（支持多选）
function generateDepartmentOptions() {
    let optionsHtml = '<option value="">全部部门</option>';
    departments.forEach(dept => {
        if (dept) { // 跳过空值
            optionsHtml += `<option value="${dept}">${dept}</option>`;
        }
    });
    elements.departmentFilter.innerHTML = optionsHtml;
}

// 执行多条件搜索（名字/账号/电话 + 多部门筛选）
function performSearch() {
    const keyword = elements.searchInput.value.trim().toLowerCase();
    // 获取选中的多个部门（多选select的选中值是数组）
    const selectedDepts = Array.from(elements.departmentFilter.selectedOptions).map(option => option.value);
    
    if (fullDatabase.length === 0) {
        elements.searchResultContainer.innerHTML = '<p class="empty-hint">数据源尚未加载完成</p>';
        return;
    }

    // 多字段匹配 + 多部门筛选
    filteredUsers = fullDatabase.filter(user => {
        // 搜索框改为内容含有匹配（不区分大小写）
        const matchesKeyword = keyword === '' || 
            user.name.toLowerCase().includes(keyword) ||
            user.account.toLowerCase().includes(keyword) ||
            user.phone.toLowerCase().includes(keyword);
        
        // 部门筛选：如果选中"全部部门"或用户部门在选中列表中
        const matchesDept = selectedDepts.includes('') || selectedDepts.includes(user.department);
        
        return matchesKeyword && matchesDept;
    });

    renderSearchResults();
}

// 重置搜索
function resetSearch() {
    elements.searchInput.value = '';
    // 重置部门多选
    Array.from(elements.departmentFilter.options).forEach(option => {
        option.selected = option.value === '';
    });
    filteredUsers = [...fullDatabase];
    renderSearchResults();
}

// 批量勾选当前搜索结果
function batchSelect() {
    if (filteredUsers.length === 0) return;
    
    filteredUsers.forEach(user => {
        if (!selectedUsers.some(u => u.account === user.account)) {
            selectedUsers.push(user);
        }
    });
    
    renderSearchResults();
    renderSelectionList();
}

// 批量取消勾选当前搜索结果
function batchDeselect() {
    if (filteredUsers.length === 0) return;
    
    selectedUsers = selectedUsers.filter(
        selected => !filteredUsers.some(
            user => user.account === selected.account
        )
    );
    
    renderSearchResults();
    renderSelectionList();
}

// 渲染搜索结果（压缩高度）
function renderSearchResults() {
    if (filteredUsers.length === 0) {
        elements.searchResultContainer.innerHTML = '<p class="empty-hint">未找到匹配的用户</p>';
        updateCounters();
        return;
    }

    let html = '';
    filteredUsers.forEach(user => {
        // 检查是否已在选中列表中
        const isSelected = selectedUsers.some(u => u.account === user.account);
        
        html += `
            <div class="user-item ${isSelected ? 'selected' : ''}">
                <div class="info-cell">
                    <div class="info-row">
                        <span class="info-label">名字</span>
                        <span>${user.name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">账号</span>
                        <span>${user.account}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">部门（班级）</span>
                        <span>${user.department}</span>
                    </div>
                </div>
                <div class="action-cell">
                    <button class="btn ${isSelected ? 'default' : 'primary'}" 
                            data-account="${user.account}">
                        ${isSelected ? '移除' : '添加'}
                    </button>
                </div>
            </div>
        `;
    });

    elements.searchResultContainer.innerHTML = html;
    updateCounters();

    // 绑定添加/移除按钮事件
    document.querySelectorAll('.action-cell .btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const account = e.target.getAttribute('data-account');
            toggleUserSelection(account);
        });
    });
}

// 切换用户选中状态
function toggleUserSelection(account) {
    const user = fullDatabase.find(u => u.account === account);
    if (!user) return;

    const index = selectedUsers.findIndex(u => u.account === account);
    
    if (index === -1) {
        // 添加到选中列表
        selectedUsers.push(user);
    } else {
        // 从选中列表移除
        selectedUsers.splice(index, 1);
    }

    // 更新界面
    renderSearchResults();
    renderSelectionList();
}

// 渲染待查询列表
function renderSelectionList() {
    if (selectedUsers.length === 0) {
        elements.selectionContainer.innerHTML = '<p class="empty-hint">从搜索结果中选择用户添加到查询列表</p>';
        updateCounters();
        return;
    }

    let html = '';
    selectedUsers.forEach(user => {
        html += `
            <div class="user-item">
                <div class="info-cell">
                    <div class="info-row">
                        <span class="info-label">名字</span>
                        <span>${user.name}</span>
                    </div>
                    <div class="info-row">
                        <span>${user.account}</span>
                    </div>
                </div>
                <div class="action-cell">
                    <button class="btn default" data-account="${user.account}">移除</button>
                </div>
            </div>
        `;
    });

    elements.selectionContainer.innerHTML = html;
    updateCounters();

    // 绑定移除按钮事件
    document.querySelectorAll('.selection-container .btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const account = e.target.getAttribute('data-account');
            selectedUsers = selectedUsers.filter(u => u.account !== account);
            renderSelectionList();
            renderSearchResults(); // 同步更新搜索结果中的选中状态
        });
    });
}

// 更新计数器
function updateCounters() {
    elements.resultCount.textContent = filteredUsers.length;
    elements.selectionCount.textContent = selectedUsers.length;
    elements.finalResultCount.textContent = queryResults.length;
}

// 批量查询用户照片
async function batchQueryUsers() {
    if (selectedUsers.length === 0) {
        alert('请先从搜索结果中选择用户添加到查询列表');
        return;
    }

    // 显示加载状态
    elements.queryBtn.disabled = true;
    elements.queryBtn.textContent = '查询中...';
    elements.finalResultList.innerHTML = '<p class="empty-hint">正在查询照片，请稍候...</p>';
    queryResults = [];

    try {
        // 逐个查询（避免接口限制）
        for (const user of selectedUsers) {
            const result = await queryUserPhoto(user);
            if (result) {
                queryResults.push(result);
            }
        }

        // 渲染最终结果
        renderFinalResults();
        elements.navBtns[1].click(); // 切换到结果面板
        updateCounters();
    } catch (error) {
        elements.finalResultList.innerHTML = `<p class="empty-hint">查询出错: ${error.message}</p>`;
        console.error('查询错误:', error);
    } finally {
        elements.queryBtn.disabled = false;
        elements.queryBtn.textContent = '批量查询选中用户';
    }
}

// 查询单个用户的照片
async function queryUserPhoto(user) {
    try {
        const url = `${API_URL}?userNo=${encodeURIComponent(user.account)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.code === 600 && result.msg === "成功") {
            const data = result.data || {};
            return {
                ...user,
                imgStr: data.imgStr || null
            };
        } else {
            console.warn(`用户${user.name}查询失败: ${result.msg || '未知错误'}`);
            return { ...user, imgStr: null };
        }
    } catch (error) {
        console.error(`用户${user.name}查询出错:`, error);
        return { ...user, imgStr: null };
    }
}

// 渲染最终查询结果（照片左信息右，压缩高度）
function renderFinalResults() {
    if (queryResults.length === 0) {
        elements.finalResultList.innerHTML = '<p class="empty-hint">未查询到有效结果</p>';
        return;
    }

    let html = '';
    queryResults.forEach(item => {
        const hasPhoto = !!item.imgStr;
        
        html += `
            <div class="result-item ${!hasPhoto ? 'no-photo' : ''}">
                ${hasPhoto ? `
                <div class="photo-cell">
                    <div class="photo-container">
                        <img src="data:image/jpeg;base64,${item.imgStr}" 
                              alt="${item.name}的照片"
                              onError="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 24 24\' fill=\'%23e74c3c\'%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z\'/%3E%3C/svg%3E'; this.alt='照片加载失败'">
                    </div>
                </div>` : ''}
                <div class="result-info">
                    <p><span class="label">姓名</span>${item.name}</p>
                    <p><span class="label">账号</span>${item.account}</p>
                    <p><span class="label">部门(班级)</span>${item.department}</p>
                    ${hasPhoto ? 
                        `<p><button class="btn primary download-single" 
                                   data-name="${item.name}" 
                                   data-account="${item.account}" 
                                   data-phone="${item.phone}"
                                   data-dept="${item.department}"
                                   data-img="${item.imgStr}">
                            下载照片
                        </button></p>` : ''
                    }
                </div>
            </div>
        `;
    });

    elements.finalResultList.innerHTML = html;

    // 绑定单个下载事件
    document.querySelectorAll('.download-single').forEach(btn => {
        btn.addEventListener('click', e => {
            const name = e.target.getAttribute('data-name');
            const account = e.target.getAttribute('data-account');
            const phone = e.target.getAttribute('data-phone');
            const dept = e.target.getAttribute('data-dept');
            const imgStr = e.target.getAttribute('data-img');
            downloadSinglePhoto(name, account, phone, dept, imgStr);
        });
    });
}

// 在文档1的JS中修改下载功能
// 修改下载单个照片函数
function downloadSinglePhoto(name, account, phone, dept, imgStr) {
    try {
        // 生成安全的文件名：替换非法字符
        const safeName = name.replace(/[<>:"\/\\|?*]+/g, '_');
        const safeDept = dept.replace(/[<>:"\/\\|?*]+/g, '_');
        
        // 使用格式：名字_账号_电话_部门
        const fileName = `${safeName}_${account}_${safeDept}.jpg`;
        
        const link = document.createElement('a');
        link.download = fileName;
        link.href = `data:image/jpeg;base64,${imgStr}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        alert(`照片下载失败: ${error.message}`);
        console.error('下载错误:', error);
    }
}

// 修改批量下载功能
function downloadAllPhotos() {
    const hasPhotos = queryResults.filter(item => item.imgStr);
    if (hasPhotos.length === 0) {
        alert('没有可下载的照片');
        return;
    }

    const zip = new JSZip();
    const photoFolder = zip.folder('枣科用户照片');

    hasPhotos.forEach(item => {
        // 生成安全的文件名
        const safeName = item.name.replace(/[<>:"\/\\|?*]+/g, '_');
        const safeDept = item.department.replace(/[<>:"\/\\|?*]+/g, '_');
        
        // 使用格式：名字_账号_电话_部门
        const fileName = `${safeName}_${item.account}_${safeDept}.jpg`;
        
        photoFolder.file(fileName, item.imgStr, { base64: true });
    });

    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.download = '枣科用户照片批量下载.zip';
        link.href = URL.createObjectURL(content);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        alert(`压缩包生成失败: ${error.message}`);
        console.error('压缩错误:', error);
    });
}


// 启动应用
init();
