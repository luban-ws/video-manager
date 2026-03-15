# 使用说明

## 快速开始

### 1. 安装 yt-dlp

在运行应用之前，请确保已安装 `yt-dlp`：

**macOS:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo pip install yt-dlp
# 或
sudo apt install yt-dlp
```

**Windows:**
```bash
pip install yt-dlp
```

### 2. 安装项目依赖

```bash
npm install
```

### 3. 运行开发模式

```bash
npm run tauri dev
```

这将启动开发服务器并打开应用窗口。

## 功能使用

### 添加视频

1. 在输入框中粘贴视频链接（支持 YouTube、Vimeo、Bilibili 等）
2. 点击"提取信息"按钮
3. 应用会自动提取视频的元数据（标题、描述、缩略图、时长等）并保存到数据库

### 打开链接

1. 在输入框中输入或粘贴链接
2. 点击"打开链接"按钮
3. 链接将在默认浏览器中打开

### 下载视频

1. 在视频列表中，找到要下载的视频
2. 点击视频卡片上的"下载"按钮
3. 视频将下载到应用数据目录的 `downloads` 文件夹中

### 搜索和过滤

1. **搜索**：在搜索框中输入关键词，可以按标题或描述搜索
2. **平台过滤**：使用下拉菜单选择特定平台（YouTube、Vimeo 等）

## 数据存储

- **数据库位置**：应用数据目录下的 `videos.db`
- **下载位置**：应用数据目录下的 `downloads/` 文件夹

### 应用数据目录位置

- **macOS**: `~/Library/Application Support/com.videomanager.app/`
- **Linux**: `~/.local/share/com.videomanager.app/`
- **Windows**: `%APPDATA%\com.videomanager.app\`

## 故障排除

### yt-dlp 未找到

如果看到"yt-dlp 未安装"的错误：

1. 确认 `yt-dlp` 已正确安装
2. 在终端运行 `yt-dlp --version` 验证安装
3. 确保 `yt-dlp` 在系统 PATH 中

### 视频提取失败

可能的原因：
- 网络连接问题
- 视频链接无效
- 平台不支持（某些平台可能需要特殊处理）
- yt-dlp 需要更新：`pip install --upgrade yt-dlp`

### 下载失败

- 检查磁盘空间
- 确认网络连接正常
- 某些视频可能受版权保护，无法下载

## 技术说明

### 支持的平台

理论上支持所有 `yt-dlp` 支持的平台，包括但不限于：
- YouTube
- Vimeo
- Bilibili
- 以及 1000+ 其他平台

### 数据库结构

```sql
CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    duration INTEGER,
    platform TEXT NOT NULL,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 注意事项

⚠️ **重要提示**：
- 请遵守各视频平台的服务条款
- 下载视频时请遵守版权法律
- 本工具仅供个人学习和研究使用
- 不要用于商业用途或大规模下载
