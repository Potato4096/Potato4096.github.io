# Potato的博客
基于GitHub Pages搭建的静态静态个人博客

## 部署步骤
1. 新建GitHub仓库，命名规则：
   - 推荐：`你的用户名.github.io`（访问地址：https://你的用户名.github.io）
   - 自定义：`potato-blog`（访问地址：https://你的用户名.github.io/potato-blog）
2. 将本仓库所有文件上传到新建的GitHub仓库
3. 开启GitHub Pages：
   - 进入仓库 → Settings → Pages
   - Source选择：Branch: main / root（或docs，根据文件位置）
   - 点击Save，等待1-2分钟后即可访问

## 自定义修改
- 修改`index.html`中的个人信息、文章列表
- 修改`css/style.css`自定义样式（颜色、布局等）
- 在`posts/`目录下添加更多文章页面
- 替换`images/avatar.png`为自己的头像

## 主题功能
本博客支持主题切换功能，默认包含4种主题：
- 默认亮色主题
- 暗色主题
- 蓝色主题
- 绿色主题

可通过导航栏的主题选择器切换，系统会记住你的主题偏好。如需添加更多主题，可修改`css/style.css`中的主题变量定义。