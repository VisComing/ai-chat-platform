# AI对话平台 UI设计系统

**版本**: v1.0  
**日期**: 2026-04-03  
**设计系统负责人**: UI设计团队

---

## 一、设计基础

### 1.1 设计理念

**核心理念**: 清晰、高效、包容

- **清晰**: 信息层级分明，交互意图明确
- **高效**: 最少步骤完成任务，智能预判用户需求
- **包容**: 无障碍设计，适配多元用户群体

### 1.2 设计原则

| 原则 | 说明 | 应用示例 |
|-----|------|---------|
| 一致性 | 相同功能使用相同组件 | 所有按钮遵循统一样式规范 |
| 反馈性 | 每个操作都有明确反馈 | 发送消息后显示发送状态 |
| 容错性 | 防止错误，提供恢复途径 | 删除操作需二次确认 |
| 效率性 | 减少用户认知负担 | 快捷键、自动补全 |
| 美学性 | 视觉愉悦但不干扰 | 柔和色彩、适度留白 |

---

## 二、色彩系统

### 2.1 主色板

```
主色（Primary）- 科技蓝
├── Primary-50   #E3F2FD  背景、选中态
├── Primary-100  #BBDEFB  悬浮态背景
├── Primary-200  #90CAF9  禁用态边框
├── Primary-300  #64B5F6  图标、辅助元素
├── Primary-400  #42A5F5  链接、强调
├── Primary-500  #2196F3  主按钮、焦点 ★
├── Primary-600  #1E88E5  主按钮悬浮
├── Primary-700  #1976D2  主按钮激活
├── Primary-800  #1565C0  深色主题主色
├── Primary-900  #0D47A1  深色主题强调
```

```
辅助色（Secondary）- 中性灰
├── Secondary-50   #FAFAFA  页面背景
├── Secondary-100  #F5F5F5  卡片背景
├── Secondary-200  #EEEEEE  分割线
├── Secondary-300  #E0E0E0  边框
├── Secondary-400  #BDBDBD  禁用态
├── Secondary-500  #9E9E9E  辅助文字
├── Secondary-600  #757575  次级文字
├── Secondary-700  #616161  正文（深色主题）
├── Secondary-800  #424242  标题（深色主题）
├── Secondary-900  #212121  深色背景
```

### 2.2 语义色

```
成功（Success）- 绿色系
├── Success-Light  #E8F5E9  成功背景
├── Success        #4CAF50  成功图标、按钮
├── Success-Dark   #388E3C  成功悬浮态

警告（Warning）- 橙色系
├── Warning-Light  #FFF3E0  警告背景
├── Warning        #FF9800  警告图标、按钮
├── Warning-Dark   #F57C00  警告悬浮态

错误（Error）- 红色系
├── Error-Light    #FFEBEE  错误背景
├── Error          #F44336  错误图标、按钮
├── Error-Dark     #D32F2F  错误悬浮态

信息（Info）- 蓝色系
├── Info-Light     #E3F2FD  信息背景
├── Info           #2196F3  信息图标、按钮
├── Info-Dark      #1976D2  信息悬浮态
```

### 2.3 深色主题

```css
/* 深色主题色彩映射 */
[data-theme="dark"] {
  --color-bg-primary: #121212;
  --color-bg-secondary: #1E1E1E;
  --color-bg-tertiary: #2C2C2C;
  --color-bg-elevated: #383838;
  
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-text-tertiary: #808080;
  
  --color-border: #404040;
  --color-border-light: #303030;
  
  --color-primary: #64B5F6;
  --color-primary-hover: #90CAF9;
}
```

### 2.4 可访问性要求

| 组合 | 对比度 | WCAG等级 |
|-----|--------|---------|
| Primary-500 on White | 4.54:1 | AA |
| Secondary-700 on White | 9.87:1 | AAA |
| White on Primary-500 | 4.54:1 | AA |
| White on Secondary-900 | 17.4:1 | AAA |

---

## 三、字体系统

### 3.1 字体家族

```css
/* 主字体 */
--font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 代码字体 */
--font-family-code: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

/* 中文补充 */
--font-family-chinese: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
```

### 3.2 字体比例

```
字体比例系统（基于 1.25 比例）

Display    48px / 3rem    行高 1.2    用于大标题
Heading-1  36px / 2.25rem  行高 1.25   用于页面标题
Heading-2  28px / 1.75rem  行高 1.3    用于区块标题
Heading-3  22px / 1.375rem 行高 1.35   用于卡片标题
Heading-4  18px / 1.125rem 行高 1.4    用于小标题
Body-Large 16px / 1rem     行高 1.5    用于正文强调
Body       14px / 0.875rem 行高 1.6    用于正文 ★
Body-Small 12px / 0.75rem  行高 1.6    用于辅助文字
Caption    11px / 0.6875rem 行高 1.5   用于标签、时间戳
```

### 3.3 字重规范

| 字重 | 数值 | 使用场景 |
|-----|------|---------|
| Light | 300 | 大标题、装饰性文字 |
| Regular | 400 | 正文、描述文字 |
| Medium | 500 | 按钮、导航、强调 |
| Semibold | 600 | 小标题、重要信息 |
| Bold | 700 | 大标题、数字强调 |

---

## 四、间距系统

### 4.1 基础间距

```
间距比例系统（基于 4px 基础单位）

Space-1   4px   0.25rem   微间距（图标与文字）
Space-2   8px   0.5rem    小间距（按钮内边距）
Space-3   12px  0.75rem   标准间距（卡片内边距）
Space-4   16px  1rem      常用间距（组件间距）★
Space-5   20px  1.25rem   中等间距
Space-6   24px  1.5rem    区块间距
Space-8   32px  2rem      大间距（页面边距）
Space-10  40px  2.5rem    特大间距
Space-12  48px  3rem      页面区块间距
Space-16  64px  4rem      页面顶部间距
Space-20  80px  5rem      页面底部间距
```

### 4.2 间距应用规范

| 场景 | 间距值 | 说明 |
|-----|--------|------|
| 页面边距（移动端） | Space-4 | 16px |
| 页面边距（桌面端） | Space-8 | 32px |
| 卡片内边距 | Space-4 | 16px |
| 卡片间距 | Space-4 | 16px |
| 按钮内边距 | Space-2/3 | 8-12px |
| 输入框内边距 | Space-3 | 12px |
| 列表项间距 | Space-3 | 12px |
| 消息气泡间距 | Space-2 | 8px |
| 图标与文字间距 | Space-2 | 8px |

---

## 五、阴影系统

### 5.1 阴影层级

```css
/* 阴影系统 */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);

/* 深色主题阴影 */
[data-theme="dark"] {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.5);
}
```

### 5.2 阴影应用

| 层级 | 使用场景 |
|-----|---------|
| xs | 悬浮提示、徽章 |
| sm | 按钮、输入框 |
| md | 卡片、下拉菜单 |
| lg | 模态框、侧边栏 |
| xl | 全屏弹窗 |

---

## 六、圆角系统

### 6.1 圆角规范

```css
/* 圆角系统 */
--radius-none: 0;
--radius-sm: 4px;     /* 按钮、标签 */
--radius-md: 8px;     /* 输入框、卡片 */
--radius-lg: 12px;    /* 模态框、大卡片 */
--radius-xl: 16px;    /* 特大容器 */
--radius-full: 9999px; /* 圆形、胶囊 */
```

### 6.2 圆角应用

| 元素 | 圆角值 | 说明 |
|-----|--------|------|
| 按钮 | radius-sm | 4px |
| 输入框 | radius-md | 8px |
| 卡片 | radius-md | 8px |
| 模态框 | radius-lg | 12px |
| 消息气泡 | radius-lg | 12px（一侧直角） |
| 头像 | radius-full | 圆形 |
| 标签 | radius-sm | 4px |
| 下拉菜单 | radius-md | 8px |

---

## 七、组件库

### 7.1 基础组件

#### Button 按钮

```
按钮类型
├── Primary    主要操作（发送、确认）
├── Secondary  次要操作（取消、返回）
├── Outline    边框按钮（编辑、设置）
├── Ghost      透明按钮（辅助操作）
├── Danger     危险操作（删除、清空）
└── Link       链接按钮（跳转）

按钮尺寸
├── Small   32px高度  内边距 8px 12px
├── Medium  40px高度  内边距 12px 16px ★
├── Large   48px高度  内边距 16px 24px

按钮状态
├── Default   默认态
├── Hover     悬浮态（颜色加深）
├── Active    激活态（颜色更深）
├── Focus     焦点态（外发光）
├── Disabled  禁用态（透明度0.5）
├── Loading   加载态（旋转图标）
```

**按钮设计规范**:
- 最小宽度: 80px
- 图标按钮: 40x40px
- 按钮组间距: 8px
- 触摸目标: 最小44x44px

#### Input 输入框

```
输入框类型
├── Text       单行文本
├── TextArea   多行文本（自动高度）
├── Search     搜索框（带搜索图标）
├── Password   密码框（带切换按钮）
└── File       文件上传

输入框尺寸
├── Small   32px高度
├── Medium  40px高度 ★
├── Large   48px高度

输入框状态
├── Default   默认态（边框 Secondary-300）
├── Hover     悬浮态（边框 Secondary-400）
├── Focus     焦点态（边框 Primary-500 + 外发光）
├── Error     错误态（边框 Error + 错误提示）
├── Success   成功态（边框 Success + 成功提示）
├── Disabled  禁用态（背景 Secondary-100）
```

**输入框设计规范**:
- 内边距: 12px
- 字体大小: 14px
- 占位符颜色: Secondary-400
- 多行输入最大高度: 200px

#### Card 卡片

```
卡片类型
├── Basic      基础卡片（白色背景 + 边框）
├── Elevated   浮起卡片（阴影）
├── Interactive 可交互卡片（悬浮效果）
├── Outline    边框卡片（无背景）
└── Message    消息卡片（对话气泡）

卡片结构
├── Header     卡片头部（标题、操作）
├── Body       卡片主体（内容区域）
├── Footer     卡片底部（操作按钮）
└── Media      卡片媒体（图片、视频）
```

**卡片设计规范**:
- 内边距: 16px
- 卡片间距: 16px
- 边框: 1px Secondary-200
- 圆角: 8px
- 阴影: shadow-sm（Elevated类型）

#### Modal 模态框

```
模态框类型
├── Dialog     对话框（确认、提示）
├── Drawer     抽屉（侧边滑出）
├── Fullscreen 全屏模态
├── Popover    弹出框（小内容）
└── Toast      提示框（自动消失）

模态框尺寸
├── Small   400px宽度
├── Medium  600px宽度 ★
├── Large   800px宽度
├── Custom  自定义宽度
```

**模态框设计规范**:
- 背景遮罩: rgba(0,0,0,0.5)
- 圆角: 12px
- 内边距: 24px
- 关闭按钮: 右上角
- 动画: 淡入 + 缩放

### 7.2 对话组件

#### MessageBubble 消息气泡

```
消息类型
├── User      用户消息（右侧，Primary背景）
├── AI        AI消息（左侧，Secondary背景）
├── System    系统消息（居中，灰色）
├── Error     错误消息（左侧，Error背景）
└── Thinking  思考过程（左侧，可折叠）

消息结构
├── Avatar    头像（左侧AI / 右侧用户）
├── Content   内容区域
│   ├── Text      文本内容
│   ├── Code      代码块
│   ├── Image     图片
│   ├── File      文件
│   ├── Table     表格
│   └── Chart     图表
├── Actions   操作按钮（复制、重新生成、点赞）
├── Meta      元信息（时间、模型、Token数）
```

**消息气泡设计规范**:
- 最大宽度: 70%（桌面端）
- 内边距: 12px 16px
- 圆角: 12px（一侧直角）
- 消息间距: 8px
- 时间戳字体: Caption

#### CodeBlock 代码块

```
代码块结构
├── Header    语言标签 + 操作按钮
├── Content   代码内容（语法高亮）
├── Footer    结果区域（可选）
└── Actions   复制、运行、编辑按钮

代码高亮主题
├── Light     浅色主题（GitHub风格）
├── Dark      深色主题（One Dark风格）
```

**代码块设计规范**:
- 字体: JetBrains Mono
- 字体大小: 13px
- 行号: 可选显示
- 背景深色: #1E1E1E
- 圆角: 8px

#### InputArea 输入区域

```
输入区域结构
├── Toolbar    工具栏（上传、语音、设置）
├── Input      输入框（多行自动高度）
├── Actions    发送按钮、快捷键提示
├── Attachments 已上传文件预览
└── Suggestions 智能建议（可选）
```

**输入区域设计规范**:
- 最小高度: 56px
- 最大高度: 200px
- 工具栏图标: 24x24px
- 发送按钮: 40x40px
- 内边距: 12px

### 7.3 导航组件

#### Sidebar 侧边栏

```
侧边栏结构
├── Header     Logo、用户信息
├── Navigation 导航菜单
│   ├── Home       首页
│   ├── History    历史会话
│   ├── Favorites  收藏夹
│   ├── Agents     智能体列表
│   ├── Knowledge  知识库
│   └── Settings   设置
├── SessionList 当前会话列表
├── Actions     新建会话、搜索
└── Footer      帮助、反馈
```

**侧边栏设计规范**:
- 宽度: 260px（可折叠至60px）
- 背景深色: #1E1E1E
- 菜单项高度: 44px
- 菜单项图标: 20x20px
- 会话列表: 虚拟滚动

#### Header 顶部导航

```
顶部导航结构
├── Left       返回、面包屑
├── Center     会话标题（可编辑）
├── Right      模型选择、设置、分享
```

**顶部导航设计规范**:
- 高度: 56px
- 背景: 白色 / 深色主题 #1E1E1E
- 底部边框: 1px Secondary-200

### 7.4 反馈组件

#### Toast 提示

```
提示类型
├── Success  成功提示（绿色图标）
├── Error    错误提示（红色图标）
├── Warning  警告提示（橙色图标）
├── Info     信息提示（蓝色图标）
└── Loading  加载提示（旋转图标）

提示位置
├── Top-Right    右上角 ★
├── Top-Center   顶部居中
├── Bottom-Right 右下角
├── Bottom-Center 底部居中
```

**提示设计规范**:
- 自动消失时间: 3秒（成功）、5秒（错误）
- 最大宽度: 400px
- 内边距: 12px 16px
- 圆角: 8px

#### Loading 加载

```
加载类型
├── Spinner   旋转加载器
├── Skeleton  骨架屏
├── Progress  进度条
├── Dots      跳动点
└── Typing    打字动画（AI回复中）
```

**加载设计规范**:
- Spinner尺寸: 24px（小）、32px（中）、48px（大）
- Skeleton圆角: 4px
- 进度条高度: 4px

---

## 八、图标系统

### 8.1 图标规范

```
图标尺寸
├── Small   16px   辅助图标、标签图标
├── Medium  20px   导航图标、按钮图标 ★
├── Large   24px   工具栏图标、强调图标
├── XLarge  32px   大图标、空状态图标

图标颜色
├── Primary    Primary-500
├── Secondary  Secondary-500
├── Success    Success
├── Warning    Warning
├── Error      Error
├── White      #FFFFFF（深色背景）
```

### 8.2 核心图标列表

| 图标名称 | 使用场景 | 尺寸 |
|---------|---------|------|
| Send | 发送消息 | 24px |
| Attachment | 上传文件 | 24px |
| Image | 上传图片 | 24px |
| Mic | 语音输入 | 24px |
| Copy | 复制内容 | 20px |
| Regenerate | 重新生成 | 20px |
| Like | 点赞 | 20px |
| Dislike | 点踩 | 20px |
| Share | 分享 | 20px |
| Settings | 设置 | 20px |
| Theme | 主题切换 | 20px |
| History | 历史记录 | 20px |
| Search | 搜索 | 20px |
| Menu | 菜单 | 20px |
| Close | 关闭 | 20px |
| ChevronDown | 下拉展开 | 16px |
| ChevronRight | 向右箭头 | 16px |
| Check | 成功/选中 | 16px |
| Info | 信息提示 | 16px |
| Warning | 警告提示 | 16px |
| Error | 错误提示 | 16px |
| Loading | 加载中 | 20px |
| Code | 代码 | 20px |
| File | 文件 | 20px |
| Link | 链接 | 20px |
| User | 用户 | 24px |
| Bot | AI助手 | 24px |

---

## 九、响应式设计

### 9.1 断点系统

```
断点定义
├── Mobile    320px - 639px    手机设备
├── Tablet    640px - 1023px   平板设备
├── Desktop   1024px - 1279px  桌面设备
├── Wide      1280px+          大屏设备
```

### 9.2 响应式策略

| 组件 | Mobile | Tablet | Desktop | Wide |
|-----|--------|--------|---------|------|
| 侧边栏 | 底部导航 | 可折叠侧边栏 | 固定侧边栏 | 固定侧边栏 |
| 消息宽度 | 100% | 85% | 70% | 60% |
| 输入区域 | 底部固定 | 底部固定 | 底部固定 | 居中 |
| 工具栏 | 简化版 | 完整版 | 完整版 | 完整版 |
| 模态框宽度 | 100% | 80% | 600px | 600px |

### 9.3 移动端适配

**特殊处理**:
- 底部导航替代侧边栏
- 输入区域底部固定
- 消息气泡全宽显示
- 工具栏图标简化
- 手势支持（滑动返回）

---

## 十、动画系统

### 10.1 动画时长

```css
/* 动画时长 */
--duration-fast: 150ms;    /* 微交互（按钮悬浮） */
--duration-normal: 300ms;  /* 标准动画（展开折叠） */
--duration-slow: 500ms;    /* 大动画（模态框） */
--duration-slower: 800ms;  /* 页面过渡 */
```

### 10.2 动画曲线

```css
/* 动画曲线 */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 10.3 核心动画

| 动画名称 | 应用场景 | 时长 | 曲线 |
|---------|---------|------|------|
| fade-in | 模态框出现 | 300ms | ease-out |
| fade-out | 模态框消失 | 200ms | ease-in |
| slide-up | 底部弹出 | 300ms | ease-out |
| slide-down | 下拉展开 | 300ms | ease-out |
| scale-in | 缩放出现 | 300ms | ease-bounce |
| typing | 打字效果 | 每字50ms | linear |
| pulse | 加载脉冲 | 1.5s循环 | ease-in-out |
| shake | 错误抖动 | 500ms | ease-in-out |

---

## 十一、无障碍设计

### 11.1 WCAG 2.1 AA 级要求

| 要求 | 实现方式 |
|-----|---------|
| 色彩对比度 | 文本对比度≥4.5:1 |
| 键盘导航 | 所有交互元素可通过键盘操作 |
| 焦点指示 | 明确的焦点样式（外发光） |
| 屏幕阅读器 | 语义化HTML + ARIA标签 |
| 触摸目标 | 最小44x44px |
| 文本缩放 | 支持200%缩放 |
| 动画控制 | 提供"减少动画"选项 |

### 11.2 ARIA 标签规范

```html
<!-- 按钮示例 -->
<button aria-label="发送消息" aria-describedby="send-tooltip">
  <svg aria-hidden="true">...</svg>
</button>

<!-- 输入框示例 -->
<input 
  aria-label="输入消息"
  aria-describedby="input-hint"
  aria-required="true"
/>

<!-- 模态框示例 -->
<div 
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">确认删除</h2>
  <p id="modal-desc">此操作不可撤销</p>
</div>

<!-- 消息列表示例 -->
<ul role="log" aria-live="polite" aria-label="对话消息">
  <li role="listitem">...</li>
</ul>
```

---

## 十二、设计交付物

### 12.1 交付清单

| 交付物 | 格式 | 说明 |
|-----|------|------|
| 设计规范文档 | Markdown | 本文档 |
| 设计Token文件 | CSS/JSON | 可直接用于开发 |
| 组件库文档 | Storybook | 交互式组件演示 |
| 设计稿 | Figma | 完整界面设计 |
| 图标库 | SVG | 所有图标源文件 |
| 响应式原型 | Figma | 各断点设计 |

### 12.2 设计Token CSS

```css
/* design-tokens.css - 完整设计Token定义 */
:root {
  /* ===== 色彩 ===== */
  --color-primary-50: #E3F2FD;
  --color-primary-100: #BBDEFB;
  --color-primary-200: #90CAF9;
  --color-primary-300: #64B5F6;
  --color-primary-400: #42A5F5;
  --color-primary-500: #2196F3;
  --color-primary-600: #1E88E5;
  --color-primary-700: #1976D2;
  --color-primary-800: #1565C0;
  --color-primary-900: #0D47A1;
  
  --color-secondary-50: #FAFAFA;
  --color-secondary-100: #F5F5F5;
  --color-secondary-200: #EEEEEE;
  --color-secondary-300: #E0E0E0;
  --color-secondary-400: #BDBDBD;
  --color-secondary-500: #9E9E9E;
  --color-secondary-600: #757575;
  --color-secondary-700: #616161;
  --color-secondary-800: #424242;
  --color-secondary-900: #212121;
  
  --color-success: #4CAF50;
  --color-warning: #FF9800;
  --color-error: #F44336;
  --color-info: #2196F3;
  
  /* ===== 字体 ===== */
  --font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-code: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  
  --font-size-xs: 0.6875rem;   /* 11px */
  --font-size-sm: 0.75rem;     /* 12px */
  --font-size-base: 0.875rem;  /* 14px */
  --font-size-lg: 1rem;        /* 16px */
  --font-size-xl: 1.125rem;    /* 18px */
  --font-size-2xl: 1.375rem;   /* 22px */
  --font-size-3xl: 1.75rem;    /* 28px */
  --font-size-4xl: 2.25rem;    /* 36px */
  --font-size-display: 3rem;   /* 48px */
  
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;
  
  /* ===== 间距 ===== */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  
  /* ===== 阴影 ===== */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);
  
  /* ===== 圆角 ===== */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* ===== 动画 ===== */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* ===== 断点 ===== */
  --breakpoint-mobile: 320px;
  --breakpoint-tablet: 640px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1280px;
}

/* 深色主题 */
[data-theme="dark"] {
  --color-bg-primary: #121212;
  --color-bg-secondary: #1E1E1E;
  --color-bg-tertiary: #2C2C2C;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-border: #404040;
  --color-primary: #64B5F6;
}
```

---

**设计系统版本历史**

| 版本 | 日期 | 变更说明 |
|-----|------|---------|
| v1.0 | 2026-04-03 | 初始版本，完整设计系统定义 |