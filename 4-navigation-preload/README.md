# Navigation Preload

```sh
# 安装
npm i

# 启动服务器
npm run start

# 打开 http://127.0.0.1:8000
```

受控制的页面加载前需要启动 Service Worker，启动 Service Worker 会消耗时间，减慢页面加载。

当 Service Worker 未启动时，页面响应时间 ≈ Service Worker 启动时间 + 页面本身响应时间。启用 navigation preload 且为启动 Service Worker，页面响应时间 ≈ Math.max(Service Worker 启动时间, 页面本身响应时间)。

参考资料： https://developers.google.com/web/updates/2017/02/navigation-preload
